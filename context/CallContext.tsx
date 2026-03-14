
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { auth, db, doc, addDoc, collection, onSnapshot, updateDoc, getDoc, serverTimestamp, query, where, limit, setDoc, getDocs, writeBatch } from '../firebase';

const servers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
};

type CallStatus = 'idle' | 'ringing' | 'ringing-outgoing' | 'ringing-incoming' | 'connected' | 'ended' | 'declined';

interface UserInfo { id: string; username: string; avatar: string; }
interface ActiveCall { 
    callId: string; 
    caller: UserInfo; 
    receiver: UserInfo; 
    status: CallStatus; 
    isVideo: boolean; 
    isMuted?: boolean;
    isVideoOff?: boolean;
    otherMuted?: boolean;
    otherVideoOff?: boolean;
    participants?: UserInfo[];
}

interface CallContextType {
    activeCall: ActiveCall | null;
    localStream: MediaStream | null;
    remoteStreams: Record<string, MediaStream>;
    startCall: (receiver: UserInfo, isVideo?: boolean) => Promise<void>;
    inviteParticipant: (user: UserInfo) => Promise<void>;
    answerCall: () => Promise<void>;
    hangUp: () => Promise<void>;
    declineCall: () => Promise<void>;
    switchCamera: () => Promise<void>;
    isVideoEnabled: boolean;
    toggleVideo: () => void;
    isAudioEnabled: boolean;
    toggleAudio: () => void;
    callTimeoutReached: boolean;
    resetCallState: () => void;
    isGlobalMuted: boolean;
    setGlobalMuted: (muted: boolean) => void;
    activeLive: { liveId: string; isHost: boolean } | null;
    startLive: () => Promise<void>;
    leaveLive: () => Promise<void>;
    endLive: () => Promise<void>;
    joinCall: (callId: string) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [callTimeoutReached, setCallTimeoutReached] = useState(false);
    const [isGlobalMuted, setGlobalMuted] = useState(false);
    const [activeLive, setActiveLive] = useState<{ liveId: string; isHost: boolean } | null>(null);
    
    const pcs = useRef<Record<string, RTCPeerConnection>>({});
    const timeoutRef = useRef<number | null>(null);

