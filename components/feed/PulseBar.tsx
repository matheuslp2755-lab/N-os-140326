import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { VerifiedBadge } from '../profile/UserProfile';
import { auth } from '../../firebase';

type Pulse = {
    id: string;
    mediaUrl: string;
    legenda: string;
    createdAt: { seconds: number; nanoseconds: number };
    authorId: string;
};

type UserWithPulses = {
    author: {
        id: string;
        username: string;
        avatar: string;
        isVerified?: boolean;
    };
    pulses: Pulse[];
};

interface PulseBarProps {
    usersWithPulses: UserWithPulses[];
    onViewPulses: (authorId: string) => void;
}

const PulseBar: React.FC<PulseBarProps> = ({ usersWithPulses, onViewPulses }) => {
    const { t } = useLanguage();
    const currentUser = auth.currentUser;

    // Agrupa pulses do usuário atual e de terceiros
    const myPulses = usersWithPulses.find(u => u.author.id === currentUser?.uid);
    const otherUsersPulses = usersWithPulses.filter(u => u.author.id !== currentUser?.uid);

    return (
        <div className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black lg:rounded-2xl lg:border lg:mb-6 overflow-hidden">
            <div className="flex items-start gap-4 overflow-x-auto p-4 no-scrollbar">
                {/* Espaço do Usuário Atual (Seu Pulse) */}
                <div 
                    className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group text-center min-w-[72px]"
                    onClick={() => myPulses ? onViewPulses(currentUser!.uid) : null}
                >
                    <div className="relative w-16 h-16">
                        <div className={`w-full h-full rounded-full p-0.5 ${myPulses ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                            <div className="bg-white dark:bg-black p-0.5 rounded-full h-full w-full">
                                <img 
                                    src={currentUser?.photoURL || ''} 
                                    className="w-full h-full rounded-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" 
                                    alt="Meu Avatar"
                                />
                            </div>
                        </div>
                        {!myPulses && (
                             <div className="absolute bottom-0 right-0 bg-sky-500 rounded-full p-0.5 border-2 border-white dark:border-black shadow-lg">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                     <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                 </svg>
                             </div>
                        )}
                    </div>
                    <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-tighter truncate w-16">
                        {t('common.you') || 'Você'}
                    </p>
                </div>

                {/* Lista de Pulses de Amigos */}
                {otherUsersPulses.map((group) => (
                    <div 
                        key={group.author.id} 
                        className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group text-center min-w-[72px]"
                        onClick={() => onViewPulses(group.author.id)}
                    >
                        <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 group-active:scale-95 transition-transform shadow-sm">
                            <div className="bg-white dark:bg-black p-0.5 rounded-full h-full w-full">
                                <img 
                                    src={group.author.avatar} 
                                    className="w-full h-full rounded-full object-cover" 
                                    alt={group.author.username}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-tighter truncate w-16 flex items-center justify-center">
                            {group.author.username}
                            {group.author.isVerified && <VerifiedBadge className="w-2.5 h-2.5 ml-0.5" />}
                        </p>
                    </div>
                ))}
            </div>
            
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default PulseBar;