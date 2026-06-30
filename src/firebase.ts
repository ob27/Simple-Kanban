import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: 'AIzaSyDuY8LK07SY3RNzK0aESdm76Sn5IxM-pec',
  authDomain: 'oestler.firebaseapp.com',
  projectId: 'oestler',
  storageBucket: 'oestler.firebasestorage.app',
  messagingSenderId: '20203176300',
  appId: '1:20203176300:web:04cb3e8ab566b66ddcf349',
  measurementId: 'G-BWY8GTCBX9',
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (import.meta.env.PROD) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LfV3bgsAAAAAASvjU1ei3YzvJc5XV9k1-n3hwIN'),
    isTokenAutoRefreshEnabled: true,
  });
}
