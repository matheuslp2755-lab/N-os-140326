
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface MusicInfo {
  nome: string;
  artista: string;
  capa: string;
  preview: string;
  startTime?: number;
}

interface ProfileMusicPlayerProps {
  musicInfo: MusicInfo;
}

const PlayIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.002v3.996a1 1 0 001.555.832l3.197-1.998a1 1 0 000-1.664l-3.197-1.998z" clipRule="evenodd" />
    </svg>
);

const PauseIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 100-2H9V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 100-2h-1V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const SNIPPET_DURATION = 25; 

const ProfileMusicPlayer: React.FC<ProfileMusicPlayerProps> = ({ musicInfo }) => {
    const { t } = useLanguage();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(musicInfo.startTime || 0);
    const [isReady, setIsReady] = useState(false);

    const togglePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || !musicInfo.preview) return;
        
        const startTime = musicInfo.startTime || 0;

        if (isAudioPlaying) {
            audio.pause();
        } else {
            // Garantir que estamos na janela de 25s antes de dar play
            if (audio.currentTime < startTime || audio.currentTime >= startTime + SNIPPET_DURATION) {
                audio.currentTime = startTime;
            }
            audio.play().then(() => {
                setIsAudioPlaying(true);
            }).catch(err => {
                console.warn("Néos Profile Audio: Autoplay bloqueado ou falha no Android", err);
                setIsAudioPlaying(false);
            });
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !musicInfo.preview) return;

        setIsReady(false);
        setIsAudioPlaying(false);
        audio.load(); // Carregamento limpo

        const startTime = musicInfo.startTime || 0;

        const handleCanPlay = () => {
            setIsReady(true);
            audio.currentTime = startTime;
            setCurrentTime(startTime);
        };

        const handleTimeUpdate = () => {
            const time = audio.currentTime;
            if (time >= startTime + SNIPPET_DURATION) {
                audio.currentTime = startTime; 
            }
            setCurrentTime(time);
        };

        const handlePlay = () => setIsAudioPlaying(true);
        const handlePause = () => setIsAudioPlaying(false);
        const handleEnded = () => {
            setIsAudioPlaying(false);
            audio.currentTime = startTime;
        };
        const handleError = () => {
            console.error("Néos Profile Audio: Erro no elemento de áudio", audio.error);
            setIsAudioPlaying(false);
            setIsReady(false);
        };
        
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.pause();
        };
    }, [musicInfo.preview, musicInfo.startTime]);
    
    const startTime = musicInfo.startTime || 0;
    const relativeCurrentTime = Math.max(0, currentTime - startTime);
    const progressPercentage = Math.min(100, (relativeCurrentTime / SNIPPET_DURATION) * 100);

    return (
        <div className="p-2 rounded-2xl bg-zinc-100 dark:bg-zinc-900 w-full border dark:border-zinc-800 shadow-sm transition-all hover:border-sky-500/30">
            <div className="flex items-center gap-3">
                 <button 
                    onClick={togglePlayPause} 
                    disabled={!isReady}
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${isAudioPlaying ? 'bg-sky-500 text-white' : 'bg-white dark:bg-zinc-800 text-sky-500 border dark:border-zinc-700 shadow-sm'} ${!isReady ? 'opacity-30 cursor-wait' : 'hover:scale-105 active:scale-95'}`}
                    aria-label={isAudioPlaying ? "Pausar" : "Tocar"}
                >
                   {isAudioPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                </button>
                <div className="flex-grow overflow-hidden text-left">
                    <p className="font-black text-[11px] truncate uppercase tracking-tight">{musicInfo.nome}</p>
                    <p className="text-[9px] text-zinc-500 font-bold truncate uppercase opacity-70">{musicInfo.artista}</p>
                </div>
                <div className="relative w-10 h-10 flex-shrink-0 group">
                    <img src={musicInfo.capa} alt={musicInfo.nome} className="w-full h-full rounded-xl object-cover shadow-md border dark:border-zinc-800"/>
                    {isAudioPlaying && <div className="absolute inset-0 bg-sky-500/20 animate-pulse rounded-xl"></div>}
                </div>
                {musicInfo.preview && (
                    <audio 
                        key={musicInfo.preview}
                        ref={audioRef} 
                        src={musicInfo.preview} 
                        preload="auto"
                    />
                )}
            </div>
             <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 mt-2.5 overflow-hidden">
                <div 
                    className="bg-sky-500 h-full transition-all duration-100 ease-linear shadow-[0_0_8px_#0ea5e9]" 
                    style={{ width: `${progressPercentage}%` }}
                ></div>
            </div>
        </div>
    );
};

export default ProfileMusicPlayer;
