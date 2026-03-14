
import React, { useState } from 'react';
import { auth, db, addDoc, collection, serverTimestamp } from '../../firebase';
import Button from '../common/Button';
import TextAreaInput from '../common/TextAreaInput';
import { useLanguage } from '../../context/LanguageContext';

interface VerificationRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    followerCount: number;
}

const VerificationRequestModal: React.FC<VerificationRequestModalProps> = ({ isOpen, onClose, followerCount }) => {
    const { t } = useLanguage();
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const MIN_FOLLOWERS = 100;
    const isEligible = followerCount >= MIN_FOLLOWERS;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEligible || !reason.trim()) return;

        setIsSubmitting(true);
        setError('');
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            await addDoc(collection(db, 'verification_requests'), {
                userId: currentUser.uid,
                username: currentUser.displayName,
                userAvatar: currentUser.photoURL,
                reason: reason.trim(),
                followerCount: followerCount,
                status: 'pending',
                timestamp: serverTimestamp()
            });

            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setReason('');
            }, 3000);
        } catch (err) {
            console.error(err);
            setError('Ocorreu um erro ao enviar sua solicitação. Tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col border dark:border-zinc-800" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b dark:border-zinc-800 text-center relative bg-zinc-50 dark:bg-zinc-900/50">
                    <h3 className="font-black text-sm uppercase tracking-[0.2em] text-sky-500">Solicitar Verificação</h3>
                    <button onClick={onClose} className="absolute right-6 top-6 text-zinc-400 hover:text-zinc-600 text-2xl font-light">&times;</button>
                </header>

                <div className="p-8 space-y-6">
                    {!isEligible ? (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700">
                                <svg className="w-10 h-10 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <h4 className="font-black text-lg">Acesso Bloqueado</h4>
                            <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                                Para solicitar o selo Néos, você precisa de no mínimo <span className="text-sky-500 font-black">{MIN_FOLLOWERS} seguidores</span>.
                            </p>
                            <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border dark:border-zinc-800">
                                <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">Seu progresso</p>
                                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                    <div className="bg-sky-500 h-full" style={{ width: `${(followerCount / MIN_FOLLOWERS) * 100}%` }}></div>
                                </div>
                                <p className="text-xs font-black text-right mt-2 text-sky-500">{followerCount} / {MIN_FOLLOWERS}</p>
                            </div>
                            <Button onClick={onClose} className="!rounded-full !py-4">Continuar Crescendo</Button>
                        </div>
                    ) : success ? (
                        <div className="text-center space-y-4 py-10 animate-fade-in">
                            <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h4 className="font-black text-xl">Solicitação Enviada!</h4>
                            <p className="text-sm text-zinc-500 font-medium">Nossa equipe analisará seu perfil em breve. Fique de olho nas suas notificações!</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <h4 className="font-black text-sm uppercase tracking-widest text-center">Por que você quer ser verificado?</h4>
                                <p className="text-[11px] text-zinc-500 text-center">O selo de verificado ajuda a autenticar perfis relevantes na rede.</p>
                            </div>

                            <TextAreaInput 
                                id="verify-reason" 
                                label="Escreva sua justificativa..." 
                                value={reason} 
                                onChange={e => setReason(e.target.value)} 
                                required
                                className="!bg-zinc-50 dark:!bg-zinc-900 !rounded-3xl border-none"
                            />

                            {error && <p className="text-red-500 text-center text-xs font-bold">{error}</p>}

                            <Button 
                                type="submit" 
                                disabled={isSubmitting || !reason.trim()}
                                className="!py-5 !rounded-full !font-black !uppercase !tracking-widest shadow-xl shadow-sky-500/20 active:scale-95 transition-all"
                            >
                                {isSubmitting ? 'Enviando Solicitação...' : 'Enviar para Análise'}
                            </Button>
                        </form>
                    )}
                </div>
                
                <footer className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t dark:border-zinc-800">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em] text-center italic">Néos Security Protocol</p>
                </footer>
            </div>
        </div>
    );
};

export default VerificationRequestModal;
