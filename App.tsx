import React, { useState, useEffect, StrictMode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, doc, updateDoc, serverTimestamp } from './firebase';
import Login from './components/Login';
import SignUp from './context/SignUp';
import Feed from './components/Feed';
import { LanguageProvider } from './context/LanguageContext';
import { CallProvider } from './context/CallContext';
import CallUI from './components/call/CallUI';

declare global {
  interface Window {
    OneSignalDeferred: any[];
    OneSignal: any;
  }
}

const AppContent: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    // Tenta carregar usuário da memória do celular (LocalStorage) para um carregamento instantâneo
    const cachedUserId = localStorage.getItem('neos_current_user_id');
    if (cachedUserId) {
      const cachedUser = localStorage.getItem(`neos_user_${cachedUserId}`);
      if (cachedUser) {
        // Opcional: Você pode definir um estado de 'usuário prévio' aqui se quiser
        console.log("Néos: Usuário carregado da memória local:", cachedUserId);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Sync OneSignal login
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal: any) {
          await OneSignal.login(currentUser.uid);
          console.log("Néos: OneSignal login synced:", currentUser.uid);
        });

        // Presence Logic
        const userRef = doc(db, 'users', currentUser.uid);
        const updatePresence = () => {
          updateDoc(userRef, {
            lastSeen: serverTimestamp(),
            status: 'online'
          }).catch(() => {});
        };

        updatePresence();
        const interval = setInterval(updatePresence, 60000); // Update every minute

        // Handle visibility change
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            updatePresence();
          } else {
            updateDoc(userRef, {
              status: 'offline',
              lastSeen: serverTimestamp()
            }).catch(() => {});
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
          clearInterval(interval);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          updateDoc(userRef, {
            status: 'offline',
            lastSeen: serverTimestamp()
          }).catch(() => {});
        };
      }
    });
    return () => unsubscribe();
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