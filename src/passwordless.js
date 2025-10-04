import {
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
  } from 'firebase/auth';
  import { auth, db } from './firebase';
  import { doc, getDoc, setDoc } from 'firebase/firestore';
  import { isDisposableEmail } from './emailUtils';
  
  const actionCodeSettings = {
    url: window.location.origin + '/',
    handleCodeInApp: true,
  };
  
  export async function sendMagicLink(email) {
    if (isDisposableEmail(email)) {
      throw new Error('DISPOSABLE_EMAIL');
    }
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  }
  
  export async function completeMagicLinkSignIn() {
    if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  
    const saved = window.localStorage.getItem('emailForSignIn');
    const email = saved || window.prompt('Подтвердите email:');
    if (!email) return null;
  
    if (isDisposableEmail(email)) {
      alert('Этот домен e-mail не поддерживается. Укажите реальную почту.');
      return null;
    }
  
    const res = await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem('emailForSignIn');
  
    // создаём/обновляем пользователя
    const ref = doc(db, 'users', res.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email,
        name: res.user.displayName || email.split('@')[0],
        role: 'user',
        status: 'active',
        plan: 'free',
        createdAt: new Date().toISOString(),
      });
    } else if (!snap.data().plan) {
      await setDoc(ref, { plan: 'free' }, { merge: true });
    }
    return res.user;
  }
  