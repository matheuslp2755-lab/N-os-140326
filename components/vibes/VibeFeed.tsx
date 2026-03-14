
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, getDoc, onSnapshot, addDoc, serverTimestamp, deleteDoc, increment } from '../../firebase';
import { auth } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import { GoogleGenAI } from "@google/genai";
import { VerifiedBadge } from '../profile/UserProfile';
import Button from '../common/Button';
import { FaceMesh } from '@mediapipe/face_mesh';

type VibeType = {
    id: string;
    userId: string;
    videoUrl: string;
    mediaType?: 'image' | 'video';
    caption: string;
    likes: string[];
    commentsCount: number;
    createdAt: any;
    user?: {
        username: string;
        avatar: string;
        isVerified?: boolean;
    };
};

const VibeItem: React.FC<{ vibe: VibeType; isActive: boolean; onEnded?: () => void }> = ({ vibe, isActive, onEnded }) => {
    const { t } = useLanguage();
    const { isGlobalMuted, setGlobalMuted } = useCall();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<any | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showHeartAnim, setShowHeartAnim] = useState(false);

    const [isTranslated, setIsTranslated] = useState(false);
    const [translatedText, setTranslatedText] = useState<string | null>(null);
    const [shouldShowTranslate, setShouldShowTranslate] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);

    const currentUser = auth.currentUser;
    const isLiked = vibe.likes.includes(currentUser?.uid || '');
    const isAuthor = currentUser?.uid === vibe.userId;

    useEffect(() => {
        const detect = async () => {
            if (!vibe.caption || vibe.caption.length < 5 || !process.env.GEMINI_API_KEY) return;
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
                const res = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: `O texto "${String(vibe.caption)}" está em Português? Responda apenas SIM ou NAO`,
                });
                if (res.text?.includes("NAO")) setShouldShowTranslate(true);
            } catch (e) {}
        };
        if (isActive) detect();
    }, [isActive, vibe.caption]);

    const handleTranslate = async () => {
        if (isTranslated) { setIsTranslated(false); return; }
        if (translatedText) { setIsTranslated(true); return; }
        setIsTranslating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Traduza para PT-BR: "${vibe.caption}"`,
            });
            if (response.text) { setTranslatedText(response.text.trim()); setIsTranslated(true); }
        } catch (e) { console.error(e); } finally { setIsTranslating(false); }
    };

    useEffect(() => {
        if (isActive && vibe.mediaType !== 'image' && videoRef.current) {
            videoRef.current.play().catch(() => {});
        } else if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    }, [isActive, vibe.mediaType]);

    useEffect(() => {
        if (showComments) {
            const q = query(collection(db, 'vibes', vibe.id, 'comments'), orderBy('timestamp', 'desc'));
            return onSnapshot(q, (snap) => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        }
    }, [showComments, vibe.id]);

    const handleLike = async () => {
        if (!currentUser) return;
        const ref = doc(db, 'vibes', vibe.id);
        await updateDoc(ref, { likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser) return;
        if (replyingTo) {
            await addDoc(collection(db, 'vibes', vibe.id, 'comments', replyingTo.id, 'replies'), {
                userId: currentUser.uid, username: currentUser.displayName, avatar: currentUser.photoURL,
                text: newComment.trim(), timestamp: serverTimestamp()
            });
            setReplyingTo(null);
        } else {
            await addDoc(collection(db, 'vibes', vibe.id, 'comments'), {
                userId: currentUser.uid, username: currentUser.displayName, avatar: currentUser.photoURL,
                text: newComment.trim(), timestamp: serverTimestamp()
            });
        }
        setNewComment('');
        await updateDoc(doc(db, 'vibes', vibe.id), { commentsCount: increment(1) });
    };

    const handleDelete = async () => {
        if (!isAuthor) return;
        if (!window.confirm(`Excluir permanentemente?`)) return;
        try { await deleteDoc(doc(db, 'vibes', vibe.id)); } catch (e) { console.error(e); }
    };

    const handleDownload = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const response = await fetch(vibe.videoUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `neos-camera-${Date.now()}.mp4`;
            link.click();
        } catch (e) { console.error("Download fail", e); }
        finally { setIsDownloading(false); }
    };

    return (
        <div className="relative w-full h-full snap-start bg-black flex items-center justify-center overflow-hidden">
            {vibe.mediaType === 'image' ? (
                <img src={vibe.videoUrl} className="w-full h-full object-contain" alt="Vibe Content" onLoad={() => { setIsLoaded(true); if(isActive && onEnded) setTimeout(onEnded, 5000); }} />
            ) : (
                <video ref={videoRef} src={vibe.videoUrl} className="w-full h-full object-cover" loop={!onEnded} playsInline muted={isGlobalMuted} onLoadedData={() => setIsLoaded(true)} onEnded={onEnded} />
            )}

            {showHeartAnim && (
                <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none animate-ping">
                    <svg className="w-32 h-32 text-red-500 fill-current drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]" viewBox="0 0 24 24">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </div>
            )}
            
            <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-30">
                <div className="p-0.5 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 shadow-lg">
                    <img src={vibe.user?.avatar} className="w-12 h-12 rounded-full border-2 border-black object-cover" alt="User" />
                </div>
                
                <button onClick={handleLike} className="flex flex-col items-center">
                    <svg className={`w-9 h-9 drop-shadow-lg ${isLiked ? 'text-red-500 fill-current' : 'text-white'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    <span className="text-white text-xs font-black drop-shadow-md mt-1">{vibe.likes.length}</span>
                </button>
                
                <button onClick={() => setShowComments(true)} className="flex flex-col items-center">
                    <svg className="w-9 h-9 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" /></svg>
                    <span className="text-white text-xs font-black drop-shadow-md mt-1">{vibe.commentsCount}</span>
                </button>
                
                <button onClick={handleDownload} disabled={isDownloading} className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white shadow-xl border border-white/20 active:scale-95 transition-all">
                    {isDownloading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                </button>
                
                {isAuthor && <button onClick={handleDelete} className="p-3 bg-red-500/20 rounded-full text-red-500 border border-red-500/30 active:scale-95 transition-all"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
                
                <button onClick={() => setGlobalMuted(!isGlobalMuted)} className="p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 transition-all">
                    {isGlobalMuted ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}
                </button>
            </div>

            <div className="absolute left-4 bottom-10 z-30 text-white max-w-[85%] animate-slide-up">
                <h3 className="font-black text-base flex items-center gap-1.5 mb-3 drop-shadow-xl">
                    @{vibe.user?.username} 
                    {vibe.user?.isVerified && <VerifiedBadge className="w-4 h-4" />}
                </h3>
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-bold leading-snug drop-shadow-xl">{isTranslated ? translatedText : vibe.caption}</p>
                    {shouldShowTranslate && (
                        <button onClick={handleTranslate} disabled={isTranslating} className="text-[9px] font-black text-sky-400 uppercase tracking-[0.2em] text-left hover:text-white transition-colors">
                            {isTranslating ? "Sincronizando..." : (isTranslated ? "Ver original" : "Ver tradução")}
                        </button>
                    )}
                </div>
            </div>

            {showComments && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-fade-in" onClick={() => setShowComments(false)}>
                    <div className="bg-zinc-900 w-full rounded-t-[3rem] h-[80vh] flex flex-col p-8 shadow-2xl animate-slide-up border-t border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mb-8"></div>
                        <h4 className="text-white font-black text-center text-xs uppercase tracking-[0.3em] mb-8">Comentários Vibe</h4>
                        <div className="flex-grow overflow-y-auto no-scrollbar space-y-8">
                            {comments.length > 0 ? comments.map(c => (
                                <CommentItem key={c.id} comment={c} vibeId={vibe.id} onReply={() => setReplyingTo(c)} isVibeOwner={isAuthor} />
                            )) : (
                                <div className="text-center py-20 opacity-30">
                                    <p className="text-xs font-black uppercase tracking-widest">Sem comentários ainda</p>
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleAddComment} className="mt-8 flex flex-col gap-4">
                            {replyingTo && (
                                <div className="flex items-center justify-between bg-zinc-800 px-5 py-2.5 rounded-2xl animate-fade-in">
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Respondendo @{replyingTo.username}</span>
                                    <button onClick={() => setReplyingTo(null)} className="text-zinc-500 font-bold text-xs hover:text-white transition-colors">X</button>
                                </div>
                            )}
                            <div className="flex items-center gap-4 bg-zinc-800 rounded-[2rem] p-2 pl-6">
                                <input 
                                    value={newComment} 
                                    onChange={e => setNewComment(e.target.value)} 
                                    placeholder={replyingTo ? "Sua resposta..." : "Adicionar comentário..."} 
                                    className="flex-grow bg-transparent text-sm text-white outline-none placeholder:text-zinc-500 font-medium" 
                                />
                                <button type="submit" disabled={!newComment.trim()} className="bg-sky-500 text-white p-3 rounded-full shadow-lg shadow-sky-500/20 active:scale-90 transition-all disabled:opacity-50">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const CommentItem: React.FC<{ comment: any, vibeId: string, onReply: () => void, isVibeOwner: boolean }> = ({ comment, vibeId, onReply, isVibeOwner }) => {
    const isMine = auth.currentUser?.uid === comment.userId;
    const handleDelete = async () => {
        if(window.confirm("Deseja apagar este comentário?")) {
            await deleteDoc(doc(db, 'vibes', vibeId, 'comments', comment.id));
            await updateDoc(doc(db, 'vibes', vibeId), { commentsCount: increment(-1) });
        }
    };
    return (
        <div className="flex flex-col group/comment animate-fade-in">
            <div className="flex gap-4">
                <img src={comment.avatar} className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/5" alt="Avatar" />
                <div className="flex flex-col flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-black text-white">@{comment.username}</p>
                        {comment.isVerified && <VerifiedBadge className="w-3 h-3" />}
                    </div>
                    <p className="text-sm text-zinc-300 font-medium leading-relaxed">{comment.text}</p>
                    <div className="flex gap-6 mt-2">
                        <button onClick={onReply} className="text-[9px] font-black text-zinc-500 hover:text-sky-500 uppercase tracking-widest transition-colors">Responder</button>
                        {(isMine || isVibeOwner) && <button onClick={handleDelete} className="text-[9px] font-black text-red-500/50 hover:text-red-500 uppercase tracking-widest transition-colors">Excluir</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const VibeFeed: React.FC = () => {
    const { t } = useLanguage();
    const [vibes, setVibes] = useState<VibeType[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [autoScroll, setAutoScroll] = useState(false);
    const [blinkControl, setBlinkControl] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const faceMeshRef = useRef<FaceMesh | null>(null);
    const gestureCooldownRef = useRef<boolean>(false);
    const [blinkDetected, setBlinkDetected] = useState(false);
    const [eyeState, setEyeState] = useState<{ left: boolean, right: boolean }>({ left: false, right: false });
    
    useEffect(() => {
        const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(30));
        return onSnapshot(q, async (snap) => {
            const items = await Promise.all(snap.docs.map(async d => {
                const data = d.data();
                const u = await getDoc(doc(db, 'users', data.userId));
                return { id: d.id, ...data, user: u.exists() ? u.data() : { username: 'user', avatar: '' } } as VibeType;
            }));
            setVibes(items);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (blinkControl) {
            startBlinkDetection();
        } else {
            stopBlinkDetection();
        }
        return () => stopBlinkDetection();
    }, [blinkControl]);

    const startBlinkDetection = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }

            const faceMesh = new FaceMesh({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
            });

            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            faceMesh.onResults((results) => {
                if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                    const landmarks = results.multiFaceLandmarks[0];
                    
                    // Eye landmarks for blink detection
                    // Left eye: 159 (top), 145 (bottom)
                    // Right eye: 386 (top), 374 (bottom)
                    const leftEyeTop = landmarks[159];
                    const leftEyeBottom = landmarks[145];
                    const rightEyeTop = landmarks[386];
                    const rightEyeBottom = landmarks[374];

                    const leftDist = Math.abs(leftEyeTop.y - leftEyeBottom.y);
                    const rightDist = Math.abs(rightEyeTop.y - rightEyeBottom.y);

                    // Threshold for blink/wink (eyes closed)
                    const isLeftClosed = leftDist < 0.02;
                    const isRightClosed = rightDist < 0.02;
                    const isBlinking = isLeftClosed && isRightClosed;
                    const isWinkLeft = isLeftClosed && !isRightClosed;
                    const isWinkRight = !isLeftClosed && isRightClosed;
                    
                    setEyeState({ left: isLeftClosed, right: isRightClosed });
                    setBlinkDetected(isBlinking || isWinkLeft || isWinkRight);

                    if (!gestureCooldownRef.current) {
                        if (isBlinking || isWinkRight) {
                            scrollToNextManual();
                            gestureCooldownRef.current = true;
                            setTimeout(() => { gestureCooldownRef.current = false; }, 600);
                        } else if (isWinkLeft) {
                            scrollToPrevManual();
                            gestureCooldownRef.current = true;
                            setTimeout(() => { gestureCooldownRef.current = false; }, 600);
                        }
                    }
                } else {
                    setBlinkDetected(false);
                }
            });

            faceMeshRef.current = faceMesh;

            const process = async () => {
                if (videoRef.current && faceMeshRef.current && blinkControl) {
                    await faceMeshRef.current.send({ image: videoRef.current });
                    requestAnimationFrame(process);
                }
            };
            process();
        } catch (err) {
            console.error("Blink detection error:", err);
            setBlinkControl(false);
        }
    };

    const stopBlinkDetection = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        if (faceMeshRef.current) {
            faceMeshRef.current.close();
            faceMeshRef.current = null;
        }
    };

    const handleScroll = () => {
        if (!containerRef.current) return;
        const idx = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        if (idx !== activeIdx) setActiveIdx(idx);
    };

    const scrollToNext = () => {
        if (!containerRef.current || !autoScroll) return;
        const nextIdx = activeIdx + 1;
        if (nextIdx < vibes.length) {
            containerRef.current.scrollTo({
                top: (activeIdx + 1) * containerRef.current.clientHeight,
                behavior: 'smooth'
            });
        }
    };

    const scrollToNextManual = () => {
        if (!containerRef.current) return;
        const nextIdx = activeIdx + 1;
        if (nextIdx < vibes.length) {
            containerRef.current.scrollTo({
                top: nextIdx * containerRef.current.clientHeight,
                behavior: 'smooth'
            });
        }
    };

    const scrollToPrevManual = () => {
        if (!containerRef.current) return;
        const prevIdx = activeIdx - 1;
        if (prevIdx >= 0) {
            containerRef.current.scrollTo({
                top: prevIdx * containerRef.current.clientHeight,
                behavior: 'smooth'
            });
        }
    };

    if (loading) return <div className="h-full bg-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;
    
    if (vibes.length === 0) return (
        <div className="h-full bg-black flex flex-col items-center justify-center gap-6 p-8 text-center animate-fade-in">
            <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center text-zinc-700">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-sm font-black text-zinc-500 uppercase tracking-widest">{t('vibeFeed.noVibes')}</p>
        </div>
    );

    return (
        <div className="relative h-full w-full bg-black">
            {/* Blink Control Preview */}
            {blinkControl && (
                <div className="absolute top-24 left-6 z-50 w-24 h-32 bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-fade-in">
                    <video 
                        ref={videoRef} 
                        className="w-full h-full object-cover scale-x-[-1] opacity-40" 
                        playsInline 
                        muted 
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="flex gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${eyeState.left ? 'bg-sky-500 border-sky-400 scale-110 shadow-[0_0_10px_#0ea5e9]' : 'bg-white/10 border-white/30'}`}>
                                <div className={`w-4 h-0.5 bg-white rounded-full transition-all ${eyeState.left ? 'opacity-100' : 'opacity-30'}`} />
                            </div>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${eyeState.right ? 'bg-sky-500 border-sky-400 scale-110 shadow-[0_0_10px_#0ea5e9]' : 'bg-white/10 border-white/30'}`}>
                                <div className={`w-4 h-0.5 bg-white rounded-full transition-all ${eyeState.right ? 'opacity-100' : 'opacity-30'}`} />
                            </div>
                        </div>
                        <p className="text-[8px] font-black text-white/60 uppercase tracking-widest mt-1">
                            {eyeState.left && eyeState.right ? 'PRÓXIMO!' : (eyeState.left ? 'VOLTAR' : (eyeState.right ? 'PRÓXIMO' : 'PISQUE'))}
                        </p>
                    </div>
                </div>
            )}

            <div className="absolute top-6 left-6 z-40 flex flex-col gap-3">
                <button 
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border transition-all active:scale-95 ${autoScroll ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' : 'bg-black/40 border-white/10 text-white/60'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${autoScroll ? 'bg-sky-500 animate-pulse' : 'bg-white/40'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {autoScroll ? 'Auto-Rolagem ON' : 'Auto-Rolagem OFF'}
                    </span>
                </button>

                <button 
                    onClick={() => setBlinkControl(!blinkControl)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border transition-all active:scale-95 ${blinkControl ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-black/40 border-white/10 text-white/60'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${blinkControl ? 'bg-indigo-500 animate-pulse' : 'bg-white/40'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {blinkControl ? 'Piscar Olho ON' : 'Piscar Olho OFF'}
                    </span>
                </button>
            </div>

            <div ref={containerRef} onScroll={handleScroll} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black">
                {vibes.map((v, i) => (
                    <div key={v.id} className="h-full w-full snap-start relative">
                        <VibeItem vibe={v} isActive={i === activeIdx} onEnded={scrollToNext} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VibeFeed;
