
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, getDownloadURL, uploadBytes } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import TextAreaInput from '../common/TextAreaInput';
import AddMusicModal from './AddMusicModal';
import SearchFollowingModal from './SearchFollowingModal';

interface GalleryImage {
    file: File | Blob;
    preview: string;
}

interface Preset {
    id: string;
    name: string;
    filterCSS: string;
}

const PARADISE_PRESETS: Preset[] = [
    { id: 'normal', name: 'NORMAL', filterCSS: 'none' },
    { id: 'dazz', name: 'DAZZ DANSCAN', filterCSS: 'brightness(0.99) contrast(0.90) saturate(0.92) sepia(0.06) blur(0.05px)' },
    { id: 'grf', name: 'GRF 2016', filterCSS: 'brightness(0.92) contrast(0.82) saturate(0.85) sepia(0.06)' },
    { id: 'huji', name: 'HUJI 98', filterCSS: 'brightness(0.95) contrast(0.9) saturate(0.92) sepia(0.12) blur(0.1px)' },
    { id: 'vsco', name: 'VSCO SOFT', filterCSS: 'brightness(1.08) contrast(0.78) saturate(0.9) sepia(0.04)' },
    { id: 'iphone6', name: 'IPHONE 6', filterCSS: 'contrast(1.05) saturate(0.95) brightness(1.0)' },
    { id: 'cyber', name: 'CYBERPUNK', filterCSS: 'contrast(1.3) saturate(1.35) hue-rotate(-10deg) brightness(1.1)' },
    { id: 'disposable', name: 'KODAK', filterCSS: 'brightness(0.9) contrast(0.7) saturate(0.8) sepia(0.1) blur(0.2px)' },
    { id: 'tumblr', name: 'DARK TUMBLR', filterCSS: 'brightness(0.8) contrast(1.1) saturate(0.7) sepia(0.05)' },
    { id: 'analog', name: 'ANALOG PRO', filterCSS: 'contrast(0.85) saturate(0.95) sepia(0.03)' },
];

