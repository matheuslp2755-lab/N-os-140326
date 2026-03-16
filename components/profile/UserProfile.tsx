
import React, { useState, useEffect, useRef } from 'react';
/* Added missing getDocs import */
import { auth, db, doc, getDoc, collection, deleteDoc, serverTimestamp, updateDoc, onSnapshot, query, where, writeBatch, addDoc, setDoc, storage, storageRef, uploadBytes, getDownloadURL, getDocs, orderBy } from '../../firebase';
import { signOut, deleteUser } from 'firebase/auth';
import Button from '../common/Button';
import EditProfileModal from './EditProfileModal';
import FollowersModal from './FollowersModal';
import OnlineIndicator from '../common/OnlineIndicator';
import { useLanguage } from '../../context/LanguageContext';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import Post from '../feed/Post';
import ProfileMusicPlayer from './ProfileMusicPlayer';
import RadarNeosModal from './RadarNeosModal';
import VerificationRequestModal from './VerificationRequestModal';
import MemoriesBar from './MemoriesBar';
import CreateMemoryModal from './CreateMemoryModal';
import MemoryViewerModal from './MemoryViewerModal';

interface UserProfileProps {
    userId: string;
    onStartMessage: (user: any) => void;
    onSelectUser?: (userId: string) => void;
}

export const VerifiedBadge = ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={`${className} text-sky-500 fill-current inline-block ml-1`} viewBox="0 0 24 24" aria-label="Verificado">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
);

