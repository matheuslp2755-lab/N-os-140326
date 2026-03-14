
import React, { useState, useEffect, useRef } from 'react';
import { 
    auth, db, doc, collection, query, orderBy, onSnapshot, serverTimestamp, 
    updateDoc, addDoc, storage, storageRef, uploadBytes, getDownloadURL, deleteDoc, increment
} from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import { VerifiedBadge } from '../profile/UserProfile';
import PhotoEditorModal from './PhotoEditorModal';
import heic2any from 'heic2any';

const ChatWindow: React.FC<{ conversationId: string | null; onBack: () => void; isCurrentUserAnonymous?: boolean }> = ({ conversationId, onBack, isCurrentUserAnonymous }) => {
    const { t } = useLanguage();
    const { startCall, joinCall } = useCall();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [convData, setConvData] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const [showAttachments, setShowAttachments] = useState(false);
    const [viewLimit, setViewLimit] = useState<number | null>(null);
    const [selectedEfimeralMedia, setSelectedEfimeralMedia] = useState<any | null>(null);

    // Editor de Fotos
    const [editorImage, setEditorImage] = useState<string | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Estados de Áudio
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    
    const currentUser = auth.currentUser;
    
    const otherUserId = convData?.participants?.find((p: string) => p !== currentUser?.uid);
    const otherUser = convData?.participantInfo?.[otherUserId || ''];
    const otherPresence = otherUser?.showPresence !== false;

    useEffect(() => {
        if (!conversationId) return;
        const unsubConv = onSnapshot(doc(db, 'conversations', conversationId), (snap) => {
            const data = snap.data();
            setConvData(data);
            if (data && otherUserId) {
                setIsOtherTyping(data.typing?.[otherUserId] === true);
            }
        });
        const q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('timestamp', 'asc'));
        const unsubMsgs = onSnapshot(q, (snap) => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubConv(); unsubMsgs(); };
    }, [conversationId, otherUserId]);

    const handleTyping = (isTyping: boolean) => {
        if (!conversationId || !currentUser) return;
        updateDoc(doc(db, 'conversations', conversationId), {
            [`typing.${currentUser.uid}`]: isTyping
        }).catch(() => {});
    };

    useEffect(() => {
        if (!newMessage.trim()) {
            handleTyping(false);
            return;
        }
        handleTyping(true);
        const timeout = setTimeout(() => handleTyping(false), 3000);
        return () => clearTimeout(timeout);
    }, [newMessage]);

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const sendMessage = async (data: { text?: string, mediaUrl?: string, mediaType?: string, location?: any, viewLimit?: number | null }) => {
        if (!conversationId || !currentUser || !convData) return;

        const msgPayload = {
            senderId: currentUser.uid,
            timestamp: serverTimestamp(),
            viewersCount: {},
            ...data
        };

        await addDoc(collection(db, 'conversations', conversationId, 'messages'), msgPayload);
        
        await updateDoc(doc(db, 'conversations', conversationId), {
            lastMessage: { 
                text: data.mediaType === 'audio' ? '🎤 Áudio' : (data.text || `Enviou uma mídia ${data.viewLimit ? 'efêmera' : ''}`), 
                senderId: currentUser.uid, 
                timestamp: serverTimestamp(),
                mediaType: data.mediaType
            },
            timestamp: serverTimestamp()
        });
        
        setViewLimit(null);
    };

    const handleSendText = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text) return;
        setNewMessage('');
        await sendMessage({ text });
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !conversationId) return;

        setIsUploading(true);
        setShowAttachments(false);

        try {
            let processedFile: File | Blob = file;
            if (file.name.toLowerCase().endsWith('.heic')) {
                const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
                processedFile = Array.isArray(converted) ? converted[0] : converted;
            }

            if (processedFile.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setEditorImage(ev.target?.result as string);
                    setIsEditorOpen(true);
                    setIsUploading(false);
                };
                reader.readAsDataURL(processedFile);
            } else {
                const path = `chats/${conversationId}/${Date.now()}_${file.name}`;
                const ref = storageRef(storage, path);
                await uploadBytes(ref, processedFile);
                const url = await getDownloadURL(ref);
                await sendMessage({ mediaUrl: url, mediaType: 'video', viewLimit: viewLimit });
                setIsUploading(false);
            }
        } catch (err) {
            console.error(err);
            setIsUploading(false);
        }
    };

    const handleEditorSave = async (blob: Blob) => {
        if (!conversationId) return;
        setIsUploading(true);
        setIsEditorOpen(false);
        try {
            const path = `chats/${conversationId}/${Date.now()}.jpg`;
            const ref = storageRef(storage, path);
            await uploadBytes(ref, blob);
            const url = await getDownloadURL(ref);
            await sendMessage({ mediaUrl: url, mediaType: 'image', viewLimit: viewLimit });
        } catch (e) { console.error(e); }
        finally { setIsUploading(false); }
    };

    // FUNÇÕES DE ÁUDIO
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size < 1000) return; 
                setIsUploading(true);
                const path = `chats/audio/${conversationId}/${Date.now()}.webm`;
                const ref = storageRef(storage, path);
                await uploadBytes(ref, audioBlob);
                const url = await getDownloadURL(ref);
                await sendMessage({ mediaUrl: url, mediaType: 'audio' });
                setIsUploading(false);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = window.setInterval(() => { setRecordingTime(prev => prev + 1); }, 1000);
        } catch (err) { alert("Permita o acesso ao microfone."); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = null; 
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const sendLocation = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(async (pos) => {
            await sendMessage({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude }, text: "📍 Localização ao vivo" });
            setShowAttachments(false);
        });
    };

    const registerView = async (msgId: string) => {
        if (!currentUser || !conversationId) return;
        await updateDoc(doc(db, 'conversations', conversationId, 'messages', msgId), { [`viewersCount.${currentUser.uid}`]: increment(1) });
    };

    const handleOpenEfimeral = (msg: any) => {
        const count = msg.viewersCount?.[currentUser?.uid || ''] || 0;
        if (count >= msg.viewLimit) return;
        setSelectedEfimeralMedia(msg);
    };

    const closeEfimeral = () => {
        if (selectedEfimeralMedia) { registerView(selectedEfimeralMedia.id); setSelectedEfimeralMedia(null); }
    };

    if (!conversationId || !convData) return null;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black relative">
            <header className="flex items-center justify-between p-4 border-b dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <div className="relative"><img src={otherUser?.avatar} className="w-10 h-10 rounded-full object-cover border dark:border-zinc-800" /></div>
                    <div className="flex flex-col">
                        <span className="font-black text-sm flex items-center gap-1">{otherUser?.username}{otherUser?.isVerified && <VerifiedBadge className="w-3.5 h-3.5" />}</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                            {isOtherTyping ? (
                                <span className="text-indigo-500 animate-pulse">Digitando...</span>
                            ) : (
                                otherPresence && otherUser?.status === 'online' ? 'Online' : 'Conectado'
                            )}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => startCall({ id: otherUserId, ...otherUser }, false)} className="p-2.5 text-zinc-600 dark:text-zinc-400 hover:text-sky-500 rounded-xl transition-all"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
                    <button onClick={() => startCall({ id: otherUserId, ...otherUser }, true)} className="p-2.5 text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 rounded-xl transition-all"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                </div>
            </header>

            <div className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar bg-zinc-50 dark:bg-zinc-950/30">
                {messages.map(msg => {
                    const isMine = msg.senderId === currentUser?.uid;
                    const count = msg.viewersCount?.[currentUser?.uid || ''] || 0;
                    const isEfimeral = msg.viewLimit > 0;
                    const isExpired = isEfimeral && count >= msg.viewLimit;
                    return (
                        <div key={msg.id} className={`flex group/msg ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in relative`}>
                            <div className={`max-w-[80%] rounded-[1.5rem] shadow-sm overflow-hidden relative ${isMine ? 'bg-sky-500 text-white rounded-tr-sm' : 'bg-white dark:bg-zinc-900 text-black dark:text-white border dark:border-zinc-800 rounded-tl-sm'}`}>
                                {isEfimeral ? (
                                    <div onClick={() => !isExpired && handleOpenEfimeral(msg)} className={`p-4 flex flex-col items-center justify-center gap-3 cursor-pointer min-w-[240px] transition-all ${isExpired ? 'opacity-40 grayscale' : 'hover:bg-black/5'}`}>
                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isExpired ? 'bg-zinc-200 dark:bg-zinc-800' : 'bg-sky-100 dark:bg-sky-950 text-sky-500 animate-pulse'}`}>
                                            {isExpired ? <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth={2}/></svg> : <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2}/></svg>}
                                        </div>
                                        <div className="text-center"><p className="text-xs font-black uppercase tracking-widest">{isExpired ? 'Mídia Aberta' : `Abre apenas ${msg.viewLimit} vezes`}</p>{!isExpired && <p className="text-[10px] opacity-60">Toque para ver ({count}/{msg.viewLimit})</p>}</div>
                                    </div>
                                ) : (
                                    <>
                                        {msg.mediaType === 'image' && <img src={msg.mediaUrl} className="w-full max-h-80 object-cover cursor-pointer" onClick={() => window.open(msg.mediaUrl)} />}
                                        {msg.mediaType === 'video' && <video src={msg.mediaUrl} controls className="w-full max-h-80 object-cover" />}
                                        {msg.mediaType === 'audio' && <div className="p-3 flex items-center gap-3 min-w-[200px]"><div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><svg className="w-5 h-5 text-current" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.983 3.983 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" /></svg></div><audio src={msg.mediaUrl} controls className="h-8 max-w-[150px]" /></div>}
                                        {msg.location && <a href={`https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`} target="_blank" className="block relative aspect-video w-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden"><div className="absolute inset-0 flex items-center justify-center bg-black/10"><svg className="w-10 h-10 text-red-500 animate-bounce" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg></div><div className="absolute bottom-2 left-2 bg-white/90 dark:bg-zinc-950/90 px-2 py-1 rounded text-[10px] font-black uppercase">Ver Mapa</div></a>}
                                        {msg.text && <div className="p-3.5 text-sm font-medium leading-relaxed">{msg.text}</div>}
                                        {msg.callInviteId && (
                                            <div className="p-3 pt-0">
                                                <button 
                                                    onClick={() => joinCall(msg.callInviteId)}
                                                    className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                                >
                                                    Entrar na Chamada
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            {isMine && <button onClick={async () => { if(window.confirm("Apagar?")) await deleteDoc(doc(db, 'conversations', conversationId, 'messages', msg.id)); }} className="opacity-0 group-hover/msg:opacity-100 p-2 text-zinc-400 hover:text-red-500 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg></button>}
                        </div>
                    );
                })}
                <div ref={scrollRef} />
                {isOtherTyping && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 px-4 py-2 rounded-2xl rounded-tl-none border dark:border-zinc-800 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t dark:border-zinc-800 bg-white dark:bg-black relative">
                {showAttachments && (
                    <div className="absolute bottom-full left-4 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-[2rem] p-4 shadow-2xl animate-slide-up mb-4 flex flex-col gap-2">
                        <button onClick={() => mediaInputRef.current?.click()} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-all"><div className="w-10 h-10 bg-sky-500/10 text-sky-500 rounded-full flex items-center justify-center"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2}/></svg></div><span className="text-sm font-bold">Mídia</span></button>
                        <button onClick={sendLocation} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-all"><div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeWidth={2}/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg></div><span className="text-sm font-bold">Localização</span></button>
                    </div>
                )}
                {isRecording ? (
                    <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900 rounded-full px-6 py-3 animate-fade-in"><div className="flex items-center gap-3"><div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]"></div><span className="text-sm font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">{formatTime(recordingTime)}</span></div><div className="flex items-center gap-6"><button onClick={cancelRecording} className="text-zinc-400 hover:text-red-500 transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button><button onClick={stopRecording} className="p-2 bg-sky-500 text-white rounded-full shadow-lg active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg></button></div></div>
                ) : (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowAttachments(!showAttachments)} className={`p-2.5 rounded-full transition-all ${showAttachments ? 'bg-indigo-500 text-white rotate-45 shadow-lg' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4" /></svg></button>
                        <form onSubmit={handleSendText} className="flex-grow flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-full py-1.5 px-2">
                            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Escreva algo..." className="flex-grow bg-transparent py-1.5 px-4 text-sm outline-none font-medium" />
                            {newMessage.trim() ? (
                                <button type="submit" className="p-2 bg-sky-500 text-white rounded-full disabled:opacity-50 active:scale-90 transition-transform"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" /></svg></button>
                            ) : (
                                <button type="button" onClick={startRecording} className="p-2 text-zinc-500 hover:text-sky-500 transition-colors active:scale-125"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2M11 19v2m2-2v2m-5-2h6" /></svg></button>
                            )}
                        </form>
                    </div>
                )}
            </div>
            
            <input type="file" ref={mediaInputRef} onChange={handleMediaUpload} className="hidden" accept="image/*,video/*" />
            <PhotoEditorModal isOpen={isEditorOpen} imageSource={editorImage || ''} onClose={() => setIsEditorOpen(false)} onSave={handleEditorSave} />

            {selectedEfimeralMedia && (
                <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-0 select-none animate-fade-in" onContextMenu={e => e.preventDefault()}>
                    <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent"><div className="flex items-center gap-3"><div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]"></div><span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Visualização Única</span></div><button onClick={closeEfimeral} className="text-white/40 text-4xl font-thin hover:text-white transition-colors">&times;</button></header>
                    <div className="w-full h-full flex items-center justify-center">{selectedEfimeralMedia.mediaType === 'video' ? <video src={selectedEfimeralMedia.mediaUrl} autoPlay className="max-w-full max-h-full" /> : <img src={selectedEfimeralMedia.mediaUrl} className="max-w-full max-h-full object-contain pointer-events-none" />}</div>
                </div>
            )}
        </div>
    );
};

export default ChatWindow;