type MusicInfo = {
  nome: string;
  artista: string;
  capa: string;
  preview: string;
  startTime?: number;
};

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPostCreated: () => void;
    initialImages: GalleryImage[];
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose, onPostCreated, initialImages }) => {
    const { t } = useLanguage();
    const [mediaList, setMediaList] = useState<GalleryImage[]>([]);
    const [caption, setCaption] = useState('');
    const [activePreset, setActivePreset] = useState<Preset>(PARADISE_PRESETS[0]);
    const [submitting, setSubmitting] = useState(false);
    
    const [selectedMusic, setSelectedMusic] = useState<MusicInfo | null>(null);
    const [showMusicCover, setShowMusicCover] = useState(true);
    const [mentionedUsers, setMentionedUsers] = useState<any[]>([]);
    const [overlayText, setOverlayText] = useState('');
    
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    const [isMentionModalOpen, setIsMentionModalOpen] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            if (initialImages && initialImages.length > 0) setMediaList([...initialImages]);
        } else { 
            setCaption(''); 
            setMediaList([]);
            setSelectedMusic(null);
            setShowMusicCover(true);
            setMentionedUsers([]);
            setOverlayText('');
            setActivePreset(PARADISE_PRESETS[0]);
        }
    }, [isOpen, initialImages]);

    const convertToJpg = async (item: GalleryImage): Promise<Blob> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const size = Math.max(img.width, img.height);
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    // Extract colors for background
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = 1;
                    tempCanvas.height = 2;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (tempCtx) {
                        tempCtx.drawImage(img, 0, 0, 1, 2);
                        const data = tempCtx.getImageData(0, 0, 1, 2).data;
                        const topColor = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
                        const bottomColor = `rgb(${data[4]}, ${data[5]}, ${data[6]})`;
                        
                        const gradient = ctx.createLinearGradient(0, 0, 0, size);
                        gradient.addColorStop(0, topColor);
                        gradient.addColorStop(1, bottomColor);
                        ctx.fillStyle = gradient;
                        ctx.fillRect(0, 0, size, size);
                    } else {
                        ctx.fillStyle = "black";
                        ctx.fillRect(0, 0, size, size);
                    }

                    ctx.filter = activePreset.filterCSS;
                    
                    // Center image
                    const x = (size - img.width) / 2;
                    const y = (size - img.height) / 2;
                    ctx.drawImage(img, x, y);
                    
                    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
                }
            };
            img.src = item.preview;
        });
    };

    const handleSubmit = async () => {
        if (mediaList.length === 0 || submitting) return;
        setSubmitting(true);
        try {
            const urls = await Promise.all(mediaList.map(async (item) => {
                const jpgBlob = await convertToJpg(item);
                const path = `posts/${auth.currentUser?.uid}/${Date.now()}.jpg`;
                const ref = storageRef(storage, path);
                await uploadBytes(ref, jpgBlob);
                return await getDownloadURL(ref);
            }));

            const postData = {
                userId: auth.currentUser?.uid,
                username: auth.currentUser?.displayName || "Usuário Néos",
                userAvatar: auth.currentUser?.photoURL || "https://picsum.photos/seed/user/200",
                imageUrl: urls[0],
                media: urls.map(url => ({ url, type: 'image' })),
                caption,
                likes: [],
                musicInfo: selectedMusic,
                showMusicCover,
                mentionedUsers: mentionedUsers.map(u => ({ id: u.id, username: u.username })),
                overlayText: overlayText.trim(),
                filterId: activePreset.id,
                isPublished: true
            };

            // Salva no Banco de Dados Próprio (API Local)
            await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData)
            }).catch(err => console.error("Erro ao salvar na API local:", err));

            // Mantém o salvamento no Firebase como redundância
            await addDoc(collection(db, 'posts'), {
                ...postData,
                timestamp: serverTimestamp(),
            });

            onPostCreated();
            onClose();
        } catch (e) { 
            console.error("Erro ao publicar post:", e);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center overflow-hidden animate-fade-in">
            <div className="w-full h-full max-w-6xl bg-white dark:bg-zinc-950 flex flex-col md:flex-row overflow-hidden">
                
                {/* PREVIEW */}
                <div className="relative w-full md:w-[55%] h-[35vh] md:h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r dark:border-zinc-800">
                    {mediaList.length > 0 && (
                        <img src={mediaList[0].preview} className="w-full h-full object-contain transition-all duration-300" style={{ filter: activePreset.filterCSS }} alt="Preview" />
                    )}
                    
                    {overlayText && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                            <p className="text-white font-black text-2xl md:text-3xl text-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] uppercase italic tracking-tighter">
                                {overlayText}
                            </p>
                        </div>
                    )}

                    {selectedMusic && showMusicCover && (
                        <div className="absolute top-4 left-4 animate-slide-right scale-75 md:scale-100 origin-top-left">
                            <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-2 rounded-2xl flex items-center gap-3 shadow-2xl">
                                <img src={selectedMusic.capa} className="w-10 h-10 rounded-lg" />
                                <div className="pr-2 overflow-hidden">
                                    <p className="text-white text-[9px] font-black uppercase truncate max-w-[100px]">{selectedMusic.nome}</p>
                                    <p className="text-white/60 text-[7px] font-bold uppercase">{selectedMusic.artista}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* CONTROLES */}
                <div className="flex-grow flex flex-col h-[65vh] md:h-full overflow-hidden bg-white dark:bg-zinc-950">
                    <header className="p-4 border-b dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                        <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all">&times;</button>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Nova Publicação</span>
                        <Button onClick={handleSubmit} disabled={submitting || mediaList.length === 0} className="!w-auto !py-1.5 !px-6 !rounded-full !font-black !uppercase !text-[10px] !tracking-widest shadow-lg">
                            {submitting ? '...' : 'Publicar'}
                        </Button>
                    </header>
                    
                    <div className="flex-grow overflow-y-auto p-5 space-y-6 no-scrollbar pb-32">
                        <div className="bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-3xl border dark:border-zinc-800">
                             <TextAreaInput id="cap" label="Legenda" value={caption} onChange={e => setCaption(e.target.value)} />
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">Filtros Paradise</p>
                            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                                {PARADISE_PRESETS.map((p) => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => setActivePreset(p)}
                                        className="flex flex-col items-center shrink-0 gap-2 active:scale-95 transition-transform"
                                    >
                                        <div className={`w-14 h-14 rounded-2xl border-2 overflow-hidden transition-all ${activePreset.id === p.id ? 'border-sky-500 ring-4 ring-sky-500/20' : 'border-zinc-200 dark:border-zinc-800'}`}>
                                            {mediaList.length > 0 && (
                                                <img src={mediaList[0].preview} className="w-full h-full object-cover" style={{ filter: p.filterCSS }} />
                                            )}
                                        </div>
                                        <span className={`text-[8px] font-black uppercase ${activePreset.id === p.id ? 'text-sky-500' : 'text-zinc-500'}`}>{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">Ferramentas</p>
                            
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-[1.5rem] border dark:border-zinc-800">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold">Texto Overlay</span>
                                    {overlayText && <button onClick={() => setOverlayText('')} className="text-[9px] text-red-500 font-black uppercase">Limpar</button>}
                                </div>
                                <input 
                                    type="text" 
                                    value={overlayText} 
                                    onChange={e => setOverlayText(e.target.value)}
                                    placeholder="Escreva algo sobre a foto..."
                                    className="w-full bg-white dark:bg-black p-3 rounded-xl text-sm font-bold border dark:border-zinc-800 outline-none"
                                />
                            </div>

                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsMusicModalOpen(true)}
                                    className="flex-grow p-4 bg-zinc-50 dark:bg-zinc-900 rounded-[1.5rem] border dark:border-zinc-800 flex items-center gap-3 hover:bg-zinc-100 transition-all"
                                >
                                    <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                                    <span className="text-xs font-bold truncate">{selectedMusic ? 'Trocar Som' : 'Adicionar Som'}</span>
                                </button>
                                {selectedMusic && (
                                    <button onClick={() => setShowMusicCover(!showMusicCover)} className={`p-4 rounded-2xl border ${showMusicCover ? 'bg-sky-500 text-white border-sky-500' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200'}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                                )}
                            </div>

                            <button 
                                onClick={() => setIsMentionModalOpen(true)}
                                className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 rounded-[1.5rem] border dark:border-zinc-800 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    <span className="text-xs font-bold">Mencionar Amigos ({mentionedUsers.length})</span>
                                </div>
                                <span className="text-sky-500 font-black text-xs">+</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <AddMusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} postId="" onMusicAdded={(m) => { setSelectedMusic(m); setIsMusicModalOpen(false); }} isProfileModal={true} />
            <SearchFollowingModal isOpen={isMentionModalOpen} onClose={() => setIsMentionModalOpen(false)} title="Mencionar Amigo" onSelect={(u) => { if(!mentionedUsers.find(mu => mu.id === u.id)) setMentionedUsers([...mentionedUsers, u]); }} />
        </div>
    );
};

export default CreatePostModal;