const UserProfile: React.FC<UserProfileProps> = ({ userId, onStartMessage, onSelectUser }) => {
    const { t } = useLanguage();
    const { formatTimestamp } = useTimeAgo();
    const [user, setUser] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [memories, setMemories] = useState<any[]>([]);
    const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isRadarOpen, setIsRadarOpen] = useState(false);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [isCreateMemoryOpen, setIsCreateMemoryOpen] = useState(false);
    const [selectedMemory, setSelectedMemory] = useState<any | null>(null);
    const [isOnline, setIsOnline] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    
    const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
    const [isFollowingModalOpen, setIsFollowingModalOpen] = useState(false);
    
    const [selectedPost, setSelectedPost] = useState<any | null>(null);
    
    const currentUser = auth.currentUser;
    const isOwner = currentUser?.uid === userId;
    
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOptionsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!userId) return;
        
        // Tenta buscar do Banco de Dados Próprio (API Local)
        fetch(`/api/users/${userId}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.username) {
                    setUser(data);
                    setIsOnline(true);
                } else {
                    // Fallback para Firebase
                    const userRef = doc(db, 'users', userId);
                    const unsub = onSnapshot(userRef, (doc) => {
                        if (doc.exists()) {
                            const userData = doc.data();
                            setUser(userData);
                            const lastSeen = userData.lastSeen;
                            const isUserOnline = lastSeen && (Date.now() / 1000 - lastSeen.seconds) < 120;
                            setIsOnline(!!isUserOnline);
                        }
                    });
                    return () => unsub();
                }
            })
            .catch(() => {
                // Fallback para Firebase em caso de erro
                const userRef = doc(db, 'users', userId);
                const unsub = onSnapshot(userRef, (doc) => {
                    if (doc.exists()) {
                        const userData = doc.data();
                        setUser(userData);
                        const lastSeen = userData.lastSeen;
                        const isUserOnline = lastSeen && (Date.now() / 1000 - lastSeen.seconds) < 120;
                        setIsOnline(!!isUserOnline);
                    }
                });
                return () => unsub();
            });
    }, [userId]);

    useEffect(() => {
        if (!userId) return;

        const unsubFollowers = onSnapshot(collection(db, 'users', userId, 'followers'), (snap) => {
            setStats(prev => ({ ...prev, followers: snap.size }));
        });

        const unsubFollowing = onSnapshot(collection(db, 'users', userId, 'following'), (snap) => {
            setStats(prev => ({ ...prev, following: snap.size }));
        });

        let unsubIsFollowing = () => {};
        if (currentUser && !isOwner) {
            unsubIsFollowing = onSnapshot(doc(db, 'users', userId, 'followers', currentUser.uid), (doc) => {
                setIsFollowing(doc.exists());
            });
        }

        return () => {
            unsubFollowers();
            unsubFollowing();
            unsubIsFollowing();
        };
    }, [userId, currentUser, isOwner]);

    useEffect(() => {
        if (!userId) return;
        const postsQ = query(collection(db, 'posts'), where('userId', '==', userId));
        const unsub = onSnapshot(postsQ, (snap) => {
            setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
            setStats(prev => ({ ...prev, posts: snap.size }));
        });

        const memoriesQ = query(collection(db, 'users', userId, 'memories'), orderBy('createdAt', 'desc'));
        const unsubMemories = onSnapshot(memoriesQ, (snap) => {
            setMemories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsub();
            unsubMemories();
        };
    }, [userId]);

    const handleUpdateProfile = async (updatedData: any) => {
        if (!currentUser || !isOwner) return;
        setIsSubmitting(true);
        try {
            let avatarUrl = user.avatar;
            if (updatedData.avatarFile) {
                const avatarRef = storageRef(storage, `avatars/${userId}/avatar_${Date.now()}.jpg`);
                await uploadBytes(avatarRef, updatedData.avatarFile);
                avatarUrl = await getDownloadURL(avatarRef);
            }

            const payload: any = {
                username: updatedData.username,
                username_lowercase: updatedData.username.toLowerCase(),
                nickname: updatedData.nickname,
                bio: updatedData.bio,
                avatar: avatarUrl,
                isPrivate: updatedData.isPrivate,
            };

            if (updatedData.profileMusic !== undefined) payload.profileMusic = updatedData.profileMusic;
            if (updatedData.currentVibe !== undefined) payload.currentVibe = updatedData.currentVibe;

            await updateDoc(doc(db, 'users', userId), payload);

            // Salva no Banco de Dados Próprio (API Local)
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: userId, ...payload })
            }).catch(err => console.error("Erro ao salvar perfil na API local:", err));

            // Salva na Memória do Celular (LocalStorage)
            const localData = JSON.parse(localStorage.getItem(`neos_user_${userId}`) || '{}');
            localStorage.setItem(`neos_user_${userId}`, JSON.stringify({ ...localData, ...payload }));

            setIsEditModalOpen(false);
        } catch (e) {
            console.error("Erro ao salvar perfil:", e);
            alert("Erro ao salvar alterações. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFollowToggle = async () => {
        if (!currentUser || isOwner) return;
        const targetFollowerRef = doc(db, 'users', userId, 'followers', currentUser.uid);
        const myFollowingRef = doc(db, 'users', currentUser.uid, 'following', userId);
        
        try {
            if (isFollowing) {
                await deleteDoc(targetFollowerRef);
                await deleteDoc(myFollowingRef);
            } else {
                await setDoc(targetFollowerRef, { timestamp: serverTimestamp() });
                await setDoc(myFollowingRef, { timestamp: serverTimestamp() });
                
                await addDoc(collection(db, 'users', userId, 'notifications'), {
                    type: 'follow',
                    fromUserId: currentUser.uid,
                    fromUsername: currentUser.displayName,
                    fromUserAvatar: currentUser.photoURL,
                    timestamp: serverTimestamp(),
                    read: false
                });
            }
        } catch (e) { console.error(e); }
    };

    const handleDeleteAccountPermanently = async () => {
        if (!currentUser || !isOwner) return;
        const confirmation = window.confirm("ATENÇÃO: Deseja excluir sua conta Néos permanentemente? Todas as suas fotos, vídeos e dados serão apagados para sempre.");
        if (!confirmation) return;
        setIsDeletingAccount(true);
        try {
            const batch = writeBatch(db);
            /* Fixed: Added getDocs to imports and calling it here */
            const postsSnap = await getDocs(query(collection(db, 'posts'), where('userId', '==', currentUser.uid)));
            postsSnap.forEach(d => batch.delete(d.ref));
            /* Fixed: Added getDocs to imports and calling it here */
            const pulsesSnap = await getDocs(query(collection(db, 'pulses'), where('authorId', '==', currentUser.uid)));
            pulsesSnap.forEach(d => batch.delete(d.ref));
            /* Fixed: Added getDocs to imports and calling it here */
            const vibesSnap = await getDocs(query(collection(db, 'vibes'), where('userId', '==', currentUser.uid)));
            vibesSnap.forEach(d => batch.delete(d.ref));
            batch.delete(doc(db, 'users', currentUser.uid));
            await batch.commit();
            await deleteUser(currentUser);
            window.location.reload();
        } catch (e: any) {
            console.error("Erro ao excluir conta:", e);
            alert("Erro ao excluir conta. Tente novamente.");
        } finally {
            setIsDeletingAccount(false);
        }
    };

    if (!user) return <div className="p-8 text-center">Carregando perfil...</div>;

    return (
        <div className="container mx-auto max-w-4xl p-4 sm:p-8">
            <header className="flex flex-col sm:flex-row items-center gap-8 mb-8 relative">
                <div className="relative w-32 h-32 flex-shrink-0 p-1 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500">
                    <div className="w-full h-full rounded-full p-1 bg-white dark:bg-black">
                        <img src={user?.avatar} className="w-full h-full rounded-full object-cover" alt="Avatar" />
                    </div>
                    {isOnline && <OnlineIndicator />}
                </div>
                
                <div className="flex-grow text-center sm:text-left w-full">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 w-full sm:w-auto">
                            <h2 className="text-2xl font-black flex items-center tracking-tight shrink-0">
                                {user?.username}
                                {user?.isVerified && <VerifiedBadge className="w-5 h-5 ml-1" />}
                            </h2>
                            {user?.profileMusic && (
                                <div className="w-full sm:w-64 max-w-[280px] animate-fade-in">
                                    <ProfileMusicPlayer musicInfo={user.profileMusic} />
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            {isOwner ? (
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => setIsEditModalOpen(true)} className="!w-auto !bg-zinc-100 dark:!bg-zinc-800 !text-black dark:!text-white !px-6 !py-2 !rounded-xl !font-bold">Editar Perfil</Button>
                                    <button 
                                        onClick={() => setIsRadarOpen(true)}
                                        className="p-2.5 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                                        title="Radar Néos"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a10 10 0 0114.142 0M2.828 9.172a15 15 0 0121.214 0" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Button onClick={handleFollowToggle} className={`!w-auto !px-8 !py-2 !rounded-xl ${isFollowing ? '!bg-zinc-200 dark:!bg-zinc-800 !text-black dark:!text-white' : ''}`}>
                                        {isFollowing ? 'Seguindo' : 'Seguir'}
                                    </Button>
                                    <Button onClick={() => onStartMessage(user)} className="!w-auto !bg-zinc-100 dark:!bg-zinc-800 !text-black dark:!text-white !px-6 !py-2 !rounded-xl">Mensagem</Button>
                                </>
                            )}
                            
                            <div className="relative" ref={menuRef}>
                                <button onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)} className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border dark:border-zinc-700 hover:bg-zinc-200 transition-colors">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle></svg>
                                </button>
                                {isOptionsMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-2xl z-[100] py-2 overflow-hidden animate-slide-up">
                                        {isOwner && !user.isVerified && (
                                            <button 
                                                onClick={() => { setIsVerificationModalOpen(true); setIsOptionsMenuOpen(false); }} 
                                                className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 font-black text-sky-500 uppercase tracking-widest"
                                            >
                                                Solicitar Verificado
                                            </button>
                                        )}
                                        {isOwner && <button onClick={() => signOut(auth)} className="w-full text-left px-4 py-3 text-sm font-bold border-b dark:border-zinc-800">Sair da Conta</button>}
                                        {isOwner && <button onClick={handleDeleteAccountPermanently} disabled={isDeletingAccount} className="w-full text-left px-4 py-3 text-xs text-red-500 font-black uppercase tracking-widest hover:bg-red-500/10">{isDeletingAccount ? 'Excluindo...' : 'Excluir conta Néos permanentemente'}</button>}
                                        {!isOwner && <button className="w-full text-left px-4 py-3 text-sm text-red-500 font-bold">Denunciar Perfil</button>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-6 justify-center sm:justify-start text-sm mb-4 font-bold uppercase tracking-tighter">
                        <p><span className="text-lg">{stats.posts}</span> publicações</p>
                        <button onClick={() => setIsFollowersModalOpen(true)}><span className="text-lg">{stats.followers}</span> seguidores</button>
                        <button onClick={() => setIsFollowingModalOpen(true)}><span className="text-lg">{stats.following}</span> seguindo</button>
                    </div>
                    <p className="text-sm font-medium leading-relaxed max-w-md mx-auto sm:mx-0 whitespace-pre-wrap mb-4">{user.bio}</p>
                    {user.status === 'offline' && user.lastSeen && user.showPresence !== false && (
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">
                            Ativo {formatTimestamp(user.lastSeen)}
                        </p>
                    )}
                </div>
            </header>

            <div className="mb-8">
                <MemoriesBar 
                    memories={memories} 
                    isOwner={isOwner} 
                    onViewMemory={(m) => setSelectedMemory(m)} 
                    onCreateMemory={() => setIsCreateMemoryOpen(true)} 
                />
            </div>

            <div className="grid grid-cols-3 gap-1 border-t dark:border-zinc-800 pt-6">
                {posts.map(p => (
                    <div key={p.id} onClick={() => setSelectedPost(p)} className="aspect-square bg-zinc-100 dark:bg-zinc-900 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                        <img src={p?.imageUrl} className="w-full h-full object-cover" alt="Post" />
                    </div>
                ))}
            </div>

            {selectedPost && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedPost(null)}>
                    <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end mb-2">
                            <button onClick={() => setSelectedPost(null)} className="text-white text-3xl font-thin">&times;</button>
                        </div>
                        <Post post={selectedPost} onPostDeleted={(id) => { deleteDoc(doc(db, 'posts', id)); setSelectedPost(null); }} onSelectUser={(uid) => { setSelectedPost(null); onSelectUser?.(uid); }} />
                    </div>
                </div>
            )}

            <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} user={user} onUpdate={handleUpdateProfile} isSubmitting={isSubmitting} />
            <RadarNeosModal isOpen={isRadarOpen} onClose={() => setIsRadarOpen(false)} onUserMatched={(id) => { setIsRadarOpen(false); onSelectUser?.(id); }} />
            <VerificationRequestModal isOpen={isVerificationModalOpen} onClose={() => setIsVerificationModalOpen(false)} followerCount={stats.followers} />
            <FollowersModal isOpen={isFollowersModalOpen} onClose={() => setIsFollowersModalOpen(false)} userId={userId} mode="followers" />
            <FollowersModal isOpen={isFollowingModalOpen} onClose={() => setIsFollowingModalOpen(false)} userId={userId} mode="following" />
            <CreateMemoryModal 
                isOpen={isCreateMemoryOpen} 
                onClose={() => setIsCreateMemoryOpen(false)} 
                onMemoryCreated={() => {
                    setIsCreateMemoryOpen(false);
                }}
            />
            {selectedMemory && (
                <MemoryViewerModal 
                    memory={selectedMemory} 
                    authorInfo={{ id: userId, username: user.username, avatar: user.avatar }}
                    onClose={() => setSelectedMemory(null)} 
                    onDeleteMemory={(id) => {
                        setMemories(prev => prev.filter(m => m.id !== id));
                        setSelectedMemory(null);
                    }}
                />
            )}
        </div>
    );
};

export default UserProfile;
