
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface BottomNavProps {
    currentView: 'feed' | 'vibes' | 'profile' | 'news';
    onChangeView: (view: 'feed' | 'vibes' | 'profile' | 'news') => void;
    onCreateClick: () => void;
}

const HomeIcon: React.FC<{ filled: boolean, className?: string }> = ({ filled, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
);

const PulseVideoIcon: React.FC<{ filled: boolean, className?: string }> = ({ filled, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const NewspaperIcon: React.FC<{ filled: boolean, className?: string }> = ({ filled, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
    </svg>
);

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onChangeView, onCreateClick }) => {
    const { t } = useLanguage();
    const currentUserId = localStorage.getItem('neos_current_user_id');
    const userDataStr = currentUserId ? localStorage.getItem(`neos_user_${currentUserId}`) : null;
    const userData = userDataStr ? JSON.parse(userDataStr) : null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800 z-40 pb-safe">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
                <button 
                    onClick={() => onChangeView('feed')}
                    className={`p-1.5 transition-transform active:scale-90 ${currentView === 'feed' ? 'text-black dark:text-white' : 'text-zinc-500'}`}
                    aria-label="Home"
                >
                    <HomeIcon filled={currentView === 'feed'} className="w-6 h-6" />
                </button>

                <button 
                    onClick={() => onChangeView('vibes')}
                    className={`p-1.5 transition-transform active:scale-90 ${currentView === 'vibes' ? 'text-black dark:text-white' : 'text-zinc-500'}`}
                    aria-label={t('header.vibes')}
                >
                    <PulseVideoIcon filled={currentView === 'vibes'} className="w-6 h-6" />
                </button>

                <button 
                    onClick={onCreateClick}
                    className="p-1 transition-transform active:scale-90 text-black dark:text-white"
                    aria-label={t('header.createPost')}
                >
                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1.5 border border-zinc-300 dark:border-zinc-700">
                        <PlusIcon className="w-5 h-5" />
                    </div>
                </button>

                <button 
                    onClick={() => onChangeView('news')}
                    className={`p-1.5 transition-transform active:scale-90 ${currentView === 'news' ? 'text-black dark:text-white' : 'text-zinc-500'}`}
                    aria-label={t('header.news')}
                >
                    <NewspaperIcon filled={currentView === 'news'} className="w-6 h-6" />
                </button>

                <button 
                    onClick={() => onChangeView('profile')}
                    className={`p-1.5 transition-transform active:scale-90 ${currentView === 'profile' ? 'ring-2 ring-black dark:ring-white rounded-full p-0.5' : ''}`}
                    aria-label={t('header.profile')}
                >
                    <img 
                        src={userData?.avatar || `https://i.pravatar.cc/150?u=${currentUserId}`} 
                        alt="Profile" 
                        className="w-6 h-6 rounded-full object-cover" 
                    />
                </button>
            </div>
        </div>
    );
};

export default BottomNav;
