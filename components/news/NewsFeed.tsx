import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

const NewsFeed: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="container mx-auto max-w-lg min-h-[80vh] flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="w-full flex flex-col items-center gap-12 text-center">
                {/* Ícone de Sinal Futurista */}
                <div className="relative">
                    <div className="w-32 h-32 bg-indigo-500/5 rounded-[3rem] flex items-center justify-center border border-indigo-500/10 shadow-2xl relative z-10">
                        <svg className="w-12 h-12 text-indigo-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                    </div>
                    <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full animate-pulse"></div>
                </div>

                <div className="space-y-4 max-w-xs">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase bg-gradient-to-br from-white via-white to-indigo-400 text-transparent bg-clip-text">
                        Néos News
                    </h2>
                    <div className="h-1 w-12 bg-indigo-600 mx-auto rounded-full opacity-50"></div>
                    <p className="text-zinc-400 font-bold uppercase text-[11px] tracking-[0.4em] leading-relaxed">
                        jornal será liberado em breve
                    </p>
                </div>

                <div className="pt-10 flex flex-col items-center gap-2 opacity-20">
                    <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/20"></div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Sincronizando Frequências</span>
                </div>
            </div>

            <style>{`
                @keyframes slide-up { 
                    from { transform: translateY(30px); opacity: 0; } 
                    to { transform: translateY(0); opacity: 1; } 
                }
                .animate-slide-up { animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};

export default NewsFeed;