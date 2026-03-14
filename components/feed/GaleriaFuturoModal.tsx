
import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Image as ImageIcon, Sparkles, Send, Loader2, Download, Check, ArrowLeft, Eraser, Wand2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { db, collection, addDoc, serverTimestamp } from '../../firebase';
import heic2any from "heic2any";

declare global {
    interface Window {
        aistudio: {
            hasSelectedApiKey: () => Promise<boolean>;
            openSelectKey: () => Promise<void>;
        };
    }
}

interface GaleriaFuturoModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
}

const GaleriaFuturoModal: React.FC<GaleriaFuturoModalProps> = ({ isOpen, onClose, user }) => {
    const [mode, setMode] = useState<'edit' | 'merge' | 'erase'>('edit');
    const [step, setStep] = useState<'select-mode' | 'select-media' | 'camera' | 'edit' | 'processing' | 'result'>('select-mode');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [prompt, setPrompt] = useState('');
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isIdentifying, setIsIdentifying] = useState(false);
    const [segmentedMasks, setSegmentedMasks] = useState<string[]>([]);
    const [eraseCircles, setEraseCircles] = useState<{x: number, y: number, r: number}[]>([]);
    const [combinedMask, setCombinedMask] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasKey, setHasKey] = useState(false);
    const [showBefore, setShowBefore] = useState(false);
    
    const [drawPath, setDrawPath] = useState<{x: number, y: number}[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [eraseCircle, setEraseCircle] = useState<{x: number, y: number, r: number} | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const editCanvasRef = useRef<HTMLCanvasElement>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        if (step === 'camera') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [step]);

    useEffect(() => {
        if (isOpen) {
            checkApiKey();
            // Reset state when opening
            setMode('edit');
            setStep('select-mode');
            setSelectedImages([]);
            setPrompt('');
            setResultImage(null);
            setError(null);
            setSegmentedMasks([]);
            setEraseCircles([]);
            setCombinedMask(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (segmentedMasks.length > 0) {
            combineMasks();
        } else {
            setCombinedMask(null);
        }
    }, [segmentedMasks]);

    const combineMasks = async () => {
        if (segmentedMasks.length === 0) return;
        if (segmentedMasks.length === 1) {
            setCombinedMask(segmentedMasks[0]);
            return;
        }

        const img = new Image();
        await new Promise((resolve) => {
            img.onload = resolve;
            img.src = segmentedMasks[0];
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (const mask of segmentedMasks) {
            const maskImg = new Image();
            await new Promise((resolve) => {
                maskImg.onload = resolve;
                maskImg.src = mask;
            });
            ctx.drawImage(maskImg, 0, 0);
        }

        setCombinedMask(canvas.toDataURL('image/png'));
    };

    const checkApiKey = async () => {
        if (window.aistudio) {
            const selected = await window.aistudio.hasSelectedApiKey();
            setHasKey(selected);
        }
    };

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setHasKey(true);
        }
    };

    const startCamera = async () => {
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 4096 },
                    height: { ideal: 2160 }
                }, 
                audio: false 
            });
            setStream(newStream);
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Não foi possível acessar a câmera.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            
            // Use real video dimensions for max quality
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0);
                // Use 1.0 quality for JPEG to preserve real camera quality
                const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
                setSelectedImages([dataUrl]);
                setStep('edit');
            }
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setIsProcessing(true);
            setError(null);
            const newImages: string[] = [];
            const maxFiles = 5;
            const filesToProcess = Array.from(files).slice(0, maxFiles) as File[];
            
            try {
                for (const file of filesToProcess) {
                    let fileToRead: File | Blob = file;
                    
                    // Convert HEIC/HEIF to JPEG
                    const isHeic = file.type === "image/heic" || 
                                  file.type === "image/heif" || 
                                  file.name.toLowerCase().endsWith(".heic") || 
                                  file.name.toLowerCase().endsWith(".heif");

                    if (isHeic) {
                        try {
                            const blob = await heic2any({
                                blob: file,
                                toType: "image/jpeg",
                                quality: 0.8
                            });
                            const resultBlob = Array.isArray(blob) ? blob[0] : blob;
                            fileToRead = new File([resultBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
                        } catch (err) {
                            console.error("HEIC conversion error:", err);
                        }
                    }

                    const reader = new FileReader();
                    const result = await new Promise<string>((resolve) => {
                        reader.onload = (event) => resolve(event.target?.result as string);
                        reader.readAsDataURL(fileToRead);
                    });
                    newImages.push(result);
                }

                if (newImages.length > 0) {
                    setSelectedImages(newImages);
                    if (newImages.length > 1) {
                        setMode('merge');
                    }
                    setStep('edit');
                }
            } catch (err) {
                console.error("File processing error:", err);
                setError("Erro ao processar arquivos. Verifique se as imagens são válidas.");
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const identifyObject = async (circle: {x: number, y: number, r: number}) => {
        if (!selectedImages[0]) return;
        setIsIdentifying(true);
        setError(null);
        
        try {
            const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
            const ai = new GoogleGenAI({ apiKey: apiKey as string });
            
            // Create hint image
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = selectedImages[0];
            });
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const ctx = tempCanvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const canvasDisplay = editCanvasRef.current;
                if (canvasDisplay) {
                    const scaleX = img.width / canvasDisplay.width;
                    const scaleY = img.height / canvasDisplay.height;
                    ctx.beginPath();
                    ctx.strokeStyle = '#f472b6';
                    ctx.lineWidth = 10 * scaleX;
                    ctx.setLineDash([15 * scaleX, 15 * scaleX]);
                    ctx.arc(circle.x * scaleX, circle.y * scaleY, circle.r * scaleX, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            
            const hintData = tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-image-preview',
                contents: {
                    parts: [
                        { inlineData: { data: hintData, mimeType: 'image/jpeg' } },
                        { text: "Identify and segment the main object inside the pink dashed circle. Return ONLY the binary mask image (white object on black background). Be extremely precise with the object contours. Do not include the circle in the mask." }
                    ]
                }
            });

            if (response.candidates?.[0]?.content?.parts) {
                const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
                if (imagePart) {
                    const newMask = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                    setSegmentedMasks(prev => [...prev, newMask]);
                    setEraseCircles(prev => [...prev, circle]);
                    setEraseCircle(null);
                } else {
                    throw new Error("IA não conseguiu segmentar o objeto.");
                }
            }
        } catch (err) {
            console.error("Identification error:", err);
            setError("Não foi possível identificar o objeto. Tente circular novamente.");
            setEraseCircle(null);
        } finally {
            setIsIdentifying(false);
        }
    };

    const processImage = async () => {
        if (selectedImages.length === 0 || (mode !== 'erase' && !prompt)) return;
        
        setIsProcessing(true);
        setError(null);
        setStep('processing');

        try {
            const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
            const ai = new GoogleGenAI({ apiKey: apiKey as string });
            
            let parts: any[] = [];

            if (mode === 'erase' && combinedMask) {
                const originalData = selectedImages[0].split(',')[1];
                const maskData = combinedMask.split(',')[1];
                
                parts = [
                    {
                        inlineData: {
                            data: originalData,
                            mimeType: 'image/jpeg',
                        },
                    },
                    {
                        inlineData: {
                            data: maskData,
                            mimeType: 'image/png',
                        },
                    }
                ];
            } else {
                parts = selectedImages.map(img => {
                    const base64Data = img.split(',')[1];
                    const mimeType = img.split(',')[0].split(':')[1].split(';')[0];
                    return {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType,
                        },
                    };
                });
            }

            let systemPrompt = "";
            if (mode === 'merge') {
                systemPrompt = `Você é o motor de IA Néos Vision Pro. Sua tarefa é realizar uma fusão hiper-realista de múltiplas imagens. Combine os elementos das fotos fornecidas de forma que pareçam ter sido capturadas em uma única sessão fotográfica profissional. Respeite a iluminação global, profundidade de campo e texturas. Pedido do usuário: "${prompt}". O resultado deve ser uma obra de arte digital impecável, sem artefatos de colagem, com qualidade 8K e realismo cinematográfico.`;
            } else if (mode === 'erase') {
                systemPrompt = `You are the Néos Vision Pro AI, a world-class expert in generative inpainting and object removal.
I am providing:
1. ORIGINAL IMAGE: The source high-resolution photo.
2. MASK IMAGE: A binary mask (white = object to remove).

CRITICAL INSTRUCTIONS:
- REMOVE the object indicated by the mask COMPLETELY.
- RECONSTRUCT the background with absolute pixel-perfect fidelity.
- INPAINT using surrounding context: match grain, lighting, shadows, and complex textures (grass, fabric, skin, etc.).
- Ensure ZERO artifacts, blurring, or "ghosting". The final image must look as if the object was never there.
- Maintain the original resolution and sharpness of the photo.

OUTPUT: Return ONLY the final processed image.`;
            } else {
                systemPrompt = `Você é o motor de IA Néos Vision Pro. Realize uma edição generativa de alta fidelidade nesta imagem. Mantenha a identidade e a estrutura básica da cena original, mas aplique as alterações solicitadas com realismo fotográfico extremo. Ajuste sombras, reflexos e cores para que a alteração pareça natural e integrada. Pedido: "${prompt}". Foque em qualidade de nível profissional, ultra-detalhado, preservando texturas originais.`;
            }

            parts.push({ text: systemPrompt } as any);

            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-image-preview',
                contents: {
                    parts: parts as any,
                },
            });

            let foundImage = false;
            if (response.candidates?.[0]?.content?.parts) {
                const imageParts = response.candidates[0].content.parts.filter(p => p.inlineData);
                
                if (imageParts.length > 0) {
                    const imageUrl = `data:${imageParts[0].inlineData.mimeType};base64,${imageParts[0].inlineData.data}`;
                    setResultImage(imageUrl);
                    foundImage = true;
                    setStep('result');
                }
            }

            if (!foundImage) {
                throw new Error("A IA não retornou uma imagem processada.");
            }

        } catch (err: any) {
            console.error("AI Processing error:", err);
            if (err.message?.includes("Requested entity was not found")) {
                setHasKey(false);
                setError("Chave de API inválida ou não encontrada. Por favor, conecte novamente.");
            } else {
                setError("Ocorreu um erro ao processar a imagem. Tente novamente.");
            }
            setStep('edit');
        } finally {
            setIsProcessing(false);
        }
    };

    const saveToGallery = async () => {
        if (!resultImage) return;
        
        try {
            // In a real app we might upload to storage first
            // For now, we'll just simulate saving or let user download
            const link = document.createElement('a');
            link.href = resultImage;
            link.download = `neos_futuro_${Date.now()}.jpg`;
            link.click();
            
            // Also save a record in Firestore
            await addDoc(collection(db, 'posts'), {
                userId: user.uid,
                username: user.displayName || 'Usuário Néos',
                userPhoto: user.photoURL || '',
                imageUrl: resultImage, // In production, upload to Firebase Storage
                caption: `✨ Criado na Galeria do Futuro: ${prompt}`,
                timestamp: serverTimestamp(),
                likes: [],
                commentsCount: 0,
                type: 'futuro'
            });

            onClose();
        } catch (err) {
            console.error("Error saving result:", err);
            setError("Erro ao salvar na galeria.");
        }
    };

    const handleDrawStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (mode !== 'erase' || isIdentifying || isScanning || isProcessing) return;
        setIsDrawing(true);
        const pos = getEventPos(e);
        setDrawPath([pos]);
    };

    const handleDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || mode !== 'erase' || isIdentifying || isScanning || isProcessing) return;
        const pos = getEventPos(e);
        setDrawPath(prev => [...prev, pos]);
        drawOnCanvas([...drawPath, pos]);
    };

    const handleDrawEnd = async () => {
        if (!isDrawing || mode !== 'erase') return;
        setIsDrawing(false);
        
        if (drawPath.length > 5) {
            // Visual closing effect: draw a line back to start
            const canvas = editCanvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = 'rgba(217, 70, 239, 1)';
                    ctx.beginPath();
                    ctx.strokeStyle = '#f472b6';
                    ctx.lineWidth = 4;
                    ctx.moveTo(drawPath[drawPath.length - 1].x, drawPath[drawPath.length - 1].y);
                    ctx.lineTo(drawPath[0].x, drawPath[0].y);
                    ctx.stroke();
                }
            }

            setIsScanning(true);
            // Calculate circle first for visual feedback
            const circle = calculatePerfectCircle(drawPath);
            setEraseCircle(circle);
            
            // Now call AI to identify the real object
            await identifyObject(circle);
            setIsScanning(false);
        }
    };

    const getEventPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = editCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const drawOnCanvas = (path: {x: number, y: number}[]) => {
        const canvas = editCanvasRef.current;
        if (!canvas || path.length < 2) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(217, 70, 239, 0.8)'; // fuchsia-500
        
        ctx.beginPath();
        ctx.strokeStyle = '#f472b6'; // fuchsia-400
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        ctx.moveTo(path[0].x, path[0].y);
        
        // Smooth curve drawing
        if (path.length > 2) {
            for (let i = 1; i < path.length - 2; i++) {
                const xc = (path[i].x + path[i+1].x) / 2;
                const yc = (path[i].y + path[i+1].y) / 2;
                ctx.quadraticCurveTo(path[i].x, path[i].y, xc, yc);
            }
            // For the last 2 points
            ctx.quadraticCurveTo(
                path[path.length-2].x, 
                path[path.length-2].y, 
                path[path.length-1].x, 
                path[path.length-1].y
            );
        } else {
            ctx.lineTo(path[1].x, path[1].y);
        }
        
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
    };

    const calculatePerfectCircle = (path: {x: number, y: number}[]) => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        path.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const radius = Math.max(maxX - minX, maxY - minY) / 2 + 10;

        // Draw the perfect circle with a "tech" look
        const canvas = editCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Outer glow
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(244, 114, 182, 0.3)';
                ctx.lineWidth = 8;
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.stroke();

                // Main circle
                ctx.beginPath();
                ctx.strokeStyle = '#f472b6';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Corners/Markers to look like Samsung tech
                const markerSize = 10;
                ctx.lineWidth = 3;
                
                // Top marker
                ctx.beginPath();
                ctx.moveTo(centerX - markerSize, centerY - radius);
                ctx.lineTo(centerX + markerSize, centerY - radius);
                ctx.stroke();

                // Bottom marker
                ctx.beginPath();
                ctx.moveTo(centerX - markerSize, centerY + radius);
                ctx.lineTo(centerX + markerSize, centerY + radius);
                ctx.stroke();

                // Left marker
                ctx.beginPath();
                ctx.moveTo(centerX - radius, centerY - markerSize);
                ctx.lineTo(centerX - radius, centerY + markerSize);
                ctx.stroke();

                // Right marker
                ctx.beginPath();
                ctx.moveTo(centerX + radius, centerY - markerSize);
                ctx.lineTo(centerX + radius, centerY + markerSize);
                ctx.stroke();
            }
        }
        return { x: centerX, y: centerY, r: radius };
    };

    const handleUndo = () => {
        setSegmentedMasks(prev => prev.slice(0, -1));
        setEraseCircles(prev => prev.slice(0, -1));
        setEraseCircle(null);
        const canvas = editCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleBack = () => {
        if (step === 'select-media') setStep('select-mode');
        else if (step === 'camera') setStep('select-media');
        else if (step === 'edit') setStep('select-media');
        else if (step === 'result') setStep('edit');
        else if (step === 'processing') setStep('edit');
        else onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1100] bg-black flex flex-col animate-fade-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50 backdrop-blur-md z-10">
                <div className="flex items-center gap-2">
                    {step !== 'select-mode' && (
                        <button onClick={handleBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-white" />
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-white" />
                    </button>
                </div>
                <div className="flex flex-col items-center">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Galeria do Futuro</h2>
                    <div className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-fuchsia-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest">IA Néos Tech</span>
                    </div>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Content */}
            <div className="flex-grow relative flex flex-col items-center p-4 overflow-y-auto no-scrollbar">
                {step === 'select-mode' && (
                    <div className="flex flex-col gap-6 w-full max-w-xs animate-slide-up my-auto">
                        <div className="text-center mb-2">
                            <p className="text-zinc-400 text-sm font-medium italic">Acesse o poder total da IA Néos Tech em um só lugar.</p>
                        </div>
                        
                        <button 
                            onClick={() => { setStep('select-media'); }}
                            className="flex flex-col items-center gap-4 md:gap-6 p-6 md:p-10 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 rounded-[2.5rem] md:rounded-[3rem] border border-white/10 hover:scale-[1.02] active:scale-95 transition-all group shadow-2xl shadow-purple-500/20"
                        >
                            <div className="w-16 h-16 md:w-24 md:h-24 bg-white/20 rounded-2xl md:rounded-[2rem] flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner group-hover:rotate-6 transition-transform">
                                <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-white" />
                            </div>
                            <div className="text-center">
                                <span className="font-black uppercase text-sm md:text-base tracking-[0.3em] text-white block mb-1 md:mb-2">Néos AI Studio</span>
                                <div className="flex flex-col gap-0.5 md:gap-1">
                                    <span className="text-[8px] md:text-[10px] text-white/70 font-bold uppercase tracking-widest block">Apagador Inteligente</span>
                                    <span className="text-[8px] md:text-[10px] text-white/70 font-bold uppercase tracking-widest block">Edição Generativa</span>
                                    <span className="text-[8px] md:text-[10px] text-white/70 font-bold uppercase tracking-widest block">Fusão de Imagens</span>
                                </div>
                            </div>
                        </button>

                        <div className="mt-4 p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest text-center leading-relaxed">
                                Capture ou selecione fotos para começar a criar com a tecnologia Néos Tech.
                            </p>
                        </div>
                    </div>
                )}

                {step === 'select-media' && (
                    <div className="flex flex-col gap-4 md:gap-6 w-full max-w-xs animate-slide-up my-auto">
                        <div className="text-center mb-2">
                            <p className="text-zinc-400 text-sm font-medium">
                                Capture ou selecione até 5 fotos para começar.
                            </p>
                        </div>
                        
                        <button 
                            onClick={() => setStep('camera')}
                            className="flex flex-col items-center gap-3 md:gap-4 p-6 md:p-8 bg-zinc-900 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 hover:border-fuchsia-500/50 transition-all group"
                        >
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-fuchsia-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-fuchsia-500/20 group-hover:scale-110 transition-transform">
                                <Camera className="w-6 h-6 md:w-8 md:h-8 text-white" />
                            </div>
                            <span className="font-black uppercase text-[10px] md:text-xs tracking-widest text-white">Tirar Foto Real</span>
                        </button>

                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center gap-3 md:gap-4 p-6 md:p-8 bg-zinc-900 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 hover:border-sky-500/50 transition-all group"
                        >
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-sky-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-110 transition-transform">
                                <ImageIcon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                            </div>
                            <span className="font-black uppercase text-[10px] md:text-xs tracking-widest text-white">
                                Escolher da Galeria
                            </span>
                        </button>
                        
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            accept="image/*" 
                            multiple
                            className="hidden" 
                        />

                        <button 
                            onClick={() => setStep('select-mode')}
                            className="text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors text-center"
                        >
                            Voltar
                        </button>
                    </div>
                )}

                {step === 'camera' && (
                    <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
                        <div className="relative w-full aspect-[3/4] max-w-md bg-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10">
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 border-[12px] border-black/20 pointer-events-none" />
                            <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Qualidade Real</span>
                            </div>
                        </div>
                        
                        <div className="mt-8 flex items-center gap-8">
                            <button 
                                onClick={() => setStep('select-media')}
                                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={capturePhoto}
                                className="w-20 h-20 rounded-full border-4 border-white p-1"
                            >
                                <div className="w-full h-full rounded-full bg-white active:scale-90 transition-transform" />
                            </button>
                            <div className="w-12" />
                        </div>
                    </div>
                )}

                {step === 'edit' && selectedImages.length > 0 && (
                    <div className="w-full max-w-md flex flex-col gap-3 md:gap-6 animate-slide-up pb-10">
                        {/* Mode Selector */}
                        <div className="flex bg-zinc-900 p-1 rounded-2xl border border-white/5 shrink-0">
                            {selectedImages.length === 1 ? (
                                <>
                                    <button 
                                        onClick={() => setMode('erase')}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'erase' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        Apagar
                                    </button>
                                    <button 
                                        onClick={() => setMode('edit')}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'edit' ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        Transformar
                                    </button>
                                </>
                            ) : (
                                <button 
                                    className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                                >
                                    Fusão de Imagens
                                </button>
                            )}
                        </div>

                        {selectedImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
                                {selectedImages.map((img, idx) => (
                                    <div key={idx} className="relative w-20 h-28 md:w-24 md:h-32 shrink-0 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                        <img src={img} className="w-full h-full object-cover" alt={`Selected ${idx}`} />
                                        <div className="absolute top-1 left-1 w-4 h-4 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center">
                                            <span className="text-[8px] font-bold text-white">{idx + 1}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 bg-zinc-900 touch-none shrink-0">
                            <img src={selectedImages[0]} className="w-full h-full object-cover" alt="Main Preview" />
                            
                            {mode === 'erase' && (
                                <>
                                    <canvas 
                                        ref={editCanvasRef}
                                        width={400}
                                        height={533}
                                        onMouseDown={handleDrawStart}
                                        onMouseMove={handleDrawing}
                                        onMouseUp={handleDrawEnd}
                                        onMouseLeave={handleDrawEnd}
                                        onTouchStart={handleDrawStart}
                                        onTouchMove={handleDrawing}
                                        onTouchEnd={handleDrawEnd}
                                        className="absolute inset-0 z-20 cursor-crosshair w-full h-full"
                                    />
                                    {combinedMask && (
                                        <div className="absolute inset-0 z-10 pointer-events-none mix-blend-screen opacity-60">
                                            <img src={combinedMask} className="w-full h-full object-cover filter brightness-150 hue-rotate-90" alt="Mask Overlay" />
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 z-30">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                    {mode === 'merge' ? `Junção (${selectedImages.length} fotos)` : mode === 'erase' ? 'Apagador Néos' : 'Original'}
                                </span>
                            </div>

                            {mode === 'erase' && (segmentedMasks.length > 0 || eraseCircle) && !isScanning && !isIdentifying && (
                                <button 
                                    onClick={handleUndo}
                                    className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 z-30 text-white hover:bg-white/20 transition-colors"
                                    title="Desfazer seleção"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                            )}

                            {mode === 'erase' && segmentedMasks.length === 0 && !eraseCircle && !isScanning && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                    <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                                        <p className="text-[10px] font-black text-white uppercase tracking-widest">Circule o objeto para apagar</p>
                                    </div>
                                </div>
                            )}

                            {isScanning || isIdentifying ? (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 bg-fuchsia-500/10 animate-pulse">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">
                                            {isScanning ? 'Analisando...' : 'Identificando Objeto...'}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-col gap-3">
                            {mode !== 'erase' ? (
                                <div className="relative">
                                    <textarea 
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder={mode === 'merge' 
                                            ? "Como você quer que a IA junte essas fotos? (Ex: Crie um cenário épico misturando estas fotos)" 
                                            : "O que você quer mudar na foto? (Ex: Deixa essa foto como se fosse de dia)"}
                                        className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-3 text-white text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none min-h-[80px] md:min-h-[100px] resize-none"
                                    />
                                    <div className="absolute bottom-3 right-3">
                                        <Sparkles className="w-5 h-5 text-fuchsia-500 opacity-50" />
                                    </div>
                                </div>
                            ) : (
                                (eraseCircle || segmentedMasks.length > 0) && (
                                    <div className="text-center animate-fade-in py-1">
                                        <p className="text-fuchsia-400 text-[10px] font-black uppercase tracking-widest">
                                            {segmentedMasks.length > 0 ? `${segmentedMasks.length} objeto(s) selecionado(s)` : 'Processando seleção...'}
                                        </p>
                                    </div>
                                )
                            )}

                            {error && (
                                <p className="text-red-400 text-[10px] font-bold uppercase text-center">{error}</p>
                            )}

                            <button 
                                onClick={processImage}
                                disabled={(mode !== 'erase' && !prompt) || (mode === 'erase' && segmentedMasks.length === 0) || isProcessing || isIdentifying}
                                className={`w-full py-3.5 ${mode === 'erase' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-gradient-to-r from-fuchsia-600 to-pink-600 shadow-fuchsia-600/20'} rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[11px] tracking-widest text-white shadow-lg disabled:opacity-50 active:scale-95 transition-all`}
                            >
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'erase' ? <Eraser className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                                {mode === 'merge' ? 'Criar Junção com IA' : mode === 'erase' ? `Apagar ${segmentedMasks.length} Objeto(s)` : 'Processar com IA'}
                            </button>
                            
                            <button 
                                onClick={() => {
                                    setStep('select-media');
                                    setSegmentedMasks([]);
                                    setEraseCircles([]);
                                    setDrawPath([]);
                                }}
                                className="text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors"
                            >
                                Trocar Foto
                            </button>
                        </div>
                    </div>
                )}

                {step === 'processing' && (
                    <div className="flex flex-col items-center gap-8 animate-fade-in">
                        <div className="relative">
                            <div className="w-32 h-32 border-4 border-fuchsia-500/20 border-t-fuchsia-500 rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="w-10 h-10 text-fuchsia-500 animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Processando Magia</h3>
                            <p className="text-zinc-400 text-sm font-medium animate-pulse">A tecnologia revolucionária Néos está trabalhando...</p>
                        </div>
                    </div>
                )}

                {step === 'result' && resultImage && (
                    <div className="w-full max-w-md flex flex-col gap-6 animate-slide-up">
                        <div 
                            className="relative aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl border border-fuchsia-500/30 bg-zinc-900 cursor-pointer touch-none"
                            onMouseDown={() => setShowBefore(true)}
                            onMouseUp={() => setShowBefore(false)}
                            onMouseLeave={() => setShowBefore(false)}
                            onTouchStart={() => setShowBefore(true)}
                            onTouchEnd={() => setShowBefore(false)}
                        >
                            <img src={showBefore ? selectedImages[0] : resultImage} className="w-full h-full object-cover transition-opacity duration-300" alt="Result" />
                            <div className="absolute top-4 left-4 px-3 py-1 bg-fuchsia-600 rounded-full shadow-lg z-10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                    {showBefore ? 'Original' : 'Resultado IA'}
                                </span>
                            </div>
                            {!showBefore && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
                                    <p className="text-[8px] font-black text-white uppercase tracking-widest">Segure para ver o Antes</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={saveToGallery}
                                className="w-full py-4 bg-fuchsia-600 text-white rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all"
                            >
                                <Send className="w-5 h-5" />
                                Publicar Foto
                            </button>
                            
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                <button 
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = resultImage;
                                        link.download = `neos_galeria_${Date.now()}.jpg`;
                                        link.click();
                                        alert("Foto salva na galeria!");
                                    }}
                                    className="py-3 md:py-4 bg-zinc-900 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1 md:gap-2 font-black uppercase text-[7px] md:text-[8px] tracking-widest text-white"
                                >
                                    <Download className="w-4 h-4" />
                                    Salvar
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedImages([resultImage]);
                                        setResultImage(null);
                                        setStep('edit');
                                        setSegmentedMasks([]);
                                        setEraseCircles([]);
                                        setCombinedMask(null);
                                        setPrompt('');
                                    }}
                                    className="py-3 md:py-4 bg-fuchsia-600/20 border border-fuchsia-500/30 rounded-2xl flex flex-col items-center justify-center gap-1 md:gap-2 font-black uppercase text-[7px] md:text-[8px] tracking-widest text-white"
                                >
                                    <Sparkles className="w-4 h-4 text-fuchsia-400" />
                                    Continuar Editando
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                <button 
                                    onClick={() => {
                                        setMode('edit');
                                        setSelectedImages([resultImage]);
                                        setResultImage(null);
                                        setStep('edit');
                                        setPrompt('Adicione um efeito cinematográfico e vibrante');
                                    }}
                                    className="py-3 md:py-4 bg-zinc-900 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1 md:gap-2 font-black uppercase text-[7px] md:text-[8px] tracking-widest text-white"
                                >
                                    <Wand2 className="w-4 h-4" />
                                    Efeito
                                </button>
                                <button 
                                    onClick={() => {
                                        setStep('edit');
                                        setResultImage(null);
                                        setSegmentedMasks([]);
                                        setEraseCircles([]);
                                        setCombinedMask(null);
                                        setDrawPath([]);
                                    }}
                                    className="py-3 md:py-4 bg-zinc-900 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1 md:gap-2 font-black uppercase text-[7px] md:text-[8px] tracking-widest text-white"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Refazer
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default GaleriaFuturoModal;
