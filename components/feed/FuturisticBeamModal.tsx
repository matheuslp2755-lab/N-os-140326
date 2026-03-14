
import React, { useState, useEffect, useRef } from 'react';
import { auth, db, doc, serverTimestamp, collection, setDoc, deleteDoc, storage, storageRef, uploadBytes, getDownloadURL, onSnapshot, query, limit, orderBy, getDoc } from '../../firebase';
import { Hands, HAND_CONNECTIONS } from '@mediapipe/hands';
import { FaceMesh, FACEMESH_TESSELATION, FACEMESH_RIGHT_EYE, FACEMESH_LEFT_EYE, FACEMESH_LIPS } from '@mediapipe/face_mesh';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

interface FuturisticBeamModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const FuturisticBeamModal: React.FC<FuturisticBeamModalProps> = ({ isOpen, onClose }) => {
    const [mode, setMode] = useState<'selection' | 'scanning'>('selection');
    const [status, setStatus] = useState<'idle' | 'ready' | 'grabbing' | 'holding' | 'releasing' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isBeaming, setIsBeaming] = useState(false);
    const [incomingPhoto, setIncomingPhoto] = useState<string | null>(null);
    
    const [selectedFilter, setSelectedFilter] = useState<string>('none');
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handsRef = useRef<Hands | null>(null);
    const faceMeshRef = useRef<FaceMesh | null>(null);
    const currentUser = auth.currentUser;

    const FILTERS = [
        { id: 'none', label: 'Original', css: 'none' },
        { id: 'vibrant', label: 'Vibrante', css: 'saturate(1.6) contrast(1.1)' },
        { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.2)' },
        { id: 'cyber', label: 'Cyber', css: 'hue-rotate(290deg) saturate(2) brightness(1.1)' },
        { id: 'warm', label: 'Quente', css: 'sepia(0.3) saturate(1.4) brightness(1.05)' },
        { id: 'glitch', label: 'Glitch', css: 'hue-rotate(90deg) contrast(1.5) brightness(1.2)' }
    ];

    const FACE_EFFECTS = [
        { id: 'none', label: 'Sem Efeito' },
        { id: 'cyber_mask', label: 'Máscara Cyber' },
        { id: 'neon_eyes', label: 'Olhos Neon' },
        { id: 'gold_lips', label: 'Lábios de Ouro' },
        { id: 'star_dust', label: 'Poeira Estelar' }
    ];

    const [selectedFaceEffect, setSelectedFaceEffect] = useState<string>('none');

    const getFilterCSS = (id: string) => FILTERS.find(f => f.id === id)?.css || 'none';

    // Hand Gesture State
    const [isHandClosed, setIsHandClosed] = useState(false);
    const [hasGrabbed, setHasGrabbed] = useState(false);
    const lastGestureRef = useRef<boolean>(false);

    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            return;
        }
        if (mode === 'scanning') {
            startCamera();
        }
    }, [isOpen, mode]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            initHands();
            initFaceMesh();
        } catch (err) {
            console.error("Camera error:", err);
            alert("Erro ao acessar a câmera.");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        if (handsRef.current) {
            handsRef.current.close();
            handsRef.current = null;
        }
        if (faceMeshRef.current) {
            faceMeshRef.current.close();
            faceMeshRef.current = null;
        }
    };

    const initFaceMesh = () => {
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
            if (!canvasRef.current || !videoRef.current) return;
            const canvasCtx = canvasRef.current.getContext('2d');
            if (!canvasCtx) return;

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            
            if (results.multiFaceLandmarks) {
                for (const landmarks of results.multiFaceLandmarks) {
                    if (selectedFaceEffect === 'cyber_mask') {
                        drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {color: '#0ea5e9', lineWidth: 0.5});
                    } else if (selectedFaceEffect === 'neon_eyes') {
                        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {color: '#f472b6', lineWidth: 2});
                        drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {color: '#f472b6', lineWidth: 2});
                    } else if (selectedFaceEffect === 'gold_lips') {
                        drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {color: '#fbbf24', lineWidth: 3});
                    } else if (selectedFaceEffect === 'star_dust') {
                        for (let i = 0; i < landmarks.length; i += 10) {
                            const lm = landmarks[i];
                            canvasCtx.beginPath();
                            canvasCtx.arc(lm.x * canvasRef.current.width, lm.y * canvasRef.current.height, 2, 0, 2 * Math.PI);
                            canvasCtx.fillStyle = `rgba(255, 255, 255, ${Math.random()})`;
                            canvasCtx.fill();
                        }
                    }
                }
            }
            canvasCtx.restore();
        });

        faceMeshRef.current = faceMesh;
    };

    const initHands = () => {
        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7,
        });

        hands.onResults((results) => {
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                
                // GESTURE DETECTION: Simple fist detection
                // If fingertips are below middle joints
                const isFist = landmarks[8].y > landmarks[6].y && 
                               landmarks[12].y > landmarks[10].y && 
                               landmarks[16].y > landmarks[14].y && 
                               landmarks[20].y > landmarks[18].y;

                if (isFist !== lastGestureRef.current) {
                    setIsHandClosed(isFist);
                    lastGestureRef.current = isFist;
                }
            } else {
                if (lastGestureRef.current !== false) {
                    setIsHandClosed(false);
                    lastGestureRef.current = false;
                }
            }
        });

        handsRef.current = hands;

        const processVideo = async () => {
            if (videoRef.current && handsRef.current && isOpen && mode === 'scanning') {
                await handsRef.current.send({ image: videoRef.current });
                if (faceMeshRef.current) {
                    await faceMeshRef.current.send({ image: videoRef.current });
                }
                requestAnimationFrame(processVideo);
            }
        };
        processVideo();
    };

    // Listen for global beams
    useEffect(() => {
        if (isOpen && mode === 'scanning') {
            const q = query(collection(db, 'futuristic_beams'), orderBy('timestamp', 'desc'), limit(1));
            const unsub = onSnapshot(q, async (snap) => {
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    const now = Date.now();
                    const beamTime = data.timestamp?.toMillis() || 0;
                    
                    // Only catch beams from the last 30 seconds
                    if (now - beamTime < 30000 && data.senderId !== currentUser?.uid) {
                        // SECURITY CHECK: Mutual Followers
                        if (currentUser) {
                            try {
                                setStatusMessage('Interceptando sinal do espaço...');
                                const isFollowingSender = (await getDoc(doc(db, 'users', currentUser.uid, 'following', data.senderId))).exists();
                                const isFollowedBySender = (await getDoc(doc(db, 'users', currentUser.uid, 'followers', data.senderId))).exists();

                                if (isFollowingSender && isFollowedBySender) {
                                    setIncomingPhoto(data.mediaUrl);
                                    setStatusMessage('Sinal sincronizado com sucesso.');
                                } else {
                                    console.log("Security block: Not mutual followers");
                                    setStatusMessage('Sinal bloqueado: Segurança quântica ativa.');
                                }
                            } catch (err) {
                                console.error("Security check error:", err);
                            }
                        }
                    }
                }
            });
            return () => unsub();
        }
    }, [isOpen, mode, currentUser]);

    // Logic for Grabbing and Releasing
    useEffect(() => {
        if (mode !== 'scanning') return;

        // SENDER LOGIC:
        // 1. Close hand to "grab" the photo (prepare for transfer)
        if (isHandClosed && selectedPhoto && status === 'idle' && !hasGrabbed) {
            setHasGrabbed(true);
            setStatus('holding');
            setStatusMessage('Foto capturada! Abra a mão para lançar ao espaço.');
        } 
        // 2. Open hand to "release" the photo (actual transfer)
        else if (!isHandClosed && hasGrabbed && status === 'holding') {
            handleGrab(); // This now performs the actual upload and setDoc
            setHasGrabbed(false);
        }
        
        // RECEIVER LOGIC:
        // 1. Open hand to "catch" the photo
        else if (!isHandClosed && incomingPhoto && !selectedPhoto && status === 'idle') {
            handleCatch();
        }
    }, [isHandClosed, selectedPhoto, incomingPhoto, status, hasGrabbed]);

    const compressImage = (file: File): Promise<Blob> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.filter = getFilterCSS(selectedFilter);
                        ctx.drawImage(img, 0, 0, width, height);
                    }
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else resolve(file);
                    }, 'image/jpeg', 0.8);
                };
            };
        });
    };

    const handleGrab = async () => {
        if (!selectedPhoto || !currentUser) return;
        setStatus('grabbing');
        setStatusMessage('Lançando informações ao vácuo...');
        
        try {
            const compressedBlob = await compressImage(selectedPhoto);
            const path = `futuristic/${currentUser.uid}/${Date.now()}.jpg`;
            const fileRef = storageRef(storage, path);
            await uploadBytes(fileRef, compressedBlob);
            const url = await getDownloadURL(fileRef);

            await setDoc(doc(db, 'futuristic_beams', 'active_beam'), {
                senderId: currentUser.uid,
                senderName: currentUser.displayName,
                mediaUrl: url,
                timestamp: serverTimestamp()
            });

            setStatus('success');
            setStatusMessage('Foto enviada com sucesso!');
            setSelectedPhoto(null);
            setPhotoPreview(null);
            setTimeout(() => setStatus('idle'), 3000);
        } catch (e) {
            console.error(e);
            setStatus('error');
            setStatusMessage('Erro na transferência espacial');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const handleCatch = () => {
        if (!incomingPhoto) return;
        setStatus('releasing');
        setStatusMessage('Descriptografando dados estelares...');
        
        setTimeout(() => {
            setStatus('success');
            setStatusMessage('Transferência concluída');
            setPhotoPreview(incomingPhoto);
            setIncomingPhoto(null);
            // Delete the beam after catching
            deleteDoc(doc(db, 'futuristic_beams', 'active_beam'));
        }, 2000);
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1100] bg-black flex flex-col items-center justify-center overflow-hidden animate-fade-in">
            <button onClick={onClose} className="absolute top-8 right-8 text-white/40 text-4xl font-thin hover:text-white transition-colors z-[1200]">&times;</button>

            {mode === 'selection' ? (
                <div className="w-full max-w-sm p-8 flex flex-col items-center gap-12 animate-slide-up">
                    <div className="text-center space-y-2">
                        <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Néos Futurista</h2>
                        <p className="text-zinc-500 text-sm font-medium">Transfira fotos com o poder da sua mão.</p>
                    </div>

                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-64 h-64 bg-zinc-900 rounded-[3rem] border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:border-sky-500 transition-all overflow-hidden group"
                    >
                        {photoPreview ? (
                            <img src={photoPreview} className="w-full h-full object-cover" style={{ filter: getFilterCSS(selectedFilter) }} />
                        ) : (
                            <>
                                <div className="w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center text-sky-500 mb-4 group-hover:scale-110 transition-transform">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Galeria ou Câmera</span>
                            </>
                        )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handlePhotoSelect} className="hidden" accept="image/*" />

                    {photoPreview && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full py-2 px-4">
                            {FILTERS.map(f => (
                                <button 
                                    key={f.id}
                                    onClick={() => setSelectedFilter(f.id)}
                                    className={`flex-shrink-0 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${selectedFilter === f.id ? 'bg-sky-500 text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <button 
                        onClick={() => setMode('scanning')}
                        className="w-full py-6 bg-white text-black rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all"
                    >
                        Iniciar Leitura
                    </button>
                </div>
            ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                    {/* Camera Feed */}
                    <div className="absolute inset-0 w-full h-full overflow-hidden">
                        <video 
                            ref={videoRef} 
                            className="w-full h-full object-cover grayscale opacity-60 scale-x-[-1]" 
                            playsInline 
                            muted 
                        />
                    </div>
                    <canvas 
                        ref={canvasRef} 
                        width={1280}
                        height={720}
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1] z-20" 
                    />

                    {/* Futuristic UI Overlay */}
                    <div className="relative z-10 flex flex-col items-center justify-center gap-12">
                        {/* The Futuristic Circle */}
                        <div className="relative w-80 h-80 flex items-center justify-center">
                            <div className="absolute inset-0 border-4 border-sky-500/20 rounded-full animate-spin-slow"></div>
                            <div className="absolute inset-4 border-2 border-sky-500/30 rounded-full animate-reverse-spin"></div>
                            <div className="absolute inset-8 border border-sky-500/50 rounded-full border-dashed animate-pulse"></div>
                            
                            {/* Scanning Lines */}
                            <div className="absolute inset-0 overflow-hidden rounded-full">
                                <div className="w-full h-1 bg-sky-500/50 shadow-[0_0_15px_#0ea5e9] animate-scan-line"></div>
                            </div>
                            {/* Center Content */}
                            <div className="relative z-20 flex flex-col items-center gap-4">
                                {status === 'idle' && (
                                    <>
                                        {selectedPhoto ? (
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-sky-500/30 rounded-full blur-2xl animate-pulse"></div>
                                                <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-sky-500 shadow-[0_0_50px_rgba(14,165,233,0.6)] animate-float relative z-10">
                                                    <img src={photoPreview || ''} className="w-full h-full object-cover" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-2 transition-all duration-700 relative ${isHandClosed ? 'bg-sky-500 border-sky-400 shadow-[0_0_60px_#0ea5e9]' : 'bg-white/5 border-white/10'}`}>
                                                    {isHandClosed && <div className="absolute inset-0 bg-sky-400 rounded-full animate-ping opacity-20"></div>}
                                                    {isHandClosed ? (
                                                        <svg className="w-12 h-12 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                                                    ) : (
                                                        <svg className="w-12 h-12 text-white/20 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 011-1h2" strokeWidth={1}/></svg>
                                                    )}
                                                </div>
                                                <p className={`text-[11px] font-black uppercase tracking-[0.4em] transition-all duration-500 ${isHandClosed ? 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]' : 'text-white/40'}`}>
                                                    {isHandClosed ? 'Energia Carregada' : 'Aguardando Gesto'}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {(status === 'grabbing' || status === 'releasing') && (
                                    <div className="text-center flex flex-col items-center gap-4">
                                        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-sky-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                                            {statusMessage}
                                        </p>
                                    </div>
                                )}

                                {status === 'holding' && (
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-sky-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_#0ea5e9] animate-bounce">
                                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <p className="text-white text-[10px] font-black uppercase tracking-widest">{statusMessage}</p>
                                    </div>
                                )}

                                {status === 'success' && (
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="w-64 h-64 rounded-[2rem] overflow-hidden border-4 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)] animate-pop-in">
                                            <img src={photoPreview || ''} className="w-full h-full object-cover" />
                                        </div>
                                        <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em]">{statusMessage}</p>
                                    </div>
                                )}

                                {status === 'error' && (
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg>
                                        </div>
                                        <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">{statusMessage}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Label */}
                        <div className="text-center space-y-4">
                            <div className="flex gap-2 overflow-x-auto no-scrollbar w-full max-w-[300px] py-2">
                                {FACE_EFFECTS.map(e => (
                                    <button 
                                        key={e.id}
                                        onClick={() => setSelectedFaceEffect(e.id)}
                                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${selectedFaceEffect === e.id ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/40 border border-white/10'}`}
                                    >
                                        {e.label}
                                    </button>
                                ))}
                            </div>
                            {statusMessage && status === 'idle' && (
                                <div className="px-4 py-1 bg-sky-500/20 rounded-full border border-sky-500/30 animate-fade-in">
                                    <span className="text-[9px] font-bold text-sky-400 uppercase tracking-widest">{statusMessage}</span>
                                </div>
                            )}
                            <div className="px-8 py-3 bg-white/5 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
                                <span className={`text-[11px] font-black uppercase tracking-[0.6em] transition-all duration-500 ${isHandClosed ? 'text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]' : 'text-white/80'}`}>
                                    {isHandClosed ? 'Mão Fechada' : 'Mão Aberta'}
                                </span>
                            </div>
                            <p className="text-zinc-500 text-xs max-w-[200px] leading-relaxed">
                                {selectedPhoto 
                                    ? "Feche a mão para capturar a foto e enviá-la para o espaço."
                                    : incomingPhoto 
                                        ? "Uma foto está no ar! Abra a mão para capturá-la."
                                        : "Mostre sua mão para a câmera para interagir."}
                            </p>
                        </div>
                    </div>

                    {/* Footer Controls */}
                    <div className="absolute bottom-12 left-0 right-0 flex justify-center">
                        <button 
                            onClick={() => { setMode('selection'); setStatus('idle'); setIncomingPhoto(null); }}
                            className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] hover:text-white transition-colors"
                        >
                            Voltar para Seleção
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes reverse-spin { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                @keyframes scan-line { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                @keyframes pop-in { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                .animate-spin-slow { animation: spin-slow 10s linear infinite; }
                .animate-reverse-spin { animation: reverse-spin 6s linear infinite; }
                .animate-scan-line { animation: scan-line 4s ease-in-out infinite; position: absolute; }
                .animate-float { animation: float 3s ease-in-out infinite; }
                .animate-pop-in { animation: pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}</style>
        </div>
    );
};

export default FuturisticBeamModal;
