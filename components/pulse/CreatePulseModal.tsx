
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, getDownloadURL, uploadBytes } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { Camera, RotateCcw, Image as ImageIcon, X, Check, Music, UserPlus, Type as TypeIcon, Eye, Smile, Pencil, Sliders, Trash2, Undo, Zap, Search, Moon, Timer, Layers, User, Volume2, VolumeX, Download } from 'lucide-react';
import AddMusicModal from '../post/AddMusicModal';
import SearchFollowingModal from '../post/SearchFollowingModal';
import heic2any from 'heic2any';

// MediaPipe Imports
// Note: In some environments, these might need to be loaded via script tags if the npm packages have issues with Vite
// But we'll try the standard imports first.
// import { FaceMesh } from '@mediapipe/face_mesh';

interface Sticker {
    id: string;
    emoji: string;
    x: number;
    y: number;
    scale: number;
}

interface DoodlePath {
    points: { x: number; y: number }[];
    color: string;
    width: number;
}

interface Preset {
    id: string;
    name: string;
    filterCSS: string;
}

const PARADISE_PRESETS: Preset[] = [
    { id: 'normal', name: 'Original', filterCSS: 'none' },
    { id: 'vivid', name: 'Vívido', filterCSS: 'saturate(1.4) contrast(1.1)' },
    { id: 'clarear', name: 'Clarear', filterCSS: 'brightness(1.2) contrast(0.9)' },
    { id: 'drama', name: 'Drama', filterCSS: 'contrast(1.5) saturate(0.8) brightness(0.9)' },
    { id: 'mono', name: 'Mono', filterCSS: 'grayscale(1) contrast(1.2)' },
    { id: 'retro', name: 'Retro', filterCSS: 'sepia(0.3) contrast(0.9) brightness(1.1) saturate(1.2)' },
    { id: 'vhs', name: 'VHS', filterCSS: 'contrast(1.2) saturate(0.5) brightness(1.1) hue-rotate(10deg) blur(0.3px)' },
    { id: 'neon', name: 'Neon', filterCSS: 'hue-rotate(180deg) saturate(2) contrast(1.2) brightness(1.1)' },
    { id: 'faded', name: 'Faded', filterCSS: 'brightness(1.1) contrast(0.8) saturate(0.9) sepia(0.1)' },
    { id: 'cold', name: 'Frio', filterCSS: 'hue-rotate(200deg) saturate(0.8) brightness(1.05)' },
];

const EMOJI_LIST = ['🔥', '✨', '❤️', '😂', '😍', '🙌', '💯', '⚡', '🌈', '🍕', '🎸', '🎮', '🚀', '💎', '👑', '👽'];

const FONTS = [
    { id: 'classic', name: 'Classic', family: 'sans-serif', style: 'font-black italic uppercase' },
    { id: 'modern', name: 'Modern', family: '"JetBrains Mono", monospace', style: 'font-extrabold uppercase tracking-tighter' },
    { id: 'elegant', name: 'Elegant', family: '"Playfair Display", serif', style: 'font-black italic' },
    { id: 'fun', name: 'Fun', family: '"Bangers", cursive', style: 'tracking-wider' },
    { id: 'script', name: 'Script', family: '"Dancing Script", cursive', style: '' },
];

const COLORS = [
    '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', 
    '#ffff00', '#ff00ff', '#00ffff', '#ff6b00', '#7e22ce'
];

type MusicInfo = {
  nome: string;
  artista: string;
  capa: string;
  preview: string;
  startTime?: number;
};

interface CreatePulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPulseCreated: () => void;
  initialData?: {
      mediaUrl: string;
      musicInfo?: MusicInfo | null;
      caption?: string;
      isRepost?: boolean;
      originalAuthorId?: string;
      originalPostId?: string;
  };
}

