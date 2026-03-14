
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db, setDoc, doc, storage, storageRef, uploadBytes, getDownloadURL, serverTimestamp, collection, query, where, getDocs, limit } from '../firebase';
import TextInput from '../components/common/TextInput';
import Button from '../components/common/Button';
import { useLanguage } from './LanguageContext';

const PrivacyModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border dark:border-zinc-800" onClick={e => e.stopPropagation()}>
        <header className="p-6 border-b dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <h2 className="text-xl font-black italic text-indigo-500 tracking-tighter uppercase">Política de Privacidade</h2>
          <button onClick={onClose} className="text-zinc-400 text-3xl font-thin hover:text-indigo-500 transition-colors">&times;</button>
        </header>
        <div className="flex-grow overflow-y-auto p-8 no-scrollbar text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          <p className="font-black mb-4">Última atualização: 23 de janeiro de 2026</p>
          <p className="mb-6">A Néos é uma rede social que valoriza a privacidade, a transparência e o controle dos dados pelo usuário. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos as informações dos usuários do aplicativo.</p>
          <p className="mb-6 font-bold">Ao utilizar a Néos, você concorda com as práticas descritas nesta Política.</p>
          
          <hr className="my-6 border-zinc-200 dark:border-zinc-800" />
          
          <h3 className="text-base font-black text-black dark:text-white uppercase mb-4">1. Informações que coletamos</h3>
          <p className="mb-2">Coletamos apenas os dados necessários para o funcionamento da rede social.</p>
          <p className="font-bold mt-4">1.1 Informações fornecidas pelo usuário</p>
          <ul className="list-disc ml-6 mb-4">
            <li>Endereço de e-mail</li>
            <li>ID de usuário</li>
            <li>Nome de perfil (quando fornecido)</li>
          </ul>
          <p className="font-bold mt-4">1.2 Conteúdos criados pelo usuário</p>
          <ul className="list-disc ml-6 mb-4">
            <li>Fotos</li>
            <li>Vídeos</li>
            <li>Áudios (sons ou gravações de voz)</li>
            <li>Mensagens enviadas dentro do aplicativo</li>
          </ul>
          <p className="mb-4 italic">Esses conteúdos são armazenados para permitir o funcionamento normal da plataforma e não são efêmeros, ou seja, permanecem disponíveis até que o usuário os exclua ou exclua sua conta.</p>
          
          <p className="font-bold mt-4">1.3 Informações de localização</p>
          <p className="mb-4">Localização aproximada, quando o usuário autoriza. A localização é opcional e pode ser desativada a qualquer momento nas configurações do dispositivo.</p>

          <h3 className="text-base font-black text-black dark:text-white uppercase mb-4 mt-8">2. Como utilizamos os dados</h3>
          <ul className="list-disc ml-6 mb-4">
            <li>Criar e gerenciar contas de usuários</li>
            <li>Permitir a publicação e visualização de conteúdos</li>
            <li>Viabilizar interações dentro da rede social</li>
            <li>Melhorar a experiência e a segurança do aplicativo</li>
          </ul>
          <p className="mb-4">A Néos não utiliza algoritmos de recomendação baseados em perfil comportamental.</p>

          <h3 className="text-base font-black text-black dark:text-white uppercase mb-4 mt-8">3. Compartilhamento de dados</h3>
          <p className="mb-4">A Néos não compartilha dados pessoais dos usuários com terceiros, empresas ou organizações externas. Os dados permanecem restritos ao funcionamento interno do aplicativo.</p>

          <h3 className="text-base font-black text-black dark:text-white uppercase mb-4 mt-8">4. Armazenamento e segurança</h3>
          <ul className="list-disc ml-6 mb-4">
            <li>Os dados são transmitidos por conexões seguras e criptografadas (HTTPS)</li>
            <li>Aplicamos medidas técnicas para proteger as informações contra acesso não autorizado</li>
          </ul>
          <p className="mb-4 italic text-xs">Apesar disso, nenhum sistema é totalmente seguro, e recomendamos que o usuário proteja suas credenciais.</p>

          <h3 className="text-base font-black text-black dark:text-white uppercase mb-4 mt-8">5. Exclusão de conta e dados</h3>
          <p className="mb-4">O usuário pode solicitar a exclusão da conta e dos dados associados a qualquer momento. Ao excluir a conta:</p>
          <ul className="list-disc ml-6 mb-4">
            <li>As informações pessoais são removidas</li>
            <li>Os conteúdos vinculados à conta são apagados ou anonimizados</li>
          </ul>
          <p className="mb-4">Solicitações de exclusão podem ser feitas através do link:</p>
          <p className="text-indigo-500 font-bold mb-4 underline">https://excluir-conta-neos.vercel.app</p>

          <h3 className="text-base font-black text-black dark:text-white uppercase mb-4 mt-8">6. Direitos do usuário</h3>
          <ul className="list-disc ml-6 mb-4">
            <li>Acessar seus dados</li>
            <li>Corrigir informações incorretas</li>
            <li>Excluir sua conta e dados</li>
            <li>Revogar permissões concedidas</li>
          </ul>

          <h3 className="text-base font-black text-black dark:text-white uppercase mb-4 mt-8">7. Público</h3>
          <p className="mb-4">A Néos é destinada a usuários que atendam aos requisitos legais de idade conforme a legislação aplicável.</p>

          <h3 className="text-base font-black text-black dark:text-white uppercase mb-4 mt-8">8. Alterações nesta Política</h3>
          <p className="mb-4">Esta Política de Privacidade pode ser atualizada periodicamente. Quando isso ocorrer, a data de atualização será alterada no topo deste documento. Recomendamos a revisão regular desta Política.</p>

          <h3 className="text-base font-black text-black dark:text-white uppercase mb-4 mt-8">9. Contato</h3>
          <p className="mb-10">Em caso de dúvidas sobre esta Política de Privacidade ou sobre o uso dos dados, entre em contato pelo próprio aplicativo.</p>

          <p className="text-center font-black italic text-zinc-400 mb-8 uppercase tracking-widest">Néos – Privacidade e Controle</p>
        </div>
        <footer className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t dark:border-zinc-800">
           <Button onClick={onClose} className="!rounded-full !py-3 font-black uppercase text-xs tracking-widest">Entendi e Aceito</Button>
        </footer>
      </div>
    </div>
  );
};