    const stopStream = (stream: MediaStream | null) => {
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
            });
        }
    };

    const resetCallState = useCallback(() => {
        Object.values(pcs.current).forEach((pc: RTCPeerConnection) => pc.close());
        pcs.current = {};
        
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        stopStream(localStream);
        setLocalStream(null);
        setRemoteStreams({});
        setActiveCall(null);
        setFacingMode('user');
        setIsVideoEnabled(true);
        setIsAudioEnabled(true);
        setCallTimeoutReached(false);
    }, [localStream]);

    const leaveLive = useCallback(async () => {
        stopStream(localStream);
        setLocalStream(null);
        setActiveLive(null);
    }, [localStream]);

    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
            if (!currentUser) {
                resetCallState();
                return;
            }

            const q = query(
                collection(db, 'calls'), 
                where('receiverId', '==', currentUser.uid), 
                where('status', '==', 'ringing'), 
                limit(1)
            );

            const unsubCalls = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const callDoc = snapshot.docs[0];
                    const data = callDoc.data();
                    
                    if (!activeCall || activeCall.status === 'ended' || activeCall.status === 'idle') {
                        setActiveCall({
                            callId: callDoc.id,
                            caller: { id: data.callerId, username: data.callerUsername, avatar: data.callerAvatar },
                            receiver: { id: data.receiverId, username: data.receiverUsername, avatar: data.receiverAvatar },
                            status: 'ringing-incoming',
                            isVideo: data.type === 'video',
                            otherMuted: data.isMuted,
                            otherVideoOff: data.isVideoOff,
                            participants: data.participants || []
                        });
                    }
                }
            });

            return () => unsubCalls();
        });

        return () => unsubscribeAuth();
    }, [activeCall?.status, resetCallState]);

    useEffect(() => {
        if (!activeCall?.callId) return;
        const callRef = doc(db, 'calls', activeCall.callId);
        const unsubscribe = onSnapshot(callRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;
            if (data.status === 'ended' || data.status === 'declined') {
                resetCallState();
            } else if (data.status === 'connected') {
                if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
                
                const isCaller = activeCall.caller.id === auth.currentUser?.uid;
                const otherMuted = isCaller ? data.receiverMuted : data.callerMuted;
                const otherVideoOff = isCaller ? data.receiverVideoOff : data.callerVideoOff;

                const currentPc = pcs.current[activeCall.callId];
                if (activeCall.status === 'ringing-outgoing' && data.answer && currentPc && !currentPc.currentRemoteDescription) {
                    await currentPc.setRemoteDescription(new RTCSessionDescription(data.answer));
                    setActiveCall(prev => prev ? { 
                        ...prev, 
                        status: 'connected',
                        otherMuted,
                        otherVideoOff
                    } : null);
                } else {
                    setActiveCall(prev => prev ? { 
                        ...prev, 
                        otherMuted,
                        otherVideoOff
                    } : null);
                }
            }
        });
        const callerCandidatesRef = collection(db, 'calls', activeCall.callId, 'callerCandidates');
        const receiverCandidatesRef = collection(db, 'calls', activeCall.callId, 'receiverCandidates');
        const unsubCandidates = onSnapshot(activeCall.status === 'ringing-outgoing' ? receiverCandidatesRef : callerCandidatesRef, (snap) => {
            snap.docChanges().forEach((change) => {
                const currentPc = pcs.current[activeCall.callId || ''];
                if (change.type === 'added' && currentPc && currentPc.remoteDescription) {
                    currentPc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(e => console.debug("ICE Add fail", e));
                }
            });
        });
        return () => { unsubscribe(); unsubCandidates(); };
    }, [activeCall?.callId, activeCall?.status, resetCallState]);

    const startCall = async (receiver: UserInfo, isVideo: boolean = false) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        resetCallState();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo ? { facingMode: 'user' } : false });
            setLocalStream(stream);
            setIsVideoEnabled(isVideo);
            const newPc = new RTCPeerConnection(servers);
            pcs.current['primary'] = newPc; // Temporary key until we have callId
            
            stream.getTracks().forEach(track => newPc.addTrack(track, stream));
            newPc.ontrack = (e) => {
                setRemoteStreams(prev => ({ ...prev, [receiver.id]: e.streams[0] }));
            };

            const callDocRef = await addDoc(collection(db, 'calls'), {
                callerId: currentUser.uid, callerUsername: currentUser.displayName || 'User', callerAvatar: currentUser.photoURL || '',
                receiverId: receiver.id, receiverUsername: receiver.username, receiverAvatar: receiver.avatar,
                status: 'ringing', type: isVideo ? 'video' : 'audio', timestamp: serverTimestamp(),
                participants: []
            });

            pcs.current[callDocRef.id] = newPc;
            delete pcs.current['primary'];

            newPc.onicecandidate = (e) => {
                if (e.candidate) addDoc(collection(db, 'calls', callDocRef.id, 'callerCandidates'), e.candidate.toJSON());
            };
            const offer = await newPc.createOffer();
            await newPc.setLocalDescription(offer);
            await updateDoc(callDocRef, { offer: { sdp: offer.sdp, type: offer.type } });
            setActiveCall({ callId: callDocRef.id, caller: { id: currentUser.uid, username: currentUser.displayName || '', avatar: currentUser.photoURL || '' }, receiver, status: 'ringing-outgoing', isVideo });
            timeoutRef.current = window.setTimeout(async () => {
                if (activeCall?.status !== 'connected') {
                    await updateDoc(callDocRef, { status: 'ended' });
                    setCallTimeoutReached(true);
                }
            }, 45000);
        } catch (err) { console.error(err); resetCallState(); }
    };

    const inviteParticipant = async (user: UserInfo) => {
        if (!activeCall || !localStream) return;
        // For simplicity in this 1-to-1 structure, we'll just send a message to the user
        // In a real multi-user WebRTC, we'd need a room or mesh setup.
        // Here we'll just notify them to join.
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            // Update call document with new participant
            const callRef = doc(db, 'calls', activeCall.callId);
            await updateDoc(callRef, {
                participants: [...(activeCall.participants || []), user]
            });

            // Send a message to the user (optional, but good for UX)
            const q = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid));
            const convs = await getDocs(q);
            const conv = convs.docs.find(d => d.data().participants.includes(user.id));
            
            if (conv) {
                await addDoc(collection(db, 'conversations', conv.id, 'messages'), {
                    senderId: currentUser.uid,
                    text: `Te convidei para uma chamada de ${activeCall.isVideo ? 'vídeo' : 'voz'}!`,
                    timestamp: serverTimestamp(),
                    callInviteId: activeCall.callId
                });
            }
        } catch (e) { console.error(e); }
    };

    const answerCall = async () => {
        if (!activeCall) return;
        try {
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
            const callRef = doc(db, 'calls', activeCall.callId);
            const callSnap = await getDoc(callRef);
            const data = callSnap.data();
            if (!data) return;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: activeCall.isVideo ? { facingMode: 'user' } : false });
            setLocalStream(stream);
            const newPc = new RTCPeerConnection(servers);
            pcs.current[activeCall.callId] = newPc;

            stream.getTracks().forEach(track => newPc.addTrack(track, stream));
            newPc.ontrack = (e) => {
                setRemoteStreams(prev => ({ ...prev, [activeCall.caller.id]: e.streams[0] }));
            };
            newPc.onicecandidate = (e) => {
                if (e.candidate) addDoc(collection(db, 'calls', activeCall.callId, 'receiverCandidates'), e.candidate.toJSON());
            };
            await newPc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await newPc.createAnswer();
            await newPc.setLocalDescription(answer);
            await updateDoc(callRef, { answer: { sdp: answer.sdp, type: answer.type }, status: 'connected' });
            setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
        } catch (err) { console.error(err); resetCallState(); }
    };

    const declineCall = async () => {
        if (activeCall?.callId) await updateDoc(doc(db, 'calls', activeCall.callId), { status: 'declined' });
        resetCallState();
    };

    const hangUp = async () => {
        if (activeCall?.callId) await updateDoc(doc(db, 'calls', activeCall.callId), { status: 'ended' });
        resetCallState();
    };

    const toggleVideo = () => {
        if (localStream?.getVideoTracks()[0]) {
            const newState = !localStream.getVideoTracks()[0].enabled;
            localStream.getVideoTracks()[0].enabled = newState;
            setIsVideoEnabled(newState);
            
            if (activeCall?.callId) {
                const isCaller = activeCall.caller.id === auth.currentUser?.uid;
                updateDoc(doc(db, 'calls', activeCall.callId), {
                    [isCaller ? 'callerVideoOff' : 'receiverVideoOff']: !newState
                });
            }
        }
    };

    const toggleAudio = () => {
        if (localStream?.getAudioTracks()[0]) {
            const newState = !localStream.getAudioTracks()[0].enabled;
            localStream.getAudioTracks()[0].enabled = newState;
            setIsAudioEnabled(newState);

            if (activeCall?.callId) {
                const isCaller = activeCall.caller.id === auth.currentUser?.uid;
                updateDoc(doc(db, 'calls', activeCall.callId), {
                    [isCaller ? 'callerMuted' : 'receiverMuted']: !newState
                });
            }
        }
    };

    const switchCamera = async () => {
        if (!localStream) return;
        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) return;
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        try {
            const constraints = { video: { facingMode: newMode }, audio: true };
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            const newVideoTrack = newStream.getVideoTracks()[0];
            
            Object.values(pcs.current).forEach(async (pc: RTCPeerConnection) => {
                const senders = pc.getSenders();
                const sender = senders.find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                }
            });
            
            videoTrack.stop();
            localStream.removeTrack(videoTrack);
            localStream.addTrack(newVideoTrack);
            setLocalStream(new MediaStream(localStream.getTracks()));
            setFacingMode(newMode);
        } catch (e) { console.error("Camera Switch fail", e); }
    };

    const startLive = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
            setLocalStream(stream);
            const liveRef = await addDoc(collection(db, 'lives'), {
                hostId: currentUser.uid, hostName: currentUser.displayName, hostAvatar: currentUser.photoURL,
                status: 'online', timestamp: serverTimestamp()
            });
            setActiveLive({ liveId: liveRef.id, isHost: true });
        } catch (e) { console.error(e); }
    };

    const endLive = async () => {
        if (activeLive?.isHost && activeLive.liveId) {
            try {
                await updateDoc(doc(db, 'lives', activeLive.liveId), { status: 'ended' });
                const commentsSnap = await getDocs(collection(db, 'lives', activeLive.liveId, 'comments'));
                const batch = writeBatch(db);
                commentsSnap.forEach(d => batch.delete(d.ref));
                batch.delete(doc(db, 'lives', activeLive.liveId));
                await batch.commit();
            } catch (e) { console.error(e); }
        }
        leaveLive();
    };

    const joinCall = async (callId: string) => {
        try {
            const callRef = doc(db, 'calls', callId);
            const callSnap = await getDoc(callRef);
            const data = callSnap.data();
            if (!data) return;

            setActiveCall({
                callId,
                caller: { id: data.callerId, username: data.callerUsername, avatar: data.callerAvatar },
                receiver: { id: data.receiverId, username: data.receiverUsername, avatar: data.receiverAvatar },
                status: 'ringing-incoming', // Treat as incoming to trigger answer UI
                isVideo: data.type === 'video',
                participants: data.participants || []
            });
        } catch (e) { console.error(e); }
    };

    return (
        <CallContext.Provider value={{ 
            activeCall, localStream, remoteStreams, startCall, inviteParticipant, answerCall, hangUp, declineCall, 
            switchCamera, isVideoEnabled, toggleVideo, isAudioEnabled, toggleAudio,
            callTimeoutReached, resetCallState, isGlobalMuted, setGlobalMuted, activeLive, startLive, leaveLive, endLive,
            joinCall
        }}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within a CallProvider');
    return context;
};
