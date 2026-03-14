
import React, { useState, useRef, useEffect } from 'react';
import Button from '../common/Button';

interface PhotoEditorModalProps {
    isOpen: boolean;
    imageSource: string;
    onClose: () => void;
    onSave: (blob: Blob) => void;
}

const FONTS = [
    { name: 'Impacto', family: 'Impact, sans-serif' },
    { name: 'Moderna', family: 'sans-serif' },
    { name: 'Escrita', family: 'cursive' },
    { name: 'Retro', family: '"Courier New", monospace' }
];

const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({ isOpen, imageSource, onClose, onSave }) => {
    const [text, setText] = useState('');
    const [fontSize, setFontSize] = useState(40);
    const [fontFamily, setFontFamily] = useState(FONTS[0].family);
    const [textColor, setTextColor] = useState('#ffffff');
    const [textPosition, setTextPosition] = useState({ x: 50, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setTextPosition({ x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) });
    };

    const handlePointerUp = () => setIsDragging(false);

    const generateFinalImage = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            if (text) {
                const scaledSize = (fontSize / 100) * img.width * 0.15;
                ctx.font = `bold ${scaledSize}px ${fontFamily}`;
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = scaledSize * 0.1;
                
                const drawX = (textPosition.x / 100) * canvas.width;
                const drawY = (textPosition.y / 100) * canvas.height;
                
                ctx.strokeText(text, drawX, drawY);
                ctx.fillText(text, drawX, drawY);
            }

            canvas.toBlob((blob) => { if (blob) onSave(blob); }, 'image/jpeg', 0.9);
        };
        img.src = imageSource;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1100] bg-black flex flex-col animate-fade-in touch-none">
            <header className="p-4 flex justify-between items-center border-b border-white/10 bg-black/50 backdrop-blur-md">
                <button onClick={onClose} className="text-white/60 font-bold uppercase text-xs tracking-widest">Cancelar</button>
                <span className="text-white font-black uppercase text-[10px] tracking-[0.3em]">Editor Néos</span>
                <button onClick={generateFinalImage} className="text-sky-500 font-black uppercase text-xs tracking-widest">Enviar</button>
            </header>

            <div className="flex-grow flex items-center justify-center p-6 relative bg-[#050505]">
                <div 
                    ref={containerRef}
                    className="relative max-w-full max-h-full shadow-2xl overflow-hidden rounded-2xl"
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    <img src={imageSource} className="max-w-full max-h-[60vh] object-contain select-none" draggable={false} />
                    
                    {text && (
                        <div 
                            onPointerDown={handlePointerDown}
                            style={{ 
                                left: `${textPosition.x}%`, 
                                top: `${textPosition.y}%`, 
                                fontSize: `${fontSize}px`, 
                                fontFamily: fontFamily,
                                color: textColor,
                                transform: 'translate(-50%, -50%)',
                                textShadow: '0 4px 10px rgba(0,0,0,0.8)'
                            }}
                            className="absolute cursor-move whitespace-nowrap font-bold select-none p-2"
                        >
                            {text}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 bg-zinc-950 border-t border-white/5 space-y-6 pb-12">
                <div className="flex gap-4">
                    <input 
                        type="text" 
                        value={text} 
                        onChange={e => setText(e.target.value)} 
                        placeholder="Adicionar texto..." 
                        className="flex-grow bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-sky-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Fonte</label>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            {FONTS.map(f => (
                                <button 
                                    key={f.name} 
                                    onClick={() => setFontFamily(f.family)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${fontFamily === f.family ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}
                                >
                                    {f.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Tamanho</label>
                        <input type="range" min="10" max="100" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none accent-sky-500" />
                    </div>
                </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default PhotoEditorModal;