const CreatePulseModal: React.FC<CreatePulseModalProps> = ({ isOpen, onClose, onPulseCreated, initialData }) => {
    const { t } = useLanguage();
    const [mediaFile, setMediaFile] = useState<File | Blob | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [activePreset, setActivePreset] = useState<Preset>(PARADISE_PRESETS[0]);
    const [submitting, setSubmitting] = useState(false);
    
    // Edição Avançada
    const [selectedMusic, setSelectedMusic] = useState<MusicInfo | null>(null);
    const [showMusicCover, setShowMusicCover] = useState(true);
    const [mentionedUsers, setMentionedUsers] = useState<any[]>([]);
    const [overlayText, setOverlayText] = useState('');
    const [textColor, setTextColor] = useState('#ffffff');
    const [activeFont, setActiveFont] = useState(FONTS[0]);
    const [isAddingText, setIsAddingText] = useState(false);
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    const [isMentionModalOpen, setIsMentionModalOpen] = useState(false);
    const [privacy, setPrivacy] = useState<'everyone' | 'friends'>('everyone');

    // Camera States
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [isNightMode, setIsNightMode] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [timer, setTimer] = useState<number | null>(null);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [showFlashOverlay, setShowFlashOverlay] = useState(false);
    const [draggingStickerId, setDraggingStickerId] = useState<string | null>(null);
    const [isDraggingText, setIsDraggingText] = useState(false);
    const [textPos, setTextPos] = useState({ x: 50, y: 50 });
    const [doodleColor, setDoodleColor] = useState('#ffffff');

    // Editing States
    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
    const [doodlePaths, setDoodlePaths] = useState<DoodlePath[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<DoodlePath | null>(null);
    const [adjustments, setAdjustments] = useState({ brightness: 100, contrast: 100, saturate: 100 });
    const [showAdjustments, setShowAdjustments] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const doodleCanvasRef = useRef<HTMLCanvasElement>(null);
    const audioPreviewRef = useRef<HTMLAudioElement>(null);
    const pinchStartDistRef = useRef<number | null>(null);
    const initialZoomRef = useRef<number>(1);
    const captureTouchStartRef = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setMediaPreview(initialData.mediaUrl);
                setSelectedMusic(initialData.musicInfo || null);
                if (initialData.caption) setOverlayText(initialData.caption);
            } else {
                startCamera();
            }
        } else { 
            stopCamera();
            setMediaFile(null); setMediaPreview(null); 
            setSelectedMusic(null); setMentionedUsers([]); setOverlayText('');
            setActivePreset(PARADISE_PRESETS[0]);
            setPrivacy('everyone');
            setStickers([]);
            setDoodlePaths([]);
            setIsDrawing(false);
            setAdjustments({ brightness: 100, contrast: 100, saturate: 100 });
            setShowAdjustments(false);
            setTextColor('#ffffff');
            setActiveFont(FONTS[0]);
        }
    }, [isOpen, initialData]);

    // Doodle Logic
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const rect = doodleCanvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
        setCurrentPath({ points: [{ x, y }], color: doodleColor, width: 5 });
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !currentPath) return;
        const rect = doodleCanvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
        setCurrentPath({ ...currentPath, points: [...currentPath.points, { x, y }] });
    };

    const endDrawing = () => {
        if (currentPath) {
            setDoodlePaths([...doodlePaths, currentPath]);
            setCurrentPath(null);
        }
    };

    useEffect(() => {
        const canvas = doodleCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const drawPath = (path: DoodlePath) => {
            if (path.points.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.width;
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            ctx.stroke();
        };

        doodlePaths.forEach(drawPath);
        if (currentPath) drawPath(currentPath);
    }, [doodlePaths, currentPath, mediaPreview]);

    useEffect(() => {
        if (selectedMusic && isOpen && mediaPreview) {
            if (audioPreviewRef.current) {
                audioPreviewRef.current.currentTime = selectedMusic.startTime || 0;
                audioPreviewRef.current.play().catch(e => console.warn("Audio play blocked", e));
            }
        } else {
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
            }
        }
    }, [selectedMusic, isOpen, mediaPreview]);

    // Zoom Handling
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            pinchStartDistRef.current = dist;
            initialZoomRef.current = zoom;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
            const dist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            const delta = dist / pinchStartDistRef.current;
            const newZoom = Math.min(Math.max(initialZoomRef.current * delta, zoomRange.min), zoomRange.max);
            setZoom(newZoom);
        }
    };

    const handleTouchEnd = () => {
        pinchStartDistRef.current = null;
    };

    const handleCaptureTouchStart = (e: React.TouchEvent) => {
        captureTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        initialZoomRef.current = zoom;
    };

    const handleCaptureTouchMove = (e: React.TouchEvent) => {
        if (!captureTouchStartRef.current) return;
        const deltaY = captureTouchStartRef.current.y - e.touches[0].clientY;
        // 100 pixels of slide = 1 unit of zoom
        const zoomDelta = deltaY / 100;
        const newZoom = Math.min(Math.max(initialZoomRef.current + zoomDelta, zoomRange.min), zoomRange.max);
        setZoom(newZoom);
    };

    const handleCaptureTouchEnd = () => {
        captureTouchStartRef.current = null;
        capturePhoto();
    };

    const [zoomRange, setZoomRange] = useState({ min: 1, max: 5 });

    const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            const constraints: MediaStreamConstraints = {
                video: { 
                    facingMode: mode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(newStream);
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
            setIsCameraReady(true);
            
            // Apply initial zoom if supported and fetch range
            const track = newStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities() as any;
            if (capabilities.zoom) {
                setZoomRange({ min: capabilities.zoom.min, max: capabilities.zoom.max });
                try {
                    await track.applyConstraints({ advanced: [{ zoom: Math.max(capabilities.zoom.min, Math.min(zoom, capabilities.zoom.max)) }] } as any);
                } catch (e) {
                    console.warn("Could not apply initial zoom", e);
                }
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setIsCameraReady(false);
        }
    };

    useEffect(() => {
        if (stream && isCameraReady) {
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities() as any;
            if (capabilities.zoom) {
                track.applyConstraints({ advanced: [{ zoom: zoom }] } as any).catch(e => console.warn("Zoom constraint failed", e));
            }
            
            if (facingMode === 'environment' && capabilities.torch) {
                track.applyConstraints({ advanced: [{ torch: isFlashOn }] } as any).catch(e => console.warn("Torch constraint failed", e));
            }
        }
    }, [zoom, isFlashOn, stream, isCameraReady, facingMode]);

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraReady(false);
    };

    const toggleCamera = () => {
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newMode);
        startCamera(newMode);
    };

    const handleStickerDrag = (e: React.MouseEvent | React.TouchEvent) => {
        if (!draggingStickerId && !isDraggingText) return;
        const rect = doodleCanvasRef.current?.parentElement?.getBoundingClientRect();
        if (!rect) return;
        const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        
        const x = ((clientX - rect.left) / rect.width) * 100;
        const y = ((clientY - rect.top) / rect.height) * 100;
        
        if (draggingStickerId) {
            setStickers(prev => prev.map(s => s.id === draggingStickerId ? { ...s, x, y } : s));
        } else if (isDraggingText) {
            setTextPos({ x, y });
        }
    };

    const startTimerCapture = () => {
        if (isCountingDown) return;
        setIsCountingDown(true);
        let count = 3;
        setTimer(count);
        const interval = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(interval);
                setTimer(null);
                setIsCountingDown(false);
                capturePhoto();
            } else {
                setTimer(count);
            }
        }, 1000);
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        
        if (isFlashOn && facingMode === 'user') {
            setShowFlashOverlay(true);
            setTimeout(() => setShowFlashOverlay(false), 150);
        }

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Apply Zoom
            const zoomWidth = canvas.width / zoom;
            const zoomHeight = canvas.height / zoom;
            const startX = (canvas.width - zoomWidth) / 2;
            const startY = (canvas.height - zoomHeight) / 2;

            ctx.filter = activePreset.filterCSS;
            
            if (isNightMode) {
                ctx.filter = ctx.filter === 'none' ? 'brightness(1.5) contrast(1.1) saturate(1.1)' : `${ctx.filter} brightness(1.5) contrast(1.1) saturate(1.1)`;
            }
            
            if (facingMode === 'user') {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }

            ctx.drawImage(video, startX, startY, zoomWidth, zoomHeight, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    setMediaFile(blob);
                    setMediaPreview(URL.createObjectURL(blob));
                    stopCamera();
                }
            }, 'image/jpeg', 0.9);
        }
    };

    const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            let finalFile: File | Blob = file;
            if (file.name.toLowerCase().endsWith('.heic')) {
                const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
                finalFile = Array.isArray(converted) ? converted[0] : converted;
            }
            setMediaFile(finalFile);
            setMediaPreview(URL.createObjectURL(finalFile));
        } catch (err) { alert("Erro ao carregar mídia."); }
    };

    const convertToJpg = async (): Promise<Blob | string> => {
        if (initialData && !mediaFile) return initialData.mediaUrl;

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Apply Filters & Adjustments
                    const adjFilter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%)`;
                    ctx.filter = activePreset.filterCSS === 'none' ? adjFilter : `${activePreset.filterCSS} ${adjFilter}`;
                    
                    ctx.drawImage(img, 0, 0);
                    
                    // Draw Doodles
                    ctx.filter = 'none';
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';
                    doodlePaths.forEach(path => {
                        if (path.points.length < 2) return;
                        ctx.beginPath();
                        ctx.strokeStyle = path.color;
                        ctx.lineWidth = (path.width / (doodleCanvasRef.current?.width || 1)) * canvas.width;
                        ctx.moveTo((path.points[0].x / (doodleCanvasRef.current?.width || 1)) * canvas.width, (path.points[0].y / (doodleCanvasRef.current?.height || 1)) * canvas.height);
                        for (let i = 1; i < path.points.length; i++) {
                            ctx.lineTo((path.points[i].x / (doodleCanvasRef.current?.width || 1)) * canvas.width, (path.points[i].y / (doodleCanvasRef.current?.height || 1)) * canvas.height);
                        }
                        ctx.stroke();
                    });

                    // Draw Stickers
                    ctx.font = `${Math.floor(canvas.width * 0.15)}px serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    stickers.forEach(s => {
                        const x = (s.x / 100) * canvas.width;
                        const y = (s.y / 100) * canvas.height;
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.scale(s.scale, s.scale);
                        ctx.fillText(s.emoji, 0, 0);
                        ctx.restore();
                    });

                    // Draw Overlay Text
                    if (overlayText) {
                        ctx.font = `${activeFont.id === 'script' ? 'italic' : 'bold'} ${Math.floor(canvas.width * 0.08)}px ${activeFont.family}`;
                        ctx.fillStyle = textColor;
                        ctx.shadowColor = 'rgba(0,0,0,0.5)';
                        ctx.shadowBlur = 10;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const tx = (textPos.x / 100) * canvas.width;
                        const ty = (textPos.y / 100) * canvas.height;
                        ctx.fillText(activeFont.id === 'classic' || activeFont.id === 'modern' ? overlayText.toUpperCase() : overlayText, tx, ty);
                    }

                    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85);
                }
            };
            img.src = mediaPreview!;
        });
    };

    const handleSaveLocal = async () => {
        if (!mediaPreview) return;
        try {
            const finalBlob = await convertToJpg();
            if (finalBlob instanceof Blob) {
                const url = URL.createObjectURL(finalBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pulse_${Date.now()}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error("Error saving image:", err);
            alert("Erro ao salvar imagem.");
        }
    };

    const handleSubmit = async () => {
        if (!mediaPreview || submitting) return;
        setSubmitting(true);
        try {
            let url = mediaPreview;
            
            if (mediaFile || activePreset.id !== 'normal') {
                const finalBlob = await convertToJpg();
                if (finalBlob instanceof Blob) {
                    const path = `pulses/${auth.currentUser?.uid}/${Date.now()}.jpg`;
                    const ref = storageRef(storage, path);
                    await uploadBytes(ref, finalBlob);
                    url = await getDownloadURL(ref);
                }
            }

            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            await addDoc(collection(db, 'pulses'), {
                authorId: auth.currentUser?.uid,
                mediaUrl: url,
                filter: activePreset.id,
                filterCSS: activePreset.filterCSS,
                createdAt: serverTimestamp(),
                expiresAt: expiresAt,
                musicInfo: selectedMusic,
                showMusicCover,
                overlayText: overlayText.trim(),
                mentions: mentionedUsers.map(u => u.id),
                timestamp: serverTimestamp(),
                privacy,
                isRepost: initialData?.isRepost || false,
                originalAuthorId: initialData?.originalAuthorId || null,
                originalPostId: initialData?.originalPostId || null
            });
            onPulseCreated(); onClose();
        } catch (err) { 
            console.error(err);
            alert("Falha ao publicar."); 
        } finally { setSubmitting(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col animate-fade-in overflow-hidden">
            <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-[80] bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={onClose} className="text-white active:scale-90">
                    <X size={32} strokeWidth={1.5} />
                </button>
                <div className="flex gap-4 items-center">
                    <div className="flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/10">
                        <button 
                            onClick={() => setPrivacy('everyone')}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${privacy === 'everyone' ? 'bg-white text-black' : 'text-white/60'}`}
                        >
                            Todos
                        </button>
                        <button 
                            onClick={() => setPrivacy('friends')}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${privacy === 'friends' ? 'bg-emerald-500 text-white' : 'text-white/60'}`}
                        >
                            Amigos
                        </button>
                    </div>
                    {mediaPreview && (
                        <button 
                            onClick={handleSubmit} 
                            disabled={submitting} 
                            className="flex items-center gap-2 py-2 px-6 bg-white text-black rounded-full font-black uppercase text-[10px] active:scale-95 transition-all disabled:opacity-50"
                        >
                            {submitting ? '...' : (
                                <>
                                    Publicar
                                    <Check size={14} strokeWidth={3} />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-grow relative flex items-center justify-center bg-black">
                {mediaPreview ? (
                    <div className="w-full h-full relative flex flex-col items-center justify-center overflow-hidden">
                        <div className="relative w-full h-full flex items-center justify-center">
                            <img 
                                src={mediaPreview} 
                                className="w-full h-full object-contain" 
                                style={{ 
                                    filter: activePreset.filterCSS === 'none' 
                                        ? `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%)` 
                                        : `${activePreset.filterCSS} brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%)` 
                                }} 
                            />
                            
                            {/* Doodle Canvas */}
                            <canvas 
                                ref={doodleCanvasRef}
                                width={window.innerWidth}
                                height={window.innerHeight}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={endDrawing}
                                onMouseLeave={endDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={endDrawing}
                                className={`absolute inset-0 z-10 ${isDrawing ? 'cursor-crosshair' : 'pointer-events-none'}`}
                            />

                            {/* Stickers Layer */}
                            <div 
                                className={`absolute inset-0 z-20 ${(draggingStickerId || isDraggingText) ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                onMouseMove={handleStickerDrag}
                                onTouchMove={handleStickerDrag}
                                onMouseUp={() => { setDraggingStickerId(null); setIsDraggingText(false); }}
                                onTouchEnd={() => { setDraggingStickerId(null); setIsDraggingText(false); }}
                            >
                                {stickers.map(s => (
                                    <div 
                                        key={s.id} 
                                        className="absolute pointer-events-auto cursor-move select-none"
                                        style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) scale(${s.scale})` }}
                                        onMouseDown={() => setDraggingStickerId(s.id)}
                                        onTouchStart={() => setDraggingStickerId(s.id)}
                                        onDoubleClick={() => setStickers(prev => prev.filter(st => st.id !== s.id))}
                                    >
                                        <span className="text-6xl drop-shadow-lg">{s.emoji}</span>
                                    </div>
                                ))}

                                {overlayText && (
                                    <div 
                                        className={`absolute pointer-events-auto cursor-move select-none flex items-center justify-center p-4 z-30`}
                                        style={{ left: `${textPos.x}%`, top: `${textPos.y}%`, transform: 'translate(-50%, -50%)' }}
                                        onMouseDown={() => setIsDraggingText(true)}
                                        onTouchStart={() => setIsDraggingText(true)}
                                        onDoubleClick={() => setIsAddingText(true)}
                                    >
                                        <p 
                                            className={`text-center drop-shadow-2xl ${activeFont.style} whitespace-pre-wrap max-w-[80vw]`}
                                            style={{ color: textColor, fontFamily: activeFont.family, fontSize: '2.5rem' }}
                                        >
                                            {activeFont.id === 'classic' || activeFont.id === 'modern' ? overlayText.toUpperCase() : overlayText}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="absolute inset-0 pointer-events-none z-30">
                                {mentionedUsers.map((u, i) => (
                                    <div key={u.id} className="absolute bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30 text-white font-black text-[10px] uppercase pointer-events-auto shadow-lg" style={{ top: `${20 + i * 8}%`, left: '15%' }}>
                                        @{u.username} <button onClick={() => setMentionedUsers(prev => prev.filter(mu => mu.id !== u.id))} className="ml-2 text-red-400">X</button>
                                    </div>
                                ))}
                            </div>

                            {selectedMusic && showMusicCover && (
                                <div className="absolute top-24 left-1/2 -translate-x-1/2 w-48 bg-black/40 backdrop-blur-xl border border-white/20 rounded-3xl p-3 flex items-center gap-3 shadow-2xl animate-fade-in z-30">
                                    <img src={selectedMusic.capa} className="w-12 h-12 rounded-xl" />
                                    <div className="overflow-hidden flex-grow">
                                        <p className="text-white font-black text-[10px] uppercase truncate">{selectedMusic.nome}</p>
                                        <p className="text-white/60 font-bold text-[8px] uppercase tracking-widest truncate">{selectedMusic.artista}</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (audioPreviewRef.current) {
                                                if (audioPreviewRef.current.paused) audioPreviewRef.current.play();
                                                else audioPreviewRef.current.pause();
                                            }
                                            setIsMuted(!isMuted);
                                        }} 
                                        className="text-white/60 active:scale-90 transition-all"
                                    >
                                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                    </button>
                                </div>
                            )}
                        </div>

                        {selectedMusic && (
                            <audio 
                                ref={audioPreviewRef}
                                src={selectedMusic.preview}
                                loop
                                muted={isMuted}
                                className="hidden"
                            />
                        )}

                        {/* CONTROLES FLUTUANTES */}
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-[90]">
                            <button onClick={() => setIsAddingText(true)} className="p-3.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white shadow-2xl active:scale-90 transition-all">
                                <TypeIcon size={22} strokeWidth={2} />
                            </button>
                            <button onClick={() => setIsDrawing(!isDrawing)} className={`p-3.5 rounded-full border transition-all shadow-2xl active:scale-90 ${isDrawing ? 'bg-white text-black border-white' : 'bg-black/40 text-white border-white/10'}`}>
                                <Pencil size={22} strokeWidth={2} />
                            </button>
                            {isDrawing && (
                                <div className="flex flex-col gap-2 bg-black/40 backdrop-blur-xl p-2 rounded-full border border-white/10 animate-fade-in">
                                    {COLORS.slice(0, 5).map(c => (
                                        <button 
                                            key={c} 
                                            onClick={() => setDoodleColor(c)}
                                            className={`w-6 h-6 rounded-full border transition-all ${doodleColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            )}
                            <button onClick={() => setIsStickerModalOpen(true)} className="p-3.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white shadow-2xl active:scale-90 transition-all">
                                <Smile size={22} strokeWidth={2} />
                            </button>
                            <button onClick={() => setShowAdjustments(!showAdjustments)} className={`p-3.5 rounded-full border transition-all shadow-2xl active:scale-90 ${showAdjustments ? 'bg-sky-500 text-white border-sky-500' : 'bg-black/40 text-white border-white/10'}`}>
                                <Sliders size={22} strokeWidth={2} />
                            </button>
                            <button onClick={handleSaveLocal} className="p-3.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white shadow-2xl active:scale-90 transition-all">
                                <Download size={22} strokeWidth={2} />
                            </button>
                            <button onClick={() => setIsMentionModalOpen(true)} className="p-3.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white shadow-2xl active:scale-90 transition-all">
                                <UserPlus size={22} strokeWidth={2} />
                            </button>
                            <button onClick={() => setIsMusicModalOpen(true)} className="p-3.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white shadow-2xl active:scale-90 transition-all">
                                <Music size={22} strokeWidth={2} />
                            </button>
                            {doodlePaths.length > 0 && (
                                <button onClick={() => setDoodlePaths(prev => prev.slice(0, -1))} className="p-3.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white shadow-2xl active:scale-90 transition-all">
                                    <Undo size={22} strokeWidth={2} />
                                </button>
                            )}
                            {(stickers.length > 0 || overlayText) && (
                                <button 
                                    onClick={() => {
                                        if (draggingStickerId) {
                                            setStickers(prev => prev.filter(s => s.id !== draggingStickerId));
                                            setDraggingStickerId(null);
                                        } else if (isDraggingText) {
                                            setOverlayText('');
                                            setIsDraggingText(false);
                                        } else {
                                            if (window.confirm("Limpar todos os elementos?")) {
                                                setStickers([]);
                                                setOverlayText('');
                                            }
                                        }
                                    }} 
                                    className="p-3.5 bg-red-500/20 backdrop-blur-xl rounded-full border border-red-500/30 text-red-500 shadow-2xl active:scale-90 transition-all"
                                >
                                    <Trash2 size={22} strokeWidth={2} />
                                </button>
                            )}
                            <button 
                                onClick={() => { setMediaPreview(null); setMediaFile(null); startCamera(); }} 
                                className="p-3.5 bg-red-500/20 backdrop-blur-xl rounded-full border border-red-500/30 text-red-500 shadow-2xl active:scale-90 transition-all"
                            >
                                <RotateCcw size={22} strokeWidth={2} />
                            </button>
                        </div>

                        {/* AJUSTES MANUAIS */}
                        {showAdjustments && (
                            <div className="absolute bottom-32 left-6 right-6 bg-black/60 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 z-[100] animate-slide-up">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase text-white/40"><span>Brilho</span><span>{adjustments.brightness}%</span></div>
                                        <input type="range" min="50" max="150" value={adjustments.brightness} onChange={e => setAdjustments({...adjustments, brightness: parseInt(e.target.value)})} className="w-full accent-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase text-white/40"><span>Contraste</span><span>{adjustments.contrast}%</span></div>
                                        <input type="range" min="50" max="150" value={adjustments.contrast} onChange={e => setAdjustments({...adjustments, contrast: parseInt(e.target.value)})} className="w-full accent-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase text-white/40"><span>Saturação</span><span>{adjustments.saturate}%</span></div>
                                        <input type="range" min="0" max="200" value={adjustments.saturate} onChange={e => setAdjustments({...adjustments, saturate: parseInt(e.target.value)})} className="w-full accent-white" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PRESETS PARADISE - BARRA INFERIOR */}
                        <div className="absolute bottom-10 left-0 right-0 p-4 overflow-x-auto no-scrollbar flex gap-4 bg-gradient-to-t from-black/80 to-transparent z-[80]">
                            {PARADISE_PRESETS.map((p) => (
                                <button key={p.id} onClick={() => setActivePreset(p)} className="flex flex-col items-center shrink-0 gap-2 active:scale-95 transition-transform">
                                    <div className={`w-14 h-14 rounded-2xl border-2 transition-all ${activePreset.id === p.id ? 'border-sky-500 scale-110 shadow-[0_0_20px_#0ea5e950]' : 'border-white/20 opacity-50'}`} style={{ filter: p.filterCSS, backgroundImage: `url(${mediaPreview})`, backgroundSize: 'cover' }}></div>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${activePreset.id === p.id ? 'text-sky-500' : 'text-white/60'}`}>{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                <div className="w-full h-full relative flex flex-col items-center justify-center">
                    <div 
                        className="w-full h-full relative overflow-hidden"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover transition-transform duration-100"
                            style={{ 
                                filter: activePreset.filterCSS, 
                                transform: `${facingMode === 'user' ? 'scaleX(-1)' : ''} scale(${zoom})` 
                            }}
                        />
                    </div>
                    
                    {showFlashOverlay && (
                        <div className="absolute inset-0 bg-white z-[100] animate-pulse" />
                    )}

                    {timer !== null && (
                        <div className="absolute inset-0 flex items-center justify-center z-[110] pointer-events-none">
                            <span className="text-white text-9xl font-black animate-ping">{timer}</span>
                        </div>
                    )}
                    
                    {/* SNAPCHAT STYLE CAMERA OVERLAY */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            {/* Top Bar */}
                            <div className="p-6 flex justify-between items-start pt-12">
                                <div className="flex gap-3 items-center pointer-events-auto">
                                    <div className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10">
                                        <User size={20} strokeWidth={2.5} />
                                    </div>
                                    <button 
                                        onClick={() => setIsMusicModalOpen(true)}
                                        className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 pointer-events-auto active:scale-90 transition-all"
                                    >
                                        <Search size={20} strokeWidth={2.5} />
                                    </button>
                                </div>

                                <div className="pointer-events-auto">
                                    <button onClick={onClose} className="p-2 text-white active:scale-90 transition-all drop-shadow-lg">
                                        <X size={32} strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>

                            {/* Vertical Toolbar (Right) */}
                            <div className="absolute right-6 top-32 flex flex-col gap-6 pointer-events-auto">
                                <button 
                                    onClick={toggleCamera} 
                                    className="p-1 text-white active:scale-90 transition-all drop-shadow-lg"
                                >
                                    <RotateCcw size={28} strokeWidth={2} />
                                </button>
                                <button 
                                    onClick={() => setIsFlashOn(!isFlashOn)} 
                                    className={`p-1 active:scale-90 transition-all drop-shadow-lg ${isFlashOn ? 'text-yellow-400' : 'text-white'}`}
                                >
                                    <Zap size={28} strokeWidth={2} fill={isFlashOn ? "currentColor" : "none"} />
                                </button>
                                <button 
                                    onClick={() => setIsNightMode(!isNightMode)} 
                                    className={`p-1 active:scale-90 transition-all drop-shadow-lg ${isNightMode ? 'text-indigo-400' : 'text-white'}`}
                                >
                                    <Moon size={28} strokeWidth={2} fill={isNightMode ? "currentColor" : "none"} />
                                </button>
                                <button onClick={() => setIsMusicModalOpen(true)} className="p-1 text-white active:scale-90 transition-all drop-shadow-lg">
                                    <Music size={28} strokeWidth={2} />
                                </button>
                                <button onClick={startTimerCapture} className={`p-1 active:scale-90 transition-all drop-shadow-lg ${isCountingDown ? 'text-red-500' : 'text-white'}`}>
                                    <Timer size={28} strokeWidth={2} />
                                </button>
                                <button className="p-1 text-white active:scale-90 transition-all drop-shadow-lg">
                                    <Layers size={28} strokeWidth={2} />
                                </button>
                            </div>

                            {/* Bottom Controls */}
                            <div className="flex flex-col items-center gap-6 pb-12">
                                {/* Lenses Selector Removed as per user request */}
                                {false && (
                                    <div className="w-full overflow-x-auto no-scrollbar flex gap-6 px-8 py-4 pointer-events-auto animate-fade-in">
                                        {/* Lenses mapping removed */}
                                    </div>
                                )}

                                {/* Filter Selector (Visible only when toggled) */}
                                {false && (
                                    <div className="w-full overflow-x-auto no-scrollbar flex gap-4 px-8 py-4 pointer-events-auto animate-fade-in">
                                        {PARADISE_PRESETS.map((p) => (
                                            <button key={p.id} onClick={() => setActivePreset(p)} className="flex flex-col items-center shrink-0 gap-2 active:scale-95 transition-transform">
                                                <div className={`w-16 h-16 rounded-full border-2 transition-all ${activePreset.id === p.id ? 'border-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.6)]' : 'border-white/20 opacity-50'}`} style={{ filter: p.filterCSS, background: 'linear-gradient(45deg, #333, #666)' }}></div>
                                                <span className={`text-[9px] font-black uppercase tracking-widest drop-shadow-md ${activePreset.id === p.id ? 'text-white' : 'text-white/60'}`}>{p.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center justify-center w-full px-12 gap-12 pointer-events-auto">
                                    {/* Gallery Button */}
                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        className="w-12 h-12 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-xl border-2 border-white text-white active:scale-90 transition-all overflow-hidden"
                                    >
                                        <div className="w-full h-full flex items-center justify-center bg-white/10">
                                            <ImageIcon size={24} strokeWidth={2} />
                                        </div>
                                    </button>

                                    {/* Snapchat Capture Button */}
                                    <button 
                                        onTouchStart={handleCaptureTouchStart}
                                        onTouchMove={handleCaptureTouchMove}
                                        onTouchEnd={handleCaptureTouchEnd}
                                        className="relative flex items-center justify-center active:scale-95 transition-all"
                                    >
                                        <div className="w-24 h-24 rounded-full border-[8px] border-white shadow-lg" />
                                        <div className="absolute w-20 h-20 rounded-full bg-white/5 backdrop-blur-[2px]" />
                                    </button>

                                    {/* Lenses/Filters Toggle Removed as per user request */}
                                    <div className="w-12 h-12" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isAddingText && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in">
                    <div className="w-full max-w-lg space-y-8">
                        <textarea 
                            autoFocus 
                            value={overlayText} 
                            onChange={e => setOverlayText(e.target.value)} 
                            placeholder="Digite sua frase..."
                            className={`w-full bg-transparent text-center outline-none transition-all duration-300 min-h-[150px] resize-none ${activeFont.style}`}
                            style={{ color: textColor, fontFamily: activeFont.family, fontSize: '3rem' }}
                        />
                        
                        {/* Font Selector */}
                        <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 justify-center">
                            {FONTS.map(f => (
                                <button 
                                    key={f.id} 
                                    onClick={() => setActiveFont(f)}
                                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${activeFont.id === f.id ? 'bg-white text-black scale-110' : 'bg-white/10 text-white/60'}`}
                                >
                                    {f.name}
                                </button>
                            ))}
                        </div>

                        {/* Color Selector */}
                        <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 justify-center">
                            {COLORS.map(c => (
                                <button 
                                    key={c} 
                                    onClick={() => setTextColor(c)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all shrink-0 ${textColor === c ? 'border-white scale-125 shadow-lg' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>

                        <div className="flex flex-col gap-4 items-center pt-8">
                            <button 
                                onClick={() => setIsAddingText(false)} 
                                className="bg-white text-black px-12 py-4 rounded-full font-black uppercase text-xs shadow-2xl active:scale-95 transition-all"
                            >
                                Concluir
                            </button>
                            {overlayText && (
                                <button 
                                    onClick={() => { setOverlayText(''); setIsAddingText(false); }} 
                                    className="text-red-500 font-black uppercase text-[10px] tracking-widest opacity-60 hover:opacity-100 transition-all"
                                >
                                    Remover Texto
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isStickerModalOpen && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-end">
                    <div className="w-full bg-zinc-900 rounded-t-[3rem] p-8 animate-slide-up max-h-[60vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-white font-black uppercase tracking-widest text-xs">Stickers</h3>
                            <button onClick={() => setIsStickerModalOpen(false)} className="text-white/40"><X size={24} /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-6">
                            {EMOJI_LIST.map(emoji => (
                                <button 
                                    key={emoji} 
                                    onClick={() => {
                                        setStickers([...stickers, { id: Math.random().toString(), emoji, x: 50, y: 50, scale: 1 }]);
                                        setIsStickerModalOpen(false);
                                    }}
                                    className="text-5xl active:scale-90 transition-transform"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            <input type="file" ref={fileInputRef} onChange={handleMediaChange} className="hidden" accept="image/*" />
            <AddMusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} postId="" onMusicAdded={(m) => { setSelectedMusic(m); setIsMusicModalOpen(false); }} isProfileModal={true} />
            <SearchFollowingModal isOpen={isMentionModalOpen} onClose={() => setIsMentionModalOpen(false)} title="Mencionar" onSelect={(u) => { if(!mentionedUsers.find(mu => mu.id === u.id)) setMentionedUsers([...mentionedUsers, u]); }} />
        </div>
    );
};

export default CreatePulseModal;
