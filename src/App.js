// src/App.js
import React, { useState, useEffect } from 'react';
import {
  Truck, BookOpen, Gamepad2, Package, Plus, Edit2, Trash2, LogOut,
  Mail, Lock, Eye, EyeOff, Users, Shield, Ban, CheckCircle, X, PlayCircle, KeyRound, LogIn
} from 'lucide-react';

import './i18n';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup,
  signOut, onAuthStateChanged, sendEmailVerification
} from 'firebase/auth';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc, getDoc
} from 'firebase/firestore';

import { sendMagicLink, completeMagicLinkSignIn } from './passwordless';
import { isDisposableEmail } from './emailUtils';
import RuTubeModal from './RuTubeModal';

// ---------- Почтовые CTA ----------
const MAIL_TO = 'project@logistoria.com';
const MAILTO_PRO = `mailto:${MAIL_TO}?subject=${encodeURIComponent('Logistoria PRO — заявка')}&body=${encodeURIComponent(
  'Здравствуйте! Хотим подключить PRO-доступ к Logistoria.\n\nКомпания/ФИО:\nКонтакты:\nКоличество пользователей:\nКомментарии:\n'
)}`;
const MAILTO_BOARD = `mailto:${MAIL_TO}?subject=${encodeURIComponent('Заказать настольные игры')}&body=${encodeURIComponent(
  'Здравствуйте! Хотим заказать настольные игры Logistoria.\n\nКомпания/ФИО:\nКонтакты:\nКакие игры интересуют:\nКоличество комплектов:\nКомментарии:\n'
)}`;

// ---------- Встроённые элементы каталога ----------
const INITIAL_GAMES = [
  // Free
  { id: 'free-1', title: 'Waremover', description: 'Управляйте складом и оптимизируйте размещение товаров', url: 'https://supplychains.github.io/waremover/', category: 'free', isBuiltIn: true, type: 'link' },
  { id: 'free-2', title: 'Shipster', description: 'Симулятор управления доставками и маршрутизацией', url: 'https://supplychains.github.io/shipster/', category: 'free', isBuiltIn: true, type: 'link' },

  // Board (Free access)
  { id: 'board-1', title: 'Krossdok', description: 'Настольная игра по управлению кросс-докингом', url: 'https://krossdok.ru', category: 'board', isBuiltIn: true, type: 'link' },
  { id: 'board-2', title: 'The Beer Game', description: 'Физическая версия классической логистической игры', url: 'https://logistoria.com/thebeergame', category: 'board', isBuiltIn: true, type: 'link' },

  // Rutube (Free access) — пополняется через админку

  // Online (PRO)
  { id: 'online-1', title: 'Supply Chain Game', description: 'Комплексная симуляция управления цепями поставок', url: 'https://supplychains.surge.sh', category: 'online', isBuiltIn: true, type: 'link' },
  { id: 'online-2', title: 'Beer Game', description: 'Классическая игра для понимания эффекта хлыста', url: 'https://beergame.logistoria.com/login.html', category: 'online', isBuiltIn: true, type: 'link' },

  // Courses (PRO)
  { id: 'course-1', title: 'Курс для профессионалов', description: 'Продвинутое обучение управлению цепями поставок', url: '/downloads/professional-course.pdf', category: 'courses', type: 'pdf', isBuiltIn: true },
  { id: 'course-2', title: 'Курс для школьников и студентов', description: 'Введение в логистику для начинающих', url: '/downloads/student-course.pdf', category: 'courses', type: 'pdf', isBuiltIn: true }
];

// Порядок секций — добавили 'contacts' в самом конце
const CATEGORIES_ORDERED = ['free', 'board', 'rutube', 'online', 'courses', 'contacts'];

// Ключи заголовков секций для i18n
const titleKeyMap = {
  free: 'sections.free',
  board: 'sections.board',
  rutube: 'sections.rutube',
  online: 'sections.online',
  courses: 'sections.courses',
  contacts: 'sections.contacts'
};