const SignUp: React.FC<{ onSwitchMode: () => void }> = ({ onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const { t } = useLanguage();

  const isFormValid = email.includes('@') && username.trim() !== '' && password.trim().length >= 6 && age !== '' && accepted;

  const checkUsernameAvailable = async (name: string) => {
    try {
      const q = query(collection(db, 'users'), where('username_lowercase', '==', name.toLowerCase()), limit(1));
      const snap = await getDocs(q);
      return snap.empty;
    } catch (e) {
      console.error("Erro ao verificar username:", e);
      return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!accepted) {
        setError("Você deve aceitar a Política de Privacidade.");
        return;
    }
    if (!isFormValid) {
        setError("Preencha todos os campos corretamente.");
        return;
    }
    
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 12) {
        setError("Mínimo 12 anos para participar.");
        return;
    }

    setLoading(true);
    setError('');

    try {
      const available = await checkUsernameAvailable(username);
      if (!available) {
        setError("Este nome de usuário já está em uso.");
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const initial = username.charAt(0).toUpperCase();
      const colors = ['#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];
      const color = colors[initial.charCodeAt(0) % colors.length];
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="100%" height="100%" fill="${color}" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="80" fill="#ffffff">${initial}</text></svg>`;
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
      
      const avatarRef = storageRef(storage, `avatars/${user.uid}/avatar.svg`);
      await uploadBytes(avatarRef, svgBlob);
      const avatarUrl = await getDownloadURL(avatarRef);

      await updateProfile(user, { 
        displayName: username, 
        photoURL: avatarUrl 
      });
      
      const userData = {
        uid: user.uid,
        username: username,
        username_lowercase: username.toLowerCase(),
        email: email,
        avatar: avatarUrl,
        age: ageNum,
        bio: '',
        isPrivate: false,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        isAnonymous: false,
        appearOnRadar: true,
        isVerified: false,
        isBanned: false,
        privacyAccepted: true,
        privacyAcceptedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      console.log("Néos: Conta criada!");
      
    } catch (err: any) {
      console.error("SignUp Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("E-mail já cadastrado.");
      } else if (err.code === 'auth/weak-password') {
        setError("Senha muito fraca.");
      } else {
        setError("Falha ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-6 animate-fade-in py-10">
        <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border border-white/20 dark:border-zinc-800/50 rounded-[3.5rem] p-10 md:p-12 shadow-2xl relative overflow-hidden">
            <h1 className="text-5xl font-black italic text-center mb-2 bg-gradient-to-r from-indigo-500 to-pink-500 text-transparent bg-clip-text">Néos</h1>
            <h2 className="text-zinc-500 dark:text-zinc-400 font-bold text-center mb-10 text-xs uppercase tracking-widest">
                Crie sua conta agora
            </h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-10">
                <TextInput 
                  id="email" 
                  type="email" 
                  label="E-mail" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="!rounded-2xl" 
                  required 
                />
                <TextInput 
                  id="username" 
                  type="text" 
                  label="Usuário" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  className="!rounded-2xl" 
                  required 
                />
                <TextInput 
                  id="password" 
                  type="password" 
                  label="Senha (6+ dígitos)" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="!rounded-2xl" 
                  required 
                />
                <TextInput 
                  id="age" 
                  type="number" 
                  label="Idade" 
                  value={age} 
                  onChange={e => setAge(e.target.value)} 
                  className="!rounded-2xl" 
                  required 
                />

                <div className="flex items-start gap-3 px-2 mt-2">
                    <input 
                      type="checkbox" 
                      id="privacy" 
                      checked={accepted} 
                      onChange={e => setAccepted(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="privacy" className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 leading-snug">
                        Li e aceito as <button type="button" onClick={() => setIsPrivacyModalOpen(true)} className="text-indigo-500 font-black uppercase hover:underline">Políticas de Privacidade</button> da Néos.
                    </label>
                </div>
                
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                    <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest">{error}</p>
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  disabled={!isFormValid || loading} 
                  className="mt-4 !py-4 !rounded-2xl !font-black !uppercase !bg-gradient-to-r !from-indigo-600 !to-purple-600 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
                >
                    {loading ? "Processando..." : "Finalizar Cadastro"}
                </Button>
            </form>
        </div>
        
        <div className="mt-8 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-[2.5rem] p-6 text-center">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Já tem uma conta?{' '}
                <button onClick={onSwitchMode} className="font-black text-indigo-500 hover:text-indigo-600 ml-1 uppercase text-xs tracking-wider">
                    Entrar
                </button>
            </p>
        </div>

        <PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
    </div>
  );
};

export default SignUp;
