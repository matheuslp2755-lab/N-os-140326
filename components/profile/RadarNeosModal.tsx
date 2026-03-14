
import React, { useState, useEffect, useRef } from 'react';
import { auth, db, collection, query, where, getDocs, doc, updateDoc, serverTimestamp, limit, onSnapshot } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { VerifiedBadge } from './UserProfile';

interface RadarNeosModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUserMatched: (userId: string) => void;
}

const RadarNeosModal: React.FC<RadarNeosModalProps> = ({ isOpen, onClose, onUserMatched }) => {
    const { t } = useLanguage();
    const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentUser = auth.currentUser;
    const watchId = useRef<number | null>(null);

    const startRadar = async () => {
        if (!currentUser) return;
        setIsScanning(true);
        setError(null);

        if ("geolocation" in navigator) {
            watchId.current = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        radarActive: true,
                        radarLastActive: serverTimestamp(),
                        radarLocation: { 
                            lat: parseFloat(latitude.toFixed(6)), 
                            lng: parseFloat(longitude.toFixed(6)) 
                        }
                    });
                },
                (err) => {
                    console.error(err);
                    setError("Permissão de localização necessária para o Radar.");
                    setIsScanning(false);
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            );
        } else {
            setError("Seu navegador não suporta geolocalização.");
            setIsScanning(false);
        }
    };

    const stopRadar = async () => {
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
        if (currentUser) {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                radarActive: false
            });
        }
        setIsScanning(false);
        setNearbyUsers([]);
    };

    useEffect(() => {
        if (isOpen) startRadar();
        else stopRadar();
        return () => stopRadar();
    }, [isOpen]);

    useEffect(() => {
        if (!isScanning || !currentUser) return;

        const q = query(
            collection(db, 'users'),
            where('radarActive', '==', true),
            limit(15)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const now = Date.now() / 1000;
            const myUserDoc = snapshot.docs.find(d => d.id === currentUser.uid);
            if (!myUserDoc) return;
            const myLoc = myUserDoc.data().radarLocation;
            if (!myLoc) return;

            const matched = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(u => {
                    if (u.id === currentUser.uid) return false;
                    const isRecent = u.radarLastActive && (now - u.radarLastActive.seconds) < 90;
                    if (!isRecent) return false;

                    const diffLat = Math.abs(u.radarLocation.lat - myLoc.lat);
                    const diffLng = Math.abs(u.radarLocation.lng - myLoc.lng);
                    return diffLat < 0.0015 && diffLng < 0.0015; // Raio estendido para estabilidade
                });

            if (matched.length > 0 && matched.length > nearbyUsers.length) {
                if ("vibrate" in navigator) navigator.vibrate([80, 40, 80]);
            }
            setNearbyUsers(matched);
        });

        return () => unsub();
    }, [isScanning, nearbyUsers.length]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-zinc-950 z-[1200] flex flex-col items-center justify-center p-6 animate-fade-in overflow-hidden">
            <div className="absolute top-10 left-0 right-0 px-8 flex justify-between items-center z-10">
                <div className="flex flex-col">
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Radar Néos</h2>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div><span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Compartilhando Perfil</span></div>
                </div>
                <button onClick={onClose} className="p-3 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="relative w-80 h-80 flex items-center justify-center">
                <div className="absolute inset-0 border border-indigo-500/20 rounded-full animate-radar-ripple-1"></div>
                <div className="absolute inset-10 border border-indigo-500/30 rounded-full animate-radar-ripple-2"></div>
                <div className="absolute inset-20 border border-indigo-500/40 rounded-full animate-radar-ripple-3"></div>
                <div className="relative z-10 p-1 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-[0_0_40px_rgba(99,102,241,0.4)]"><div className="bg-zinc-950 p-1 rounded-full"><img src={currentUser?.photoURL || ''} className="w-24 h-24 rounded-full object-cover" /></div></div>

                {nearbyUsers.map((user, i) => (
                    <button key={user.id} onClick={() => { onUserMatched(user.id); onClose(); }} className="absolute z-20 group animate-radar-pop" style={{ transform: `rotate(${i * 45}deg) translate(140px) rotate(-${i * 45}deg)` }}>
                        <div className="relative p-1 rounded-full bg-white shadow-2xl group-hover:scale-110 transition-transform"><img src={user.avatar} className="w-16 h-16 rounded-full object-cover border-2 border-zinc-900" /><div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div></div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"><p className="text-[10px] font-black text-white uppercase flex items-center gap-1">{user.username} {user.isVerified && <VerifiedBadge className="w-2.5 h-2.5" />}</p></div>
                    </button>
                ))}
            </div>

            <div className="mt-20 text-center max-w-xs">{error ? <p className="text-red-500 text-xs font-bold uppercase tracking-widest">{error}</p> : nearbyUsers.length > 0 ? <p className="text-white font-black uppercase text-sm animate-bounce">Sinal Detectado! Toque para ver o perfil.</p> : <p className="text-zinc-500 text-xs font-medium leading-relaxed">Encoste os celulares para trocar perfis via Radar Néos.</p>}</div>

            <style>{`
                @keyframes radar-ripple { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }
                .animate-radar-ripple-1 { animation: radar-ripple 4s infinite cubic-bezier(0.16, 1, 0.3, 1); }
                .animate-radar-ripple-2 { animation: radar-ripple 4s infinite 1s cubic-bezier(0.16, 1, 0.3, 1); }
                .animate-radar-ripple-3 { animation: radar-ripple 4s infinite 2s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes radar-pop { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                .animate-radar-pop { animation: radar-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}</style>
        </div>
    );
};

export default RadarNeosModal;