function App() {
  const { t } = useTranslation();

  // ---------- Состояния ----------
  const [currentPage, setCurrentPage] = useState('login');

  const [currentUser, setCurrentUser] = useState(null); // {id, email, name, role: 'user'|'pro'|'admin'}
  const [users, setUsers] = useState([]);

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingGame, setEditingGame] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const [notification, setNotification] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerError, setRegisterError] = useState('');

  const [formData, setFormData] = useState({ title: '', description: '', url: '' });

  const [ruModalOpen, setRuModalOpen] = useState(false);
  const [ruModalUrl, setRuModalUrl] = useState('');

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [verifyNotice, setVerifyNotice] = useState('');
  const [resendBusy, setResendBusy] = useState(false);

  const [showUsersModal, setShowUsersModal] = useState(false);

  // ---------- Завершение magic-link ----------
  useEffect(() => {
    completeMagicLinkSignIn()
      .then(async (user) => {
        if (user) {
          await ensureUserDoc(user.uid, user.email, user.displayName);
          setCurrentPage('dashboard');
          await loadGames();
        }
      })
      .catch(() => {});
  }, []);

  // ---------- Следим за auth ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.status === 'active') {
            setCurrentUser({
              id: firebaseUser.uid,
              email: firebaseUser.email,
              name: data.name,
              role: (data.role || 'user').toLowerCase()
            });
            setCurrentPage('dashboard');
            await loadGames();
            if (data.role === 'admin') await loadUsers();
          } else {
            await signOut(auth);
            showNotification(t('banners.blocked'), 'error');
          }
        } else {
          // профиль при первом входе
          const payload = {
            email: firebaseUser.email,
            name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
            role: 'user',
            status: 'active',
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, payload, { merge: true });
          setCurrentUser({
            id: firebaseUser.uid,
            email: firebaseUser.email,
            name: payload.name,
            role: payload.role
          });
          setCurrentPage('dashboard');
          await loadGames();
        }
      } else {
        setCurrentUser(null);
        setCurrentPage('login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [t]);

  // ---------- Профиль-хелпер ----------
  const ensureUserDoc = async (uid, email, displayName) => {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email,
        name: displayName || (email ? email.split('@')[0] : 'User'),
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString()
      });
      setCurrentUser({ id: uid, email, name: displayName || (email ? email.split('@')[0] : 'User'), role: 'user' });
    } else {
      const d = snap.data();
      setCurrentUser({ id: uid, email, name: d.name, role: (d.role || 'user').toLowerCase() });
    }
  };

  // ---------- Каталог ----------
  const loadGames = async () => {
    try {
      const gamesSnapshot = await getDocs(collection(db, 'games'));
      const loadedGames = gamesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setGames([...INITIAL_GAMES, ...loadedGames]);
    } catch {
      setGames(INITIAL_GAMES);
    }
  };

  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      setUsers(usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ---------- Аутентификация ----------
  const handleLogin = async () => {
    try {
      setLoginError('');
      setVerifyNotice('');
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = cred.user;
      if (!user.emailVerified) {
        await signOut(auth);
        setVerifyNotice(t('auth.verifyBanner'));
        return;
      }
      await ensureUserDoc(user.uid, user.email, user.displayName);
      showNotification(t('auth.notices.welcome'));
    } catch {
      setLoginError(t('auth.errors.badCredentials'));
    }
  };

  const handleRegister = async () => {
    if (!registerName || !registerEmail || !registerPassword) {
      setRegisterError(t('validations.fillAll'));
      return;
    }
    if (registerPassword.length < 6) {
      setRegisterError(t('auth.passwordHint'));
      return;
    }
    if (isDisposableEmail(registerEmail)) {
      setRegisterError(t('auth.errors.disposable'));
      return;
    }
    try {
      setRegisterError('');
      const cred = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      const user = cred.user;

      await setDoc(doc(db, 'users', user.uid), {
        email: registerEmail,
        name: registerName,
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString()
      });

      await sendEmailVerification(user);
      await signOut(auth);

      setIsRegistering(false);
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
      setVerifyNotice(t('auth.notices.verifySent'));
      showNotification(t('auth.notices.verifySent'));
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setRegisterError(t('auth.errors.emailInUse'));
      } else {
        setRegisterError(t('auth.errors.register'));
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      await ensureUserDoc(res.user.uid, res.user.email, res.user.displayName);
      showNotification(t('auth.notices.googleOk'));
    } catch {
      showNotification(t('auth.notices.googleErr'), 'error');
    }
  };

  const handleSendMagicLink = async () => {
    if (!loginEmail) {
      setLoginError(t('auth.errors.needEmail'));
      return;
    }
    if (isDisposableEmail(loginEmail)) {
      setLoginError(t('auth.errors.disposable'));
      return;
    }
    try {
      await sendMagicLink(loginEmail);
      showNotification(t('auth.notices.linkSent'));
    } catch {
      showNotification(t('auth.notices.linkErr'), 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLoginEmail('');
    setLoginPassword('');
  };

  const resendVerificationEmail = async () => {
    if (!loginEmail || !loginPassword) {
      setLoginError(t('auth.errors.needEmail'));
      return;
    }
    try {
      setResendBusy(true);
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = cred.user;

      if (user.emailVerified) {
        showNotification(t('auth.notices.welcome'));
        await signOut(auth);
        return;
      }

      await sendEmailVerification(user);
      await signOut(auth);
      showNotification(t('auth.notices.verifyResent'));
      setVerifyNotice(t('auth.notices.verifyResent'));
    } catch {
      setLoginError(t('auth.errors.badCredentials'));
    } finally {
      setResendBusy(false);
    }
  };

  // ---------- Управление пользователями (админ) ----------
  const handleToggleUserStatus = async (userId) => {
    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      const newStatus = snap.data().status === 'active' ? 'blocked' : 'active';
      await updateDoc(ref, { status: newStatus });
      await loadUsers();
      if (currentUser?.id === userId && newStatus === 'blocked') {
        await signOut(auth);
      }
      showNotification(t('admin.notices.statusChanged'));
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      showNotification(t('admin.notices.statusErr'), 'error');
    }
  };

  // Цикл ролей: user -> pro -> admin -> user
  const handleChangeUserRole = async (userId) => {
    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      const curr = (snap.data().role || 'user').toLowerCase();
      const next = curr === 'user' ? 'pro' : curr === 'pro' ? 'admin' : 'user';
      await updateDoc(ref, { role: next });

      if (currentUser?.id === userId) {
        setCurrentUser(prev => ({ ...prev, role: next }));
      }
      await loadUsers();
      showNotification(t('admin.notices.roleChanged', { role: next }));
    } catch (error) {
      console.error('Ошибка изменения роли:', error);
      showNotification(t('admin.notices.roleErr'), 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUser?.id) {
      showNotification(t('admin.notices.cantDeleteSelf'), 'error');
      return;
    }
    if (window.confirm('Удалить пользователя?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        await loadUsers();
        showNotification(t('admin.notices.userDeleted'));
      } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        showNotification(t('admin.notices.userDeleteErr'), 'error');
      }
    }
  };

  // ---------- CRUD каталога ----------
  const getCategoryGames = (category) => games.filter(g => g.category === category);

  const handleAddGame = async () => {
    if (!formData.title || !formData.description || !formData.url) {
      showNotification(t('validations.fillAll'), 'error');
      return;
    }
    try {
      await addDoc(collection(db, 'games'), {
        ...formData,
        category: selectedCategory,
        isBuiltIn: false,
        type:
          selectedCategory === 'courses' ? 'pdf' :
          selectedCategory === 'rutube'  ? 'rutube' :
          'link',
        createdAt: new Date().toISOString()
      });
      await loadGames();
      setShowAddModal(false);
      setFormData({ title: '', description: '', url: '' });
      setSelectedCategory(null);
      showNotification(t('modals.addTitle'));
    } catch (error) {
      console.error('Ошибка добавления элемента:', error);
      showNotification('Error', 'error');
    }
  };

  const handleEditGame = async () => {
    if (!formData.title || !formData.description || !formData.url) {
      showNotification(t('validations.fillAll'), 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'games', editingGame.id), {
        title: formData.title,
        description: formData.description,
        url: formData.url
      });
      await loadGames();
      setEditingGame(null);
      setFormData({ title: '', description: '', url: '' });
      showNotification(t('modals.editTitle'));
    } catch (error) {
      console.error('Ошибка редактирования элемента:', error);
      showNotification('Error', 'error');
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (window.confirm('Удалить элемент?')) {
      try {
        await deleteDoc(doc(db, 'games', gameId));
        await loadGames();
        showNotification(t('cards.delete'));
      } catch (error) {
        console.error('Ошибка удаления элемента:', error);
        showNotification('Error', 'error');
      }
    }
  };

  const openAddModal = (category) => {
    setSelectedCategory(category);
    setShowAddModal(true);
  };

  const openEditModal = (game) => {
    setEditingGame(game);
    setFormData({ title: game.title, description: game.description, url: game.url });
  };

  const closeModals = () => {
    setShowAddModal(false);
    setEditingGame(null);
    setShowUsersModal(false);
    setFormData({ title: '', description: '', url: '' });
    setSelectedCategory(null);
  };

  const openRutube = (url) => {
    setRuModalUrl(url);
    setRuModalOpen(true);
  };

  const openReset = () => {
    setResetEmail(loginEmail || '');
    setResetError('');
    setResetSent(false);
    setResetOpen(true);
  };

  const doReset = async () => {
    setResetError('');
    setResetSent(false);
    try {
      if (!resetEmail) {
        setResetError(t('auth.errors.needEmail'));
        return;
      }
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch {
      setResetError(t('reset.error'));
    }
  };

  // ---------- Доступы по ролям ----------
  const canAccessCategory = (categoryId) => {
    if (categoryId === 'contacts') return true; // всем доступно
    const role = (currentUser?.role || 'user').toLowerCase();
    if (role === 'admin' || role === 'pro') return true;
    return ['free', 'board', 'rutube'].includes(categoryId); // user (free)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Truck className="w-16 h-16 text-blue-600 animate-bounce" />
      </div>
    );
  }

  // ---------- LOGIN ----------
  if (currentPage === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white font-medium`}>
            {notification.message}
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full grid md:grid-cols-2">
          <div className="p-8 md:p-12">
            <div className="flex items-center gap-2 mb-8">
              <Truck className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-800">{t('app.brand')}</h1>
            </div>

            {!isRegistering ? (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">{t('app.welcome')}</h2>
                <p className="text-gray-600 mb-6">{t('auth.signInToAccount')}</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.email')}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="you@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.password')}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type={showPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
                      <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {loginError && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{loginError}</div>}

                  <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2">
                    <LogIn className="w-4 h-4" />
                    {t('auth.signIn')}
                  </button>

                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={handleGoogleLogin} className="w-full border py-3 rounded-lg flex items-center justify-center gap-2">
                      <img alt="" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />
                      {t('auth.google')}
                    </button>
                    <button onClick={handleSendMagicLink} className="w-full border py-3 rounded-lg">
                      {t('auth.magicLink')}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <button onClick={openReset} className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <KeyRound className="w-4 h-4" />
                      {t('auth.forgot')}
                    </button>
                    <button onClick={() => { setIsRegistering(true); setLoginError(''); }} className="text-blue-600 hover:text-blue-700">
                      {t('auth.register')}
                    </button>
                  </div>

                  {/* Блок верификации */}
                  {verifyNotice && (
                    <div className="bg-yellow-50 text-yellow-800 px-4 py-3 rounded-lg text-sm mt-3">
                      <div className="mb-2">{verifyNotice}</div>
                      <button
                        onClick={resendVerificationEmail}
                        className="px-3 py-2 bg-yellow-600 text-white rounded-lg disabled:opacity-60"
                        disabled={resendBusy}
                      >
                        {resendBusy ? '...' : t('auth.resend')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">{t('auth.register')}</h2>
                <p className="text-gray-600 mb-6">{t('auth.createAccount')}</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.name')}</label>
                    <input type="text" value={registerName} onChange={(e) => setRegisterName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ivan Ivanov" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.email')}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="you@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.password')}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type={showRegisterPassword ? "text" : "password"} value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRegister()} className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder={t('auth.passwordHint')} />
                      <button onClick={() => setShowRegisterPassword(!showRegisterPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showRegisterPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {registerError && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{registerError}</div>}
                  <button onClick={handleRegister} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg">{t('auth.register')}</button>
                  <div className="text-center">
                    <button onClick={() => { setIsRegistering(false); setRegisterError(''); }} className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                      {t('auth.haveAccount')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="hidden md:flex bg-gradient-to-br from-blue-600 to-indigo-700 p-12 flex-col justify-center items-center text-white">
            <Truck className="w-32 h-32 mb-8 opacity-90" />
            <h3 className="text-2xl font-bold mb-4 text-center">{t('app.brand')}</h3>
            <p className="text-blue-100 text-center">{t('app.subtitle')}</p>
          </div>
        </div>

        {/* Reset Password Modal */}
        {resetOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5" /> {t('reset.title')}</h3>
                <button onClick={() => setResetOpen(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-gray-600 mb-4">{t('reset.desc')}</p>
              <input
                type="email"
                className="w-full border rounded-lg px-3 py-2 mb-3"
                placeholder="you@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              {resetError && <div className="text-sm text-red-600 mb-2">{resetError}</div>}
              {resetSent && <div className="text-sm text-green-600 mb-2">{t('reset.sent')}</div>}
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setResetOpen(false)} className="px-4 py-2 border rounded-lg">{t('reset.cancel')}</button>
                <button onClick={doReset} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{t('reset.send')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- DASHBOARD ----------

  const categories = [
    { id: 'free',     icon: Gamepad2,   bgColor: 'bg-green-500' },
    { id: 'board',    icon: Package,    bgColor: 'bg-purple-500' },
    { id: 'rutube',   icon: PlayCircle, bgColor: 'bg-emerald-500' },
    { id: 'online',   icon: Gamepad2,   bgColor: 'bg-blue-500' },
    { id: 'courses',  icon: BookOpen,   bgColor: 'bg-orange-500' },
    // новый раздел — всегда доступен, внизу
    { id: 'contacts', icon: Mail,       bgColor: 'bg-teal-500' }
  ].sort((a,b)=> CATEGORIES_ORDERED.indexOf(a.id) - CATEGORIES_ORDERED.indexOf(b.id));

  const role = (currentUser?.role || 'user').toLowerCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white`}>
          {notification.message}
        </div>
      )}

      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold">{t('app.brand')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            {role === 'admin' && (
              <button onClick={() => setShowUsersModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg">
                <Users className="w-4 h-4" />
                {t('header.users')}
              </button>
            )}
            <span className="text-gray-600">{currentUser?.name}</span>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800">
              <LogOut className="w-4 h-4" />
              {t('header.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-2">{t('app.welcomeUser', { name: currentUser?.name || '' })}</h2>
        <p className="text-gray-600 mb-8">{t('app.pickItem')}</p>

        <div className="space-y-12">
          {categories.map(category => {
            const Icon = category.icon;
            const categoryGames = getCategoryGames(category.id);
            const canAccess = canAccessCategory(category.id);

            return (
              <section key={category.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`${category.bgColor} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">{t(titleKeyMap[category.id])}</h3>
                </div>

                {category.id === 'contacts' ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <a
                      href="https://t.me/ВАШ_ТГ_КАНАЛ"      // <= подставь свой URL Telegram-канала
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border rounded-lg p-5 hover:shadow-lg transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold mb-1">{t('contacts.tgTitle')}</div>
                        <div className="text-sm text-gray-600">{t('contacts.tgDesc')}</div>
                      </div>
                      <span className="px-4 py-2 bg-blue-600 text-white rounded-lg">{t('contacts.tgOpen')}</span>
                    </a>

                    <a
                      href="https://wa.me/ВАШ_НОМЕР_ИЛИ_ЛИНК" // <= подставь свой URL WhatsApp-чата
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border rounded-lg p-5 hover:shadow-lg transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold mb-1">{t('contacts.waTitle')}</div>
                        <div className="text-sm text-gray-600">{t('contacts.waDesc')}</div>
                      </div>
                      <span className="px-4 py-2 bg-green-600 text-white rounded-lg">{t('contacts.waOpen')}</span>
                    </a>
                  </div>
                ) : (
                  <>
                    <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 ${!canAccess ? 'opacity-70 pointer-events-none select-none' : ''}`}>
                      {categoryGames.map(game => (
                        <div key={game.id} className="border rounded-lg p-5 hover:shadow-lg transition group">
                          <div className="flex items-start justify-between mb-3">
                            {category.id === 'courses'
                              ? <BookOpen className="w-8 h-8" />
                              : category.id === 'rutube'
                              ? <PlayCircle className="w-8 h-8" />
                              : <Gamepad2 className="w-8 h-8" />
                            }
                            {role === 'admin' && !game.isBuiltIn && (
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                                <button onClick={() => openEditModal(game)} className="p-1 text-blue-600" title={t('cards.edit')}><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteGame(game.id)} className="p-1 text-red-600" title={t('cards.delete')}><Trash2 className="w-4 h-4" /></button>
                              </div>
                            )}
                          </div>

                          <h4 className="font-semibold mb-2">{game.title}</h4>
                          <p className="text-sm text-gray-600 mb-4">{game.description}</p>

                          {game.type === 'rutube' ? (
                            <button
                              onClick={() => openRutube(game.url)}
                              className={`inline-block px-4 py-2 ${category.bgColor} text-white rounded-lg hover:opacity-90 text-sm`}
                            >
                              {t('cards.watchInline')}
                            </button>
                          ) : (
                            <a
                              href={game.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-block px-4 py-2 ${category.bgColor} text-white rounded-lg hover:opacity-90 text-sm`}
                            >
                              {game.type === 'pdf' ? t('cards.downloadPdf') : t('cards.open')}
                            </a>
                          )}
                        </div>
                      ))}

                      {role === 'admin' && (
                        <button
                          onClick={() => openAddModal(category.id)}
                          className="border-2 border-dashed rounded-lg p-5 hover:border-blue-500 flex flex-col items-center justify-center min-h-[200px]"
                        >
                          <Plus className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-gray-600">{t('cards.add')}</p>
                        </button>
                      )}
                    </div>

                    {/* CTA "Заказать игры" для раздела Настольные игры */}
                    {category.id === 'board' && (
                      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-center justify-between flex-col sm:flex-row gap-3">
                        <div className="font-medium">{t('boardCta.text')}</div>
                        <a
                          href={MAILTO_BOARD}
                          className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          {t('boardCta.button')}
                        </a>
                      </div>
                    )}

                    {/* Закрытые разделы → CTA "Оформить PRO" */}
                    {!canAccess && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 flex items-center justify-between flex-col sm:flex-row gap-3">
                        <div className="font-medium">{t('proCta.text')}</div>
                        <a
                          href={MAILTO_PRO}
                          className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                        >
                          {t('proCta.button')}
                        </a>
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      </main>

      {(showAddModal || editingGame) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">{editingGame ? t('modals.editTitle') : t('modals.addTitle')}</h3>

            {!editingGame && selectedCategory === 'rutube' && (
              <div className="mb-3 text-sm text-gray-600">
                {t('modals.hints.rutube')}
              </div>
            )}
            {!editingGame && selectedCategory === 'courses' && (
              <div className="mb-3 text-sm text-gray-600">
                {t('modals.hints.courses')}
              </div>
            )}

            <div className="space-y-4">
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder={t('modals.name')}
              />
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows="3"
                placeholder={t('modals.desc')}
              />
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder={t('modals.url')}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeModals} className="flex-1 px-4 py-2 border rounded-lg">{t('modals.cancel')}</button>
              <button
                onClick={editingGame ? handleEditGame : handleAddGame}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                {editingGame ? t('modals.save') : t('cards.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {role === 'admin' && (
        showUsersModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold">{t('admin.title')}</h3>
                <button onClick={() => setShowUsersModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg mb-4">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={
                        `px-2 py-1 rounded text-xs ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800'
                        : user.role === 'pro'   ? 'bg-blue-100 text-blue-800'
                        :                          'bg-gray-100 text-gray-800'
                        }`
                      }>
                        {user.role}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {user.status === 'active' ? t('admin.active') : t('admin.blocked')}
                      </span>
                      {user.id !== currentUser?.id && (
                        <>
                          <button onClick={() => handleChangeUserRole(user.id)} className="p-2 text-purple-600" title={t('admin.cycleRoleTip')}>
                            <Shield className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleToggleUserStatus(user.id)} className="p-2 text-orange-600" title={t('admin.blockTip')}>
                            {user.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-600" title={t('admin.deleteTip')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t">
                <button onClick={() => setShowUsersModal(false)} className="w-full px-4 py-2 border rounded-lg">{t('admin.close')}</button>
              </div>
            </div>
          </div>
        )
      )}

      {/* RuTube modal */}
      <RuTubeModal
        open={ruModalOpen}
        onClose={() => setRuModalOpen(false)}
        videoUrl={ruModalUrl}
      />
    </div>
  );
}

export default App;
