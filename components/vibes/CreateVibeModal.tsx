
import React, { useState, useRef, useEffect } from 'react';
import {
    auth,
    db,
    storage,
    addDoc,
    collection,
    serverTimestamp,
    storageRef,
    uploadBytes,
    getDownloadURL,
    uploadString,
} from '../../firebase';
import Button from '../common/Button';
import TextAreaInput from '../common/TextAreaInput';
import { useLanguage } from '../../context/LanguageContext';

interface CreateVibeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVibeCreated: () => void;
}

const CreateVibeModal: React.FC<CreateVibeModalProps> = ({ isOpen, onClose, onVibeCreated }) => {
    const { t } = useLanguage();
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [caption, setCaption] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setMediaFile(null);
            setMediaPreview(null);
            setMediaType(null);
            setCaption('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setError('');

            if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = function() {
                    window.URL.revokeObjectURL(video.src);
                    if (video.duration > 60) {
                        setError(t('createVibe.videoTooLong'));
                        return;
                    }
                    setMediaType('video');
                    setMediaFile(file);
                    setMediaPreview(URL.createObjectURL(file));
                };
                video.onerror = function() { setError(t('createVibe.invalidFileError')); };
                video.src = URL.createObjectURL(file);
            } else if (file.type.startsWith('image/')) {
                setMediaType('image');
                setMediaFile(file);
                const reader = new FileReader();
                reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
                reader.readAsDataURL(file);
            } else {
                setError(t('createVibe.invalidFileError'));
            }
        }
    };
    
    const triggerFileInput = () => { fileInputRef.current?.click(); };

    const handleSubmit = async () => {
        const currentUser = auth.currentUser;
        if (!mediaFile || !currentUser || !mediaPreview) return;
        setSubmitting(true);
        setError('');
        try {
            const path = `vibes/${currentUser.uid}/${Date.now()}-${mediaFile.name}`;
            const mediaUploadRef = storageRef(storage, path);
            let downloadURL = '';
            if (mediaType === 'image') {
                await uploadString(mediaUploadRef, mediaPreview, 'data_url');
                downloadURL = await getDownloadURL(mediaUploadRef);
            } else {
                await uploadBytes(mediaUploadRef, mediaFile);
                downloadURL = await getDownloadURL(mediaUploadRef);
            }
            await addDoc(collection(db, 'vibes'), {
                userId: currentUser.uid,
                videoUrl: downloadURL,
                mediaType: mediaType,
                caption,
                likes: [],
                commentsCount: 0,
                createdAt: serverTimestamp(),
            });
            onVibeCreated();
            onClose();
        } catch (err: any) {
            console.error("Error creating Vibe content:", err?.message || err);
            setError(t('createPost.publishError'));
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-xl w-full max-w-4xl border dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                    <h2 className="text-sm font-black uppercase tracking-widest">{t('createVibe.title')}</h2>
                    {mediaPreview && (
                         <Button onClick={handleSubmit} disabled={submitting} className="!w-auto !py-2 !px-6 !rounded-full !text-[10px] !font-black !uppercase shadow-lg">
                            {submitting ? t('createVibe.publishing') : t('createVibe.publish')}
                        </Button>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto no-scrollbar">
                    {mediaPreview ? (
                        <div className="flex flex-col md:flex-row h-full">
                            <div className="w-full md:w-1/2 bg-black flex items-center justify-center min-h-[40vh]">
                                {mediaType === 'video' ? <video src={mediaPreview} controls className="max-h-full max-w-full object-contain" /> : <img src={mediaPreview} className="max-h-full max-w-full object-contain" />}
                            </div>
                            <div className="w-full md:w-1/2 p-8 flex flex-col gap-6">
                                <div className="flex items-center gap-3">
                                    <img src={auth.currentUser?.photoURL || ''} alt="User" className="w-10 h-10 rounded-full object-cover border dark:border-zinc-800"/>
                                    <p className="font-black text-sm tracking-tight">@{auth.currentUser?.displayName}</p>
                                </div>
                                <TextAreaInput id="caption" label={t('createVibe.captionLabel')} value={caption} onChange={(e) => setCaption(e.target.value)} className="!min-h-[150px] !rounded-3xl" />
                                {error && <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest">{error}</p>}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-20 gap-8">
                            <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] flex items-center justify-center text-sky-500 shadow-inner">
                                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" /></svg>
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-black tracking-tight">{t('createVibe.title')}</h3>
                                <p className="text-zinc-500 text-sm font-medium">Compartilhe um vídeo vertical de até 60s ou uma foto especial.</p>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleMediaChange} className="hidden" accept="video/*,image/*" />
                            <Button onClick={triggerFileInput} className="!w-auto !px-10 !py-4 !rounded-full !font-black !uppercase !tracking-widest shadow-xl shadow-sky-500/10">Escolher Mídia</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
};

export default CreateVibeModal;
