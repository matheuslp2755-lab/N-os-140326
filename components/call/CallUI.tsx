
import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '../../context/CallContext';
import { useLanguage } from '../../context/LanguageContext';
import { auth, db, collection, query, where, getDocs } from '../../firebase';
import Button from '../common/Button';

const CallTimer: React.FC = () => {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, []);
    const formatTime = (ts: number) => {
        const m = Math.floor(ts / 60).toString().padStart(2, '0');
        const s = (ts % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };
    return <p className="text-sm font-mono text-white/70">{formatTime(seconds)}</p>;
};

const CallUI: React.FC = () => {
    const { 
        activeCall, localStream, remoteStreams, hangUp, answerCall, declineCall, 
        switchCamera, isVideoEnabled, toggleVideo, isAudioEnabled, toggleAudio,
        callTimeoutReached, startCall, resetCallState, inviteParticipant
    } = useCall();
    const { t } = useLanguage();
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const ringtoneRef = useRef<HTMLAudioElement>(null);
    
    const [isSpeakerPhone, setIsSpeakerPhone] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [following, setFollowing] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (activeCall?.status === 'ringing-incoming') {
            ringtoneRef.current?.play().catch(() => {});
        } else {
            ringtoneRef.current?.pause();
            if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
        }
    }, [activeCall?.status]);

    useEffect(() => {
        if (activeCall?.status === 'connected' || activeCall?.status === 'ringing-outgoing') {
            if (localStream && localVideoRef.current) {
                localVideoRef.current.srcObject = localStream;
            }
        }
    }, [localStream, activeCall?.status]);

    useEffect(() => {
        if (showInviteModal) {
            const currentUser = auth.currentUser;
            if (!currentUser) return;
            const q = query(collection(db, 'users'), where('followers', 'array-contains', currentUser.uid));
            getDocs(q).then(snap => {
                setFollowing(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });
        }
    }, [showInviteModal]);

    const toggleSpeakerPhone = () => {
        setIsSpeakerPhone(!isSpeakerPhone);
        // In a real app, we'd use the AudioContext or similar to route audio
    };

    if (!activeCall) return null;

    const otherUser = activeCall.receiver.id === auth.currentUser?.uid ? activeCall.caller : activeCall.receiver;
    const isVideo = activeCall.isVideo;

    const filteredFollowing = following.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
        u.id !== activeCall.caller.id &&
        u.id !== activeCall.receiver.id &&
        !(activeCall.participants || []).some((p: any) => p.id === u.id)
    );

    if (callTimeoutReached) {
        return (
            <div className="fixed inset-0 bg-zinc-950/98 backdrop-blur-3xl z-[500] flex flex-col items-center justify-center p-8 animate-fade-in">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>
                <div className="relative mb-10">
                    <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <img src={otherUser.avatar} className="relative w-32 h-32 rounded-full border-4 border-zinc-800 object-cover grayscale opacity-50 z-10" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2 z-10">Sem Resposta</h2>
                <p className="text-zinc-500 text-sm mb-12 font-medium z-10">O usuário não atendeu a chamada.</p>
                <div className="flex flex-col gap-4 w-full max-w-xs z-10">
                    <Button onClick={() => startCall(otherUser, isVideo)} className="!py-5 !rounded-2xl !bg-sky-500 !text-white !font-black !uppercase shadow-xl shadow-sky-500/10 active:scale-95 transition-all">Ligar Novamente</Button>
                    <button onClick={resetCallState} className="py-4 text-zinc-400 font-bold uppercase text-xs tracking-widest hover:text-white transition-colors">Fechar</button>
                </div>
            </div>
        );
    }

    if (activeCall.status === 'ringing-incoming') {
        return (
            <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-3xl z-[500] flex flex-col items-center justify-center p-8 animate-fade-in">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.15),transparent_70%)]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/5 rounded-full animate-[spin_20s_linear_infinite]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                </div>
                <audio ref={ringtoneRef} src="https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3" loop />
                <div className="relative mb-12">
                    <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute inset-0 bg-white/10 rounded-full animate-ping"></div>
                    <img src={otherUser.avatar} className="relative w-40 h-40 rounded-full border-4 border-white/10 object-cover shadow-2xl z-10" />
                </div>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 italic z-10 drop-shadow-2xl">{otherUser.username}</h2>
                <p className="text-indigo-400 font-black uppercase tracking-[0.4em] text-[10px] mb-24 z-10 bg-indigo-500/10 px-4 py-1 rounded-full border border-indigo-500/20">Chamada de {isVideo ? 'Vídeo' : 'Voz'} Recebida</p>

                <div className="flex gap-16 z-10">
                    <button onClick={declineCall} className="group relative w-20 h-20 flex items-center justify-center">
                        <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative w-full h-full bg-red-500 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-95 transition-all border-4 border-white/20">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                    </button>
                    <button onClick={answerCall} className="group relative w-20 h-20 flex items-center justify-center">
                        <div className="absolute inset-0 bg-green-500 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative w-full h-full bg-green-500 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-95 transition-all animate-bounce border-4 border-white/20">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black z-[500] flex flex-col overflow-hidden animate-fade-in">
            {isVideo ? (
                <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 relative">
                    {/* Remote Streams */}
                    {Object.entries(remoteStreams).map(([userId, stream]) => (
                        <div key={userId} className="relative w-full h-full rounded-3xl overflow-hidden bg-zinc-900 border border-white/10">
                            <video 
                                autoPlay 
                                playsInline 
                                ref={el => { if(el) el.srcObject = stream; }}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
                                <span className="text-white text-xs font-bold">{userId === otherUser.id ? otherUser.username : 'Convidado'}</span>
                            </div>
                        </div>
                    ))}
                    
                    {/* If no remote streams yet */}
                    {Object.keys(remoteStreams).length === 0 && (
                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center gap-4 rounded-3xl">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
                                <img src={otherUser.avatar} className="relative w-32 h-32 rounded-full border-4 border-white/10 object-cover z-10" />
                            </div>
                            <p className="text-white/40 text-xs font-black uppercase tracking-widest animate-pulse">Aguardando conexão...</p>
                        </div>
                    )}

                    <div className="absolute top-6 right-6 w-32 h-48 rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-900 z-30 group">
                        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`} style={{ transform: 'scaleX(-1)' }} />
                        {!isVideoEnabled && (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </div>
                        )}
                        <button onClick={switchCamera} className="absolute bottom-2 right-2 p-2 bg-black/40 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse"></div>
                    </div>
                    
                    {/* Remote Audios */}
                    {Object.entries(remoteStreams).map(([userId, stream]) => (
                        <audio key={userId} autoPlay playsInline ref={el => { if(el) el.srcObject = stream; }} className="hidden" />
                    ))}

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
                        <img src={otherUser.avatar} className="relative w-48 h-48 rounded-full border-8 border-white/5 object-cover z-10 shadow-2xl" />
                    </div>
                    <div className="bg-indigo-500/10 px-8 py-3 rounded-full border border-indigo-500/20 backdrop-blur-xl z-10">
                        <div className="flex gap-1.5 items-center">
                            {[1,2,3,4,5,6].map(i => <div key={i} className={`w-1.5 bg-indigo-500 rounded-full animate-wave`} style={{ animationDelay: `${i*0.1}s`, height: '16px' }}></div>)}
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute top-8 left-8 z-20 flex flex-col gap-1">
                <p className="text-white font-black text-2xl tracking-tighter drop-shadow-xl">
                    {otherUser.username}
                    {activeCall.status === 'ringing-outgoing' && <span className="ml-2 text-xs text-sky-400 animate-pulse tracking-widest uppercase">(Chamando...)</span>}
                </p>
                {activeCall.status === 'connected' && <CallTimer />}
            </div>

            <div className="absolute bottom-12 left-0 right-0 z-40 flex items-center justify-center px-6">
                <div className="bg-white/5 backdrop-blur-3xl p-4 rounded-[4rem] border border-white/10 flex items-center gap-4 sm:gap-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <button onClick={toggleAudio} className={`p-4 sm:p-5 rounded-full transition-all ${isAudioEnabled ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'}`}>
                        <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                    
                    <button onClick={() => setShowInviteModal(true)} className="p-4 sm:p-5 rounded-full bg-white/5 text-white hover:bg-white/10 transition-all">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                    </button>

                    {isVideo && (
                        <button onClick={switchCamera} className="p-4 sm:p-5 rounded-full bg-white/5 text-white hover:bg-white/10 transition-all">
                             <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    )}

                    <button onClick={hangUp} className="group relative p-5 sm:p-6 bg-red-500 rounded-full text-white shadow-2xl border-4 border-white/10 hover:bg-red-600 active:scale-90 transition-all">
                        <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-0 group-hover:opacity-50 transition-opacity"></div>
                        <svg className="relative w-8 h-8 sm:w-9 sm:h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[600] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-zinc-900 w-full max-w-md rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Convidar Amigos</h3>
                            <button onClick={() => setShowInviteModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5}/></svg>
                            </button>
                        </div>
                        <div className="p-4">
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Pesquisar amigos..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                        <div className="flex-grow overflow-y-auto p-2 space-y-1">
                            {filteredFollowing.map(user => (
                                <button 
                                    key={user.id}
                                    onClick={() => {
                                        inviteParticipant(user);
                                        setShowInviteModal(false);
                                    }}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-2xl transition-colors text-left"
                                >
                                    <img src={user.avatar} className="w-12 h-12 rounded-full object-cover" />
                                    <div className="flex-grow">
                                        <p className="text-white font-bold">{user.username}</p>
                                        <p className="text-zinc-500 text-xs">{user.nickname || 'Amigo'}</p>
                                    </div>
                                    <div className="bg-indigo-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full">Convidar</div>
                                </button>
                            ))}
                            {filteredFollowing.length === 0 && (
                                <p className="text-center text-zinc-500 py-8 text-sm">Nenhum amigo encontrado.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes wave { 0%, 100% { height: 8px; } 50% { height: 24px; } }
                .animate-wave { animation: wave 1s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default CallUI;
