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

// Встроенный каталог (добавится к Firestore)
const INITIAL_GAMES = [
  // Free
  { id: 'free-1', title: 'Waremover', description: 'Управляйте складом и оптимизируйте размещение товаров', url: 'https://supplychains.github.io/waremover/', category: 'free', isBuiltIn: true, type: 'link' },
  { id: 'free-2', title: 'Shipster', description: 'Симулятор управления доставками и маршрутизацией', url: 'https://supplychains.github.io/shipster/', category: 'free', isBuiltIn: true, type: 'link' },
  // Board (Free access)
  { id: 'board-1', title: 'Krossdok', description: 'Настольная игра по управлению кросс-докингом', url: 'https://krossdok.ru', category: 'board', isBuiltIn: true, type: 'link' },
  { id: 'board-2', title: 'The Beer Game', description: 'Физическая версия классической логистической игры', url: 'https://logistoria.com/thebeergame', category: 'board', isBuiltIn: true, type: 'link' },
  // Rutube (Free access) — наполняется через админку
  // Online (PRO)
  { id: 'online-1', title: 'Supply Chain Game', description: 'Комплексная симуляция управления цепями поставок', url: 'https://supplychains.surge.sh', category: 'online', isBuiltIn: true, type: 'link' },
  { id: 'online-2', title: 'Beer Game', description: 'Классическая игра для понимания эффекта хлыста', url: 'https://beergame.logistoria.com/login.html', category: 'online', isBuiltIn: true, type: 'link' },
  // Courses (PRO)
  { id: 'course-1', title: 'Курс для профессионалов', description: 'Продвинутое обучение управлению цепями поставок', url: '/downloads/professional-course.pdf', category: 'courses', type: 'pdf', isBuiltIn: true },
  { id: 'course-2', title: 'Курс для школьников и студентов', description: 'Введение в логистику для начинающих', url: '/downloads/student-course.pdf', category: 'courses', type: 'pdf', isBuiltIn: true }
];

// Порядок секций
const CATEGORIES_ORDERED = ['free', 'board', 'rutube', 'online', 'courses'];

// mailto для PRO и Заказа настольных игр
const MAIL_TO = 'project@logistoria.com';
const MAILTO_PRO = `mailto:${MAIL_TO}?subject=${encodeURIComponent('Logistoria PRO — заявка')}&body=${encodeURIComponent(
  'Здравствуйте! Хотим подключить PRO-доступ к Logistoria.\n\nКомпания/ФИО:\nКонтакты:\nКоличество пользователей:\nКомментарии:\n'
)}`;
const MAILTO_BOARD = `mailto:${MAIL_TO}?subject=${encodeURIComponent('Заказать настольные игры')}&body=${encodeURIComponent(
  'Здравствуйте! Хотим заказать настольные игры Logistoria.\n\nКомпания/ФИО:\nКонтакты:\nКакие игры интересуют:\nКоличество комплектов:\nКомментарии:\n'
)}`;

