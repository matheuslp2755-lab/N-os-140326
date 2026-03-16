import React, { useState, useEffect, StrictMode } from 'react';
import Login from './components/Login';
import SignUp from './context/SignUp';
import Feed from './components/Feed';
import { LanguageProvider } from './context/LanguageContext';
import { CallProvider } from './context/CallContext';
import CallUI from './components/call/CallUI';
import { api } from './src/api';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    const cachedUserId = localStorage.getItem('neos_current_user_id');
    if (cachedUserId) {
      const cachedUserData = localStorage.getItem(`neos_user_${cachedUserId}`);
      if (cachedUserData) {
        try {
          const parsedUser = JSON.parse(cachedUserData);
          setUser(parsedUser);
          
          // Verifica se o usuário ainda é válido no servidor
          api.users.get(cachedUserId).then(data => {
            if (data && !data.error) {
              setUser(data);
              localStorage.setItem(`neos_user_${cachedUserId}`, JSON.stringify(data));
            } else {
              // Se não existir mais no servidor, desloga
              localStorage.removeItem('neos_current_user_id');
              setUser(null);
            }
          }).catch(() => {});
        } catch (e) {
          console.error("Erro ao ler cache local:", e);
        }
      }
    }
    setLoading(false);
  }, []);

  if (loading) return (
    <div className="bg-black min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-sky-500"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {authPage === 'login' ? (
        <Login onSwitchMode={() => setAuthPage('signup')} />
      ) : (
        <SignUp onSwitchMode={() => setAuthPage('login')} />
      )}
    </div>
  );

  return <Feed user={user} />;
};

const App: React.FC = () => (
  <StrictMode>
    <LanguageProvider>
      <CallProvider>
        <AppContent />
        <CallUI />
      </CallProvider>
    </LanguageProvider>
  </StrictMode>
);

export default App;