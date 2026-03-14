
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface CreateMenuModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: 'post' | 'pulse' | 'vibe' | 'paradise' | 'beam' | 'radar' | 'futurista' | 'galeria_futuro') => void;
}

const CreateMenuModal: React.FC<CreateMenuModalProps> = ({ isOpen, onClose, onSelect }) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    const MENU_ITEMS = [
        { id: 'post', label: t('header.createPost'), icon: '📷', color: 'bg-blue-500' },
        { id: 'pulse', label: t('header.createPulse'), icon: '⚡', color: 'bg-yellow-500' },
        { id: 'vibe', label: t('header.createVibe'), icon: '✨', color: 'bg-purple-600' },
        { id: 'paradise', label: 'Câmera Paradise', icon: '🏝️', color: 'bg-emerald-500' },
        { id: 'futurista', label: 'Néos Futurista', icon: '🖐️', color: 'bg-gradient-to-tr from-sky-400 to-indigo-600' },
        { id: 'radar', label: 'Radar Néos', icon: '📡', color: 'bg-indigo-600' },
        { id: 'galeria_futuro', label: 'Galeria do Futuro', icon: '🔮', color: 'bg-gradient-to-br from-fuchsia-500 to-pink-600' },
    ] as const;

    return (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div 
                className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-t-[3rem] p-8 shadow-2xl animate-slide-up border-t dark:border-zinc-800"
                onClick={e => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-zinc-200 dark:border-zinc-800 rounded-full mx-auto mb-8"></div>
                <h3 className="text-center font-black text-sm uppercase tracking-[0.3em] mb-8 text-zinc-400">Criar Novo</h3>
                
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {MENU_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => { onSelect(item.id as any); onClose(); }}
                            className="flex flex-col items-center gap-2 group active:scale-90 transition-all"
                        >
                            <div className={`w-12 h-12 ${item.color} rounded-2xl flex items-center justify-center text-2xl shadow-lg group-hover:rotate-6 transition-transform`}>
                                {item.icon}
                            </div>
                            <span className="text-[9px] font-black uppercase text-center leading-tight tracking-tighter text-zinc-600 dark:text-zinc-400">
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
                
                <button 
                    onClick={onClose}
                    className="w-full py-4 bg-zinc-100 dark:bg-zinc-900 rounded-2xl font-black uppercase text-xs tracking-widest text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </div>
    );
};

export default CreateMenuModal;
