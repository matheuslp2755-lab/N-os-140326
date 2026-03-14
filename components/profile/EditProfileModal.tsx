import React, { useState, useEffect, useRef } from 'react';
import Button from '../common/Button';
import TextInput from '../common/TextInput';
import TextAreaInput from '../common/TextAreaInput';
import { useLanguage } from '../../context/LanguageContext';
import AddMusicModal from '../post/AddMusicModal';
import AvatarEditorModal from './AvatarEditorModal';
import heic2any from 'heic2any';
import { db, collection, query, where, getDocs, limit } from '../../firebase';

type MusicInfo = {
  nome: string;
  artista: string;
  capa: string;
  preview: string;
  startTime?: number;
};

type VibeType = 'joy' | 'anger' | 'sloth' | null;

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    username: string;
    avatar: string;
    bio?: string;
    nickname?: string;
    currentVibe?: VibeType;
    isPrivate?: boolean;
    showPresence?: boolean;
    profileMusic?: MusicInfo;
    lastUsernameChange?: { seconds: number };
    lastNicknameChange?: { seconds: number };
  };
  onUpdate: (updatedData: { 
    username: string; 
    nickname: string;
    bio: string; 
    avatarFile: File | Blob | null; 
    avatarPreview: string | null; 
    isPrivate: boolean; 
    showPresence: boolean;
    profileMusic: MusicInfo | null;
    currentVibe: VibeType;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const VIBE_OPTIONS = [
    { id: 'joy', label: 'vibeJoy', emoji: '☀️', color: 'bg-yellow-400' },
    { id: 'anger', label: 'vibeAnger', emoji: '🔥', color: 'bg-red-600' },
    { id: 'sloth', label: 'vibeSloth', emoji: '💤', color: 'bg-indigo-400' },
];

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, user, onUpdate, isSubmitting }) => {
  const [username, setUsername] = useState(user.username);
  const [nickname, setNickname] = useState(user.nickname || '');
  const [bio, setBio] = useState(user.bio || '');
  const [currentVibe, setCurrentVibe] = useState<VibeType>(user.currentVibe || null);
  const [isPrivate, setIsPrivate] = useState(user.isPrivate || false);
  const [showPresence, setShowPresence] = useState(user.showPresence !== false);
  const [avatarFile, setAvatarFile] = useState<File | Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [profileMusic, setProfileMusic] = useState<MusicInfo | null>(user.profileMusic || null);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [tempImageSource, setTempImageSource] = useState<string | null>(null);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);

  const [error, setError] = useState('');
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isOpen) {
      setUsername(user.username);
      setNickname(user.nickname || '');
      setBio(user.bio || '');
      setCurrentVibe(user.currentVibe || null);
      setIsPrivate(user.isPrivate || false);
      setShowPresence(user.showPresence !== false);
      setAvatarFile(null);
      setAvatarPreview(null);
      setProfileMusic(user.profileMusic || null);
      setError('');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const canChangeUsername = () => {
    if (!user.lastUsernameChange) return true;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    return (Date.now() - user.lastUsernameChange.seconds * 1000) > thirtyDaysInMs;
  };

  const checkUsernameAvailable = async (name: string) => {
    if (name.toLowerCase() === user.username.toLowerCase()) return true;
    const q = query(collection(db, 'users'), where('username_lowercase', '==', name.toLowerCase()), limit(1));
    const snap = await getDocs(q);
    return snap.empty;
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsProcessingAvatar(true);
      setError('');

      try {
          let sourceFile: File | Blob = file;
          if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
              const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
              sourceFile = Array.isArray(converted) ? converted[0] : converted;
          }

          const reader = new FileReader();
          reader.onload = (ev) => {
              setTempImageSource(ev.target?.result as string);
              setIsEditorOpen(true);
              setIsProcessingAvatar(false);
          };
          reader.readAsDataURL(sourceFile);
      } catch (err) {
          console.error(err);
          setError("Erro ao carregar foto.");
          setIsProcessingAvatar(false);
      }
    }
  };

  const handleSaveEditor = (processedBlob: Blob, previewUrl: string) => {
      setAvatarFile(processedBlob);
      setAvatarPreview(previewUrl);
      setIsEditorOpen(false);
      setTempImageSource(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username !== user.username) {
        if (!canChangeUsername()) {
            setError(t('editProfile.usernameCooldown'));
            return;
        }
        const available = await checkUsernameAvailable(username);
        if (!available) {
            setError("Este nome de usuário já está em uso.");
            return;
        }
    }

    try {
        await onUpdate({ username, nickname, bio, avatarFile, avatarPreview, isPrivate, showPresence, profileMusic, currentVibe });
    } catch (err) {
        console.error(err);
        setError(t('editProfile.updateError'));
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 overflow-y-auto no-scrollbar" onClick={onClose}>
        <div className="bg-white dark:bg-zinc-950 rounded-[3rem] shadow-xl w-full max-w-md border dark:border-zinc-800 my-8 overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b dark:border-zinc-900 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
            <h2 className="text-sm font-black uppercase tracking-widest">{t('editProfile.title')}</h2>
            <button onClick={onClose} className="text-zinc-400 text-2xl font-light hover:text-indigo-500 transition-colors">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="flex flex-col items-center gap-6">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-sky-400 to-indigo-500">
                          <img src={avatarPreview || user.avatar} alt="Profile" className={`w-full h-full rounded-full object-cover border-2 border-white dark:border-black ${isProcessingAvatar ? 'opacity-30' : ''}`} />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-full">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth={2}/></svg>
                      </div>
                      {isProcessingAvatar && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-6 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>}
                  </div>
                  <input ref={fileInputRef} type="file" onChange={handleAvatarChange} className="hidden" accept="image/*" />
              </div>

              <div className="space-y-6">
                  <TextInput id="username" label={t('editProfile.usernameLabel')} value={username} onChange={(e) => setUsername(e.target.value)} disabled={!canChangeUsername() && username === user.username} className="!rounded-2xl" />
                  <TextInput id="nickname" label={t('editProfile.nicknameLabel')} value={nickname} onChange={(e) => setNickname(e.target.value)} className="!rounded-2xl" />
                  <TextAreaInput id="bio" label={t('editProfile.bioLabel')} value={bio} onChange={(e) => setBio(e.target.value)} className="!rounded-3xl" />

                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">{t('editProfile.vibeLabel')}</label>
                      <div className="grid grid-cols-3 gap-2">
                          {VIBE_OPTIONS.map(v => (
                              <button key={v.id} type="button" onClick={() => setCurrentVibe(currentVibe === v.id ? null : v.id as VibeType)} className={`flex flex-col items-center p-4 rounded-3xl border transition-all ${currentVibe === v.id ? `${v.color} border-zinc-900 text-white shadow-lg scale-105` : 'bg-zinc-50 dark:bg-zinc-900 border-transparent text-zinc-500 opacity-60 hover:opacity-100'}`}>
                                  <span className="text-2xl mb-1">{v.emoji}</span>
                                  <span className="text-[8px] font-black uppercase tracking-tighter">{t(`editProfile.${v.label}`)}</span>
                              </button>
                          ))}
                      </div>
                  </div>

                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">{t('editProfile.profileMusic')}</label>
                      {profileMusic ? (
                          <div className="flex items-center gap-4 p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 animate-fade-in">
                              <img src={profileMusic.capa} className="w-12 h-12 rounded-xl shadow-md" alt={profileMusic.nome}/>
                              <div className="flex-grow overflow-hidden">
                                  <p className="font-black text-xs truncate tracking-tight">{profileMusic.nome}</p>
                                  <p className="text-[10px] text-zinc-500 font-bold uppercase truncate tracking-widest opacity-60">{profileMusic.artista}</p>
                              </div>
                               <button type="button" onClick={() => setProfileMusic(null)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5}/></svg></button>
                          </div>
                      ) : (
                          <button 
                            type="button" 
                            onClick={() => setIsMusicModalOpen(true)}
                            className="w-full p-4 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:border-sky-500 hover:text-sky-500 transition-all"
                          >
                              {t('createPost.addMusic')}
                          </button>
                      )}
                  </div>

                  <div className="p-6 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900/50 border dark:border-zinc-800 flex items-center justify-between">
                      <div className="space-y-1">
                          <label htmlFor="private-account" className="font-black text-xs uppercase tracking-widest">{t('editProfile.privateAccount')}</label>
                          <p className="text-[10px] text-zinc-500 font-medium leading-tight max-w-[180px]">{t('editProfile.privateAccountInfo')}</p>
                      </div>
                      <label htmlFor="private-account" className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" id="private-account" className="sr-only peer" checked={isPrivate} onChange={() => setIsPrivate(!isPrivate)} />
                          <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 dark:peer-focus:ring-sky-800 rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-700 peer-checked:bg-sky-500"></div>
                      </label>
                  </div>

                  <div className="p-6 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900/50 border dark:border-zinc-800 flex items-center justify-between">
                      <div className="space-y-1">
                          <label htmlFor="show-presence" className="font-black text-xs uppercase tracking-widest">Mostrar Atividade</label>
                          <p className="text-[10px] text-zinc-500 font-medium leading-tight max-w-[180px]">Permitir que outros vejam quando você está online ou sua última atividade.</p>
                      </div>
                      <label htmlFor="show-presence" className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" id="show-presence" className="sr-only peer" checked={showPresence} onChange={() => setShowPresence(!showPresence)} />
                          <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 dark:peer-focus:ring-sky-800 rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-700 peer-checked:bg-indigo-500"></div>
                      </label>
                  </div>
              </div>

              <div className="pt-4 space-y-4">
                  {error && <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest animate-shake">{error}</p>}
                  <Button type="submit" disabled={isSubmitting || isProcessingAvatar} className="!py-5 !rounded-[2rem] !font-black !uppercase !tracking-[0.2em] shadow-xl shadow-sky-500/10 active:scale-95 transition-all">
                      {isSubmitting ? t('editProfile.submitting') : t('editProfile.submit')}
                  </Button>
              </div>
          </form>
        </div>
      </div>
      
      <AvatarEditorModal isOpen={isEditorOpen} imageSource={tempImageSource || ''} onClose={() => { setIsEditorOpen(false); setTempImageSource(null); }} onSave={handleSaveEditor} />
      <AddMusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} postId="" onMusicAdded={(music) => { setProfileMusic(music); setIsMusicModalOpen(false); }} isProfileModal={true} />
    </>
  );
};

export default EditProfileModal;