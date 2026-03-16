
// Mock Firebase implementation to remove dependency
export const auth: any = {
  currentUser: null,
  onAuthStateChanged: (cb: any) => {
    // Custom auth logic is now in App.tsx using localStorage and API
    return () => {};
  },
  signOut: () => {
    localStorage.removeItem('neos_current_user_id');
    window.location.reload();
  }
};

export const db: any = {};
export const storage: any = {};

export const collection = (...args: any[]) => ({});
export const doc = (...args: any[]) => ({});
export const query = (...args: any[]) => ({});
export const where = (...args: any[]) => ({});
export const orderBy = (...args: any[]) => ({});
export const limit = (...args: any[]) => ({});

export const getDocs = async (...args: any[]) => ({ empty: true, docs: [] });
export const getDoc = async (...args: any[]) => ({ exists: () => false, data: () => ({}) });
export const setDoc = async (...args: any[]) => {};
export const updateDoc = async (...args: any[]) => {};
export const addDoc = async (...args: any[]) => ({ id: Date.now().toString() });
export const deleteDoc = async (...args: any[]) => {};

export const onSnapshot = (q: any, cb: any) => {
  // Mock snapshot
  return () => {};
};

export const serverTimestamp = () => new Date().toISOString();
export const Timestamp = {
  now: () => new Date(),
  fromDate: (date: Date) => date
};

export const storageRef = (storage: any, path: string) => ({ path });
export const uploadBytes = async (ref: any, blob: any) => {};
export const uploadString = async (ref: any, str: any, format: any) => {};
export const getDownloadURL = async (ref: any) => "";
export const deleteObject = async (ref: any) => {};

export const writeBatch = () => ({
  set: () => {},
  update: () => {},
  delete: () => {},
  commit: async () => {}
});

export const increment = (n: number) => n;
export const arrayUnion = (...args: any[]) => args;
export const arrayRemove = (...args: any[]) => args;

export const signInWithEmailAndPassword = async (...args: any[]) => ({ user: { uid: 'mock' } });
export const createUserWithEmailAndPassword = async (...args: any[]) => ({ user: { uid: 'mock' } });
export const sendPasswordResetEmail = async (...args: any[]) => {};
export const signInWithPopup = async (...args: any[]) => ({ user: { uid: 'mock' } });
export const GoogleAuthProvider = class {};
export const ref = (...args: any[]) => ({});
