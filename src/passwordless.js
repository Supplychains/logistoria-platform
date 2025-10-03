/// src/passwordless.js
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const actionCodeSettings = {
  url: 'https://logistoria-platform.vercel.app/', // <= твой сайт на Vercel
  handleCodeInApp: true,
};

// остальной код без изменений…

export async function sendMagicLink(email) {
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem('emailForSignIn', email);
}

export async function completeMagicLinkSignIn() {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    const saved = window.localStorage.getItem('emailForSignIn');
    const email = saved || window.prompt('Подтвердите email для входа:');
    const res = await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem('emailForSignIn');

    // Создаём пользователя в Firestore, если нет
    const ref = doc(db, 'users', res.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email,
        name: res.user.displayName || email.split('@')[0],
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
    }
    return res.user;
  }
  return null;
}