function App() {
  const { t } = useTranslation();

  // Навигация
  const [currentPage, setCurrentPage] = useState('login');

  // Пользователь
  const [currentUser, setCurrentUser] = useState(null); // {id, email, name, role: 'user'|'pro'|'admin'}
  const [users, setUsers] = useState([]);

  // Контент
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Модалки/формы
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingGame, setEditingGame] = useState(null);

  // Логин/регистрация
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Уведомления/ошибки
  const [notification, setNotification] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerError, setRegisterError] = useState('');

  // Форма добавления/редактирования каталога
  const [formData, setFormData] = useState({ title: '', description: '', url: '' });

  // RuTube modal
  const [ruModalOpen, setRuModalOpen] = useState(false);
  const [ruModalUrl, setRuModalUrl] = useState('');

  // Reset Password modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Email verification notice
  const [verifyNotice, setVerifyNotice] = useState('');
  const [resendBusy, setResendBusy] = useState(false);

  // Завершение passwordless при открытии (если пришли по magic-link)
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

  // Следим за auth
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
            showNotification('Ваш аккаунт заблокирован', 'error');
          }
        } else {
          // Создаём профиль при первом входе любого типа
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
  }, []);

  // Хелпер — убедиться что профиль есть
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

  // ====== Каталог ======
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

  // ====== Аутентификация ======

  // ЛОГИН по паролю: блокируем вход, если email не подтверждён
  const handleLogin = async () => {
    try {
      setLoginError('');
      setVerifyNotice('');
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = cred.user;
      if (!user.emailVerified) {
        await signOut(auth);
        setVerifyNotice('Ваш e-mail не подтверждён. Проверьте почту или отправьте письмо ещё раз.');
        return;
      }
      await ensureUserDoc(user.uid, user.email, user.displayName);
      showNotification('Добро пожаловать!');
    } catch {
      setLoginError('Неверный email или пароль');
    }
  };

  // РЕГИСТРАЦИЯ: запрещаем disposable-домены, отправляем verify email и выходим
  const handleRegister = async () => {
    if (!registerName || !registerEmail || !registerPassword) {
      setRegisterError('Заполните все поля');
      return;
    }
    if (registerPassword.length < 6) {
      setRegisterError('Пароль должен быть не менее 6 символов');
      return;
    }
    if (isDisposableEmail(registerEmail)) {
      setRegisterError('Этот домен e-mail не поддерживается. Укажите реальную почту.');
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
      setVerifyNotice('Мы отправили письмо для подтверждения. Проверьте почту и перейдите по ссылке, затем войдите.');
      showNotification('Письмо для подтверждения отправлено!');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setRegisterError('Email уже используется');
      } else {
        setRegisterError('Ошибка регистрации');
      }
    }
  };

  // Google
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      await ensureUserDoc(res.user.uid, res.user.email, res.user.displayName);
      showNotification('Вход через Google выполнен');
    } catch {
      showNotification('Ошибка входа через Google', 'error');
    }
  };

  // Magic link — запрещаем disposable-домены перед отправкой
  const handleSendMagicLink = async () => {
    if (!loginEmail) {
      setLoginError('Укажите email');
      return;
    }
    if (isDisposableEmail(loginEmail)) {
      setLoginError('Этот домен e-mail не поддерживается. Укажите реальную почту.');
      return;
    }
    try {
      await sendMagicLink(loginEmail);
      showNotification('Ссылка для входа отправлена на email');
    } catch {
      showNotification('Не удалось отправить ссылку', 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLoginEmail('');
    setLoginPassword('');
  };

  // Повторная отправка письма подтверждения
  const resendVerificationEmail = async () => {
    if (!loginEmail || !loginPassword) {
      setLoginError('Укажите e-mail и пароль, чтобы отправить письмо повторно.');
      return;
    }
    try {
      setResendBusy(true);
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = cred.user;

      if (user.emailVerified) {
        showNotification('E-mail уже подтверждён. Войдите в аккаунт.');
        await signOut(auth);
        return;
      }

      await sendEmailVerification(user);
      await signOut(auth);
      showNotification('Письмо отправлено повторно. Проверьте почту.');
      setVerifyNotice('Мы снова отправили письмо. Проверьте почту.');
    } catch {
      setLoginError('Не удалось отправить письмо. Проверьте e-mail и пароль.');
    } finally {
      setResendBusy(false);
    }
  };

  // ====== Управление пользователями (админ) ======
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
      showNotification('Статус изменен');
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      showNotification('Ошибка изменения статуса', 'error');
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
      showNotification(`Роль изменена на ${next}`);
    } catch (error) {
      console.error('Ошибка изменения роли:', error);
      showNotification('Ошибка изменения роли', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUser?.id) {
      showNotification('Нельзя удалить себя', 'error');
      return;
    }
    if (window.confirm('Удалить пользователя?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        await loadUsers();
        showNotification('Пользователь удален');
      } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        showNotification('Ошибка удаления пользователя', 'error');
      }
    }
  };

  // ====== CRUD каталога ======
  const getCategoryGames = (category) => games.filter(g => g.category === category);

  const handleAddGame = async () => {
    if (!formData.title || !formData.description || !formData.url) {
      showNotification('Заполните все поля', 'error');
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
      showNotification('Элемент добавлен');
    } catch (error) {
      console.error('Ошибка добавления элемента:', error);
      showNotification('Ошибка добавления', 'error');
    }
  };

  const handleEditGame = async () => {
    if (!formData.title || !formData.description || !formData.url) {
      showNotification('Заполните все поля', 'error');
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
      showNotification('Элемент обновлён');
    } catch (error) {
      console.error('Ошибка редактирования элемента:', error);
      showNotification('Ошибка редактирования', 'error');
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (window.confirm('Удалить элемент?')) {
      try {
        await deleteDoc(doc(db, 'games', gameId));
        await loadGames();
        showNotification('Элемент удалён');
      } catch (error) {
        console.error('Ошибка удаления элемента:', error);
        showNotification('Ошибка удаления', 'error');
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
        setResetError('Укажите email');
        return;
      }
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch {
      setResetError('Не удалось отправить письмо. Проверьте email.');
    }
  };

  // Доступы по ролям
  const canAccessCategory = (categoryId) => {
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

  // === LOGIN ===
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
              <h1 className="text-2xl font-bold text-gray-800">Logistoria</h1>
            </div>

            {!isRegistering ? (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Добро пожаловать</h2>
                <p className="text-gray-600 mb-6">Войдите в свой аккаунт</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="you@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Пароль</label>
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
                    Войти
                  </button>

                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={handleGoogleLogin} className="w-full border py-3 rounded-lg flex items-center justify-center gap-2">
                      <img alt="" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />
                      Войти через Google
                    </button>
                    <button onClick={handleSendMagicLink} className="w-full border py-3 rounded-lg">
                      Войти по ссылке на email
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <button onClick={openReset} className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <KeyRound className="w-4 h-4" />
                      Забыли пароль?
                    </button>
                    <button onClick={() => { setIsRegistering(true); setLoginError(''); }} className="text-blue-600 hover:text-blue-700">
                      Регистрация
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
                        {resendBusy ? 'Отправляем…' : 'Отправить письмо ещё раз'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Регистрация</h2>
                <p className="text-gray-600 mb-6">Создайте новый аккаунт</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Имя</label>
                    <input type="text" value={registerName} onChange={(e) => setRegisterName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Иван Иванов" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="you@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Пароль</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type={showRegisterPassword ? "text" : "password"} value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRegister()} className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Минимум 6 символов" />
                      <button onClick={() => setShowRegisterPassword(!showRegisterPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showRegisterPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {registerError && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{registerError}</div>}
                  <button onClick={handleRegister} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg">Зарегистрироваться</button>
                  <div className="text-center">
                    <button onClick={() => { setIsRegistering(false); setRegisterError(''); }} className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                      Уже есть аккаунт? Войти
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="hidden md:flex bg-gradient-to-br from-blue-600 to-indigo-700 p-12 flex-col justify-center items-center text-white">
            <Truck className="w-32 h-32 mb-8 opacity-90" />
            <h3 className="text-2xl font-bold mb-4 text-center">Учитесь логистике через игры</h3>
            <p className="text-blue-100 text-center">Интерактивные симуляции и курсы</p>
          </div>
        </div>

        {/* Reset Password Modal */}
        {resetOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5" /> Восстановление пароля</h3>
                <button onClick={() => setResetOpen(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Мы отправим письмо со ссылкой для сброса пароля.</p>
              <input
                type="email"
                className="w-full border rounded-lg px-3 py-2 mb-3"
                placeholder="you@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              {resetError && <div className="text-sm text-red-600 mb-2">{resetError}</div>}
              {resetSent && <div className="text-sm text-green-600 mb-2">Письмо отправлено! Проверьте почту.</div>}
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setResetOpen(false)} className="px-4 py-2 border rounded-lg">Отмена</button>
                <button onClick={doReset} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Отправить</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === DASHBOARD ===

  const [showUsersModal, setShowUsersModal] = useState(false);

  const categories = [
    { id: 'free',    title: 'Бесплатные игры', icon: Gamepad2,  bgColor: 'bg-green-500' },
    { id: 'board',   title: 'Настольные игры', icon: Package,   bgColor: 'bg-purple-500' },
    { id: 'rutube',  title: 'Видео (RuTube)',  icon: PlayCircle,bgColor: 'bg-emerald-500' },
    { id: 'online',  title: 'Онлайн игры',     icon: Gamepad2,  bgColor: 'bg-blue-500' },
    { id: 'courses', title: 'Курсы (PDF)',     icon: BookOpen,  bgColor: 'bg-orange-500' }
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
            <h1 className="text-xl font-bold">Logistoria</h1>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            {role === 'admin' && (
              <button onClick={() => setShowUsersModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg">
                <Users className="w-4 h-4" />
                Пользователи
              </button>
            )}
            <span className="text-gray-600">{currentUser?.name}</span>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800">
              <LogOut className="w-4 h-4" />
              Выход
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-2">Добро пожаловать, {currentUser?.name}!</h2>
        <p className="text-gray-600 mb-8">Выберите игру или курс</p>

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
                  <h3 className="text-2xl font-bold">{category.title}</h3>
                </div>

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
                            <button onClick={() => openEditModal(game)} className="p-1 text-blue-600" title="Редактировать"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteGame(game.id)} className="p-1 text-red-600" title="Удалить"><Trash2 className="w-4 h-4" /></button>
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
                          Смотреть на месте
                        </button>
                      ) : (
                        <a
                          href={game.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-block px-4 py-2 ${category.bgColor} text-white rounded-lg hover:opacity-90 text-sm`}
                        >
                          {game.type === 'pdf' ? 'Скачать PDF' : 'Открыть'}
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
                      <p className="text-gray-600">Добавить</p>
                    </button>
                  )}
                </div>

                {/* Доп. плашка для "Настольные игры": показать CTA "Заказать игры" */}
                {category.id === 'board' && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-center justify-between flex-col sm:flex-row gap-3">
                    <div className="font-medium">Хотите получить физические комплекты настольных игр?</div>
                    <a
                      href={MAILTO_BOARD}
                      className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      Заказать игры
                    </a>
                  </div>
                )}

                {/* Для закрытых разделов — CTA "Оформить PRO" → письмо */}
                {!canAccess && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 flex items-center justify-between flex-col sm:flex-row gap-3">
                    <div className="font-medium">Этот раздел доступен в PRO</div>
                    <a
                      href={MAILTO_PRO}
                      className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      Оформить PRO
                    </a>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>

      {(showAddModal || editingGame) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">{editingGame ? 'Редактировать' : 'Добавить элемент'}</h3>

            {!editingGame && selectedCategory === 'rutube' && (
              <div className="mb-3 text-sm text-gray-600">
                Вставьте ссылку на RuTube: https://rutube.ru/video/...
              </div>
            )}
            {!editingGame && selectedCategory === 'courses' && (
              <div className="mb-3 text-sm text-gray-600">
                Путь к PDF. Пример: /downloads/professional-course.pdf
              </div>
            )}

            <div className="space-y-4">
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Название"
              />
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows="3"
                placeholder="Описание"
              />
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="https://..."
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeModals} className="flex-1 px-4 py-2 border rounded-lg">Отмена</button>
              <button
                onClick={editingGame ? handleEditGame : handleAddGame}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                {editingGame ? 'Сохранить' : 'Добавить'}
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
                <h3 className="text-xl font-bold">Управление пользователями</h3>
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
                        {user.status}
                      </span>
                      {user.id !== currentUser?.id && (
                        <>
                          <button onClick={() => handleChangeUserRole(user.id)} className="p-2 text-purple-600" title="Цикл ролей user→pro→admin">
                            <Shield className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleToggleUserStatus(user.id)} className="p-2 text-orange-600" title="Блок/Разблок">
                            {user.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-600" title="Удалить">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t">
                <button onClick={() => setShowUsersModal(false)} className="w-full px-4 py-2 border rounded-lg">Закрыть</button>
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

