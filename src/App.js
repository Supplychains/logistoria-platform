import React, { useState, useEffect } from 'react';
import {
  Truck, BookOpen, Gamepad2, Package, Plus, Edit2, Trash2, LogOut,
  Mail, Lock, Eye, EyeOff, Users, Shield, Ban, CheckCircle, X, PlayCircle,
  KeyRound, LogIn, Settings
} from 'lucide-react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup,
  signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc, getDoc
} from 'firebase/firestore';
import { sendMagicLink, completeMagicLinkSignIn } from './passwordless';
import RuTubeModal from './RuTubeModal';

// Встроенный каталог (добавится/перекроется данными из Firestore)
const INITIAL_GAMES = [
  { id: 'free-1', title: 'Waremover', description: 'Управляйте складом и оптимизируйте размещение товаров', url: 'https://supplychains.github.io/waremover/', category: 'free', isBuiltIn: true, type: 'link' },
  { id: 'free-2', title: 'Shipster', description: 'Симулятор управления доставками и маршрутизацией', url: 'https://supplychains.github.io/shipster/', category: 'free', isBuiltIn: true, type: 'link' },
  { id: 'online-1', title: 'Supply Chain Game', description: 'Комплексная симуляция управления цепями поставок', url: 'https://supplychains.surge.sh', category: 'online', isBuiltIn: true, type: 'link' },
  { id: 'online-2', title: 'Beer Game', description: 'Классическая игра для понимания эффекта хлыста', url: 'https://beergame.logistoria.com/login.html', category: 'online', isBuiltIn: true, type: 'link' },
  { id: 'board-1', title: 'Krossdok', description: 'Настольная игра по управлению кросс-докингом', url: 'https://krossdok.ru', category: 'board', isBuiltIn: true, type: 'link' },
  { id: 'board-2', title: 'The Beer Game', description: 'Физическая версия классической логистической игры', url: 'https://logistoria.com/thebeergame', category: 'board', isBuiltIn: true, type: 'link' },
  { id: 'course-1', title: 'Курс для профессионалов', description: 'Продвинутое обучение управлению цепями поставок', url: '/downloads/professional-course.pdf', category: 'courses', type: 'pdf', isBuiltIn: true },
  { id: 'course-2', title: 'Курс для школьников и студентов', description: 'Введение в логистику для начинающих', url: '/downloads/student-course.pdf', category: 'courses', type: 'pdf', isBuiltIn: true }
];

// Доступ по планам
function hasAccess(user, categoryId) {
  const plan = user?.plan || 'free';
  const matrix = {
    free:  new Set(['free']),
    basic: new Set(['free', 'online', 'rutube', 'board']), // ← добавили board
    pro:   new Set(['free', 'online', 'rutube', 'videos', 'courses', 'board']),
  };
  return matrix[plan]?.has(categoryId);
}

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingGame, setEditingGame] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [notification, setNotification] = useState(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const [formData, setFormData] = useState({ title: '', description: '', url: '' });

  // серверный custom-claim admin
  const [isAdminClaim, setIsAdminClaim] = useState(false);

  // RuTube modal
  const [ruModalOpen, setRuModalOpen] = useState(false);
  const [ruModalUrl, setRuModalUrl] = useState('');

  // Reset Password modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Settings (кнопка "Заказать")
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState({
    orderButtonText: 'Заказать',
    orderButtonLink: '',
    orderEmail: 'orders@example.com',
  });

  // обработка passwordless ссылки при загрузке
  useEffect(() => {
    completeMagicLinkSignIn()
      .then(async (user) => {
        if (user) {
          const tokenResult = await user.getIdTokenResult(true).catch(() => null);
          setIsAdminClaim(!!tokenResult?.claims?.admin);
          setCurrentPage('dashboard');
          await loadAll();
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult(true).catch(() => null);
        const adminFromClaim = !!tokenResult?.claims?.admin;
        setIsAdminClaim(adminFromClaim);

        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.status === 'active') {
            const plan = userData.plan || 'free';
            if (!userData.plan) {
              await updateDoc(userDocRef, { plan: 'free' }).catch(() => {});
            }
            setCurrentUser({
              id: firebaseUser.uid,
              email: firebaseUser.email,
              name: userData.name,
              role: userData.role,
              plan,
            });
            setCurrentPage('dashboard');
            await loadAll();
          } else {
            await signOut(auth);
            showNotification('Ваш аккаунт заблокирован', 'error');
          }
        } else {
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
            role: 'user',
            status: 'active',
            plan: 'free',
            createdAt: new Date().toISOString(),
          }, { merge: true });
          setCurrentUser({
            id: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
            role: 'user',
            plan: 'free',
          });
          setCurrentPage('dashboard');
          await loadAll();
        }
      } else {
        setCurrentUser(null);
        setCurrentPage('login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function loadAll() {
    await Promise.all([loadGames(), loadUsersIfAdmin(), loadSettings()]);
  }

  async function loadUsersIfAdmin() {
    if (currentUser?.role === 'admin') {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        setUsers(usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
      }
    }
  }

  async function loadSettings() {
    try {
      const snap = await getDoc(doc(db, 'settings', 'general'));
      if (snap.exists()) {
        const data = snap.data();
        setSettings({
          orderButtonText: data.orderButtonText || 'Заказать',
          orderButtonLink: data.orderButtonLink || '',
          orderEmail: data.orderEmail || 'orders@example.com',
        });
      }
    } catch {}
  }

  // Мердж встроенных карточек и БД: БД перекрывает BUILTIN по id, новые — добавляются.
  const loadGames = async () => {
    try {
      const gamesSnapshot = await getDocs(collection(db, 'games'));
      const dbGames = gamesSnapshot.docs.map(d => ({ id: d.id, ...d.data(), _source: 'db' }));

      const map = new Map();
      for (const g of INITIAL_GAMES) {
        map.set(g.id, { ...g, _source: 'builtin' });
      }
      for (const g of dbGames) {
        map.set(g.id, { ...map.get(g.id), ...g, _source: 'db' });
      }

      setGames(Array.from(map.values()));
    } catch (error) {
      setGames(INITIAL_GAMES.map(g => ({ ...g, _source: 'builtin' })));
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogin = async () => {
    try {
      setLoginError('');
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const ref = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(ref);
      if (!userDoc.exists()) {
        await setDoc(ref, {
          email: userCredential.user.email,
          name: userCredential.user.displayName || (userCredential.user.email ? userCredential.user.email.split('@')[0] : 'User'),
          role: 'user',
          status: 'active',
          plan: 'free',
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
      const tokenResult = await userCredential.user.getIdTokenResult(true);
      setIsAdminClaim(!!tokenResult?.claims?.admin);
      showNotification('Добро пожаловать!');
    } catch (error) {
      setLoginError('Неверный email или пароль');
    }
  };

  const handleRegister = async () => {
    if (!registerName || !registerEmail || !registerPassword) {
      setRegisterError('Заполните все поля');
      return;
    }
    if (registerPassword.length < 6) {
      setRegisterError('Пароль должен быть не менее 6 символов');
      return;
    }
    try {
      setRegisterError('');
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: registerEmail,
        name: registerName,
        role: 'user',
        status: 'active',
        plan: 'free',
        createdAt: new Date().toISOString()
      });
      showNotification('Регистрация успешна!');
      setIsRegistering(false);
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setRegisterError('Email уже используется');
      } else {
        setRegisterError('Ошибка регистрации');
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const ref = doc(db, 'users', res.user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          email: res.user.email,
          name: res.user.displayName || 'User',
          role: 'user',
          status: 'active',
          plan: 'free',
          createdAt: new Date().toISOString(),
        });
      }
      const tokenResult = await res.user.getIdTokenResult(true);
      setIsAdminClaim(!!tokenResult?.claims?.admin);
      showNotification('Вход через Google выполнен');
    } catch (e) {
      showNotification('Ошибка входа через Google', 'error');
    }
  };

  const handleSendMagicLink = async () => {
    if (!loginEmail) {
      setLoginError('Введите email для входа по ссылке');
      return;
    }
    try {
      await sendMagicLink(loginEmail);
      showNotification('Ссылка для входа отправлена на email');
    } catch (e) {
      showNotification('Не удалось отправить ссылку', 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLoginEmail('');
    setLoginPassword('');
    setIsAdminClaim(false);
  };

  const handleToggleUserStatus = async (userId) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      const newStatus = userDoc.data().status === 'active' ? 'blocked' : 'active';
      await updateDoc(userDocRef, { status: newStatus });
      await loadUsersIfAdmin();
      showNotification('Статус изменен');
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      showNotification('Ошибка изменения статуса', 'error');
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
        await loadUsersIfAdmin();
        showNotification('Пользователь удален');
      } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        showNotification('Ошибка удаления пользователя', 'error');
      }
    }
  };

  const handleChangeUserRole = async (userId) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      const newRole = userDoc.data().role === 'admin' ? 'user' : 'admin';
      await updateDoc(userDocRef, { role: newRole });
      await loadUsersIfAdmin();
      showNotification('Роль изменена');
    } catch (error) {
      console.error('Ошибка изменения роли:', error);
      showNotification('Ошибка изменения роли', 'error');
    }
  };

  const handleChangeUserPlan = async (userId, newPlan) => {
    try {
      await updateDoc(doc(db, 'users', userId), { plan: newPlan });
      await loadUsersIfAdmin();
      showNotification('План доступа изменён');
    } catch (e) {
      showNotification('Не удалось изменить план', 'error');
    }
  };

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
          selectedCategory === 'videos'  ? 'video' :
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
      const id = editingGame.id;
      await setDoc(doc(db, 'games', id), {
        title: formData.title,
        description: formData.description,
        url: formData.url,
        category: editingGame.category,
        type: editingGame.type || (
          editingGame.category === 'courses' ? 'pdf' :
          editingGame.category === 'videos'  ? 'video' :
          editingGame.category === 'rutube'  ? 'rutube' :
          'link'
        ),
        isBuiltIn: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await loadGames();
      setEditingGame(null);
      setFormData({ title: '', description: '', url: '' });
      showNotification('Элемент обновлён');
    } catch (error) {
      console.error('Ошибка редактирования элемента:', error);
      showNotification('Ошибка редактирования', 'error');
    }
  };

  const handleDeleteGame = async (game) => {
    if (game._source !== 'db') {
      showNotification('Нельзя удалить встроенный элемент. Можно отредактировать (создастся оверрайд).', 'error');
      return;
    }
    if (window.confirm('Удалить элемент?')) {
      try {
        await deleteDoc(doc(db, 'games', game.id));
        await loadGames();
        showNotification('Элемент удалён (при наличии built-in вернулся к базовой версии)');
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
    setShowSettingsModal(false);
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
    } catch (e) {
      setResetError('Не удалось отправить письмо. Проверьте email.');
    }
  };

  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        orderButtonText: settings.orderButtonText || 'Заказать',
        orderButtonLink: settings.orderButtonLink || '',
        orderEmail: settings.orderEmail || '',
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      showNotification('Настройки сохранены');
      setShowSettingsModal(false);
    } catch {
      showNotification('Не удалось сохранить настройки', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Truck className="w-16 h-16 text-blue-600 animate-bounce" />
      </div>
    );
  }

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
                <p className="text-gray-600 mb-6">Войдите в свой аккаунт любым способом</p>

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
                      Нет аккаунта? Регистрация
                    </button>
                  </div>
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

        {/* Модалка восстановления пароля */}
        {resetOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5" /> Восстановление пароля</h3>
                <button onClick={() => setResetOpen(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Мы отправим письмо со ссылкой для сброса пароля.
              </p>
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

  // Порядок категорий: RuTube выше "Видеокурсы"
  const categories = [
    { id: 'free',    title: 'Бесплатные игры', icon: Gamepad2,   color: 'green',   bgColor: 'bg-green-500',   hoverColor: 'hover:bg-green-600' },
    { id: 'online',  title: 'Онлайн игры',     icon: Gamepad2,   color: 'blue',    bgColor: 'bg-blue-500',    hoverColor: 'hover:bg-blue-600' },
    { id: 'board',   title: 'Настольные игры', icon: Package,    color: 'purple',  bgColor: 'bg-purple-500',  hoverColor: 'hover:bg-purple-600' },
    { id: 'courses', title: 'Курсы (PDF)',     icon: BookOpen,   color: 'orange',  bgColor: 'bg-orange-500',  hoverColor: 'hover:bg-orange-600' },
    { id: 'rutube',  title: 'Видео (RuTube)',  icon: PlayCircle, color: 'emerald', bgColor: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-600' },
    { id: 'videos',  title: 'Видеокурсы',      icon: PlayCircle, color: 'rose',    bgColor: 'bg-rose-500',    hoverColor: 'hover:bg-rose-600' },
  ];

  const buildOrderHref = () => {
    if (settings.orderButtonLink) return settings.orderButtonLink;
    if (settings.orderEmail) {
      const subject = encodeURIComponent('Заказ с сайта Logistoria');
      return `mailto:${settings.orderEmail}?subject=${subject}`;
    }
    return '#';
  };

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
            {currentUser?.role === 'admin' && (
              <>
                <button onClick={() => setShowUsersModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Users className="w-4 h-4" />
                  Пользователи
                </button>
                <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg">
                  <Settings className="w-4 h-4" />
                  Настройки
                </button>
              </>
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

        {!isAdminClaim && currentUser?.role === 'admin' && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
            <strong>Внимание:</strong> учётка помечена как <em>admin</em> в коллекции <code>users</code>, но нет серверного
            <code> admin</code>-claim. Добавьте claim (скрипт <code>setAdminClaim.cjs</code>) и перелогиньтесь.
          </div>
        )}

        <div className="space-y-12">
          {categories.map(category => {
            const Icon = category.icon;
            const categoryGames = getCategoryGames(category.id);

            // Админ всегда имеет доступ, иначе проверяем план
            const allowed = currentUser?.role === 'admin' ? true : hasAccess(currentUser, category.id);

            return (
              <section key={category.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`${category.bgColor} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    {category.title}
                    {!allowed && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">нет доступа</span>
                    )}
                  </h3>
                </div>

                <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 ${!allowed ? 'opacity-60 pointer-events-none select-none' : ''}`}>
                  {categoryGames.map(game => (
                    <div key={game.id} className="relative border rounded-lg p-5 hover:shadow-lg transition group">
                      <div className="flex items-start justify-between mb-3">
                        {category.id === 'courses'
                          ? <BookOpen className="w-8 h-8" />
                          : <PlayCircle className="w-8 h-8" />
                        }
                        {currentUser?.role === 'admin' && isAdminClaim && (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                            <button onClick={() => openEditModal(game)} className="p-1 text-blue-600" title="Редактировать">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {game._source === 'db' && (
                              <button onClick={() => handleDeleteGame(game)} className="p-1 text-red-600" title="Удалить">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <h4 className="font-semibold mb-2">{game.title}</h4>
                      <p className="text-sm text-gray-600 mb-4">{game.description}</p>

                      {game.type === 'rutube' ? (
                        <button
                          onClick={() => openRutube(game.url)}
                          className={`inline-block px-4 py-2 ${category.bgColor} text-white rounded-lg hover:opacity-90 text-sm`}
                          disabled={!allowed}
                        >
                          Смотреть на месте
                        </button>
                      ) : (
                        <a
                          href={allowed ? game.url : undefined}
                          onClick={(e) => { if (!allowed) e.preventDefault(); }}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-block px-4 py-2 ${category.bgColor} text-white rounded-lg hover:opacity-90 text-sm ${!allowed ? 'cursor-not-allowed' : ''}`}
                        >
                          {game.type === 'pdf'
                            ? 'Скачать PDF'
                            : game.type === 'video'
                            ? 'Смотреть видео'
                            : 'Открыть'}
                        </a>
                      )}

                      {!allowed && (
                        <div className="absolute inset-0 rounded-lg bg-white/60 backdrop-blur-[1px] flex items-end p-5">
                          <div className="w-full">
                            <a
                              href={buildOrderHref()}
                              className="w-full inline-block text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            >
                              Получить доступ
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {currentUser?.role === 'admin' && isAdminClaim && (
                    <button
                      onClick={() => openAddModal(category.id)}
                      className="border-2 border-dashed rounded-lg p-5 hover:border-blue-500 flex flex-col items-center justify-center min-h-[200px]"
                    >
                      <Plus className="w-12 h-12 text-gray-400 mb-2" />
                      <p className="text-gray-600">Добавить</p>
                    </button>
                  )}
                </div>
              </section>
            );
          })}

          {/* Кнопка "Заказать" внизу страницы */}
          <div className="pt-4">
            <a
              href={buildOrderHref()}
              className="block w-full sm:w-auto text-center px-6 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              target={settings.orderButtonLink ? '_blank' : undefined}
              rel={settings.orderButtonLink ? 'noopener noreferrer' : undefined}
            >
              {settings.orderButtonText || 'Заказать'}
            </a>
          </div>
        </div>
      </main>

      {/* Модалка добавления/редактирования карточек */}
      {(showAddModal || editingGame) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">{editingGame ? 'Редактировать' : 'Добавить элемент'}</h3>

            {!editingGame && selectedCategory === 'videos' && (
              <div className="mb-3 text-sm text-gray-600">
                Укажите ссылку на YouTube/Vimeo/MP4. Пример: <code>https://youtu.be/xxxx</code>
              </div>
            )}
            {!editingGame && selectedCategory === 'rutube' && (
              <div className="mb-3 text-sm text-gray-600">
                Вставьте ссылку на RuTube: <code>https://rutube.ru/video/...</code>
              </div>
            )}
            {!editingGame && selectedCategory === 'courses' && (
              <div className="mb-3 text-sm text-gray-600">
                Укажите путь к PDF. Пример: <code>/downloads/professional-course.pdf</code>
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
                placeholder={
                  (editingGame?.category || selectedCategory) === 'courses'
                    ? 'https://.../file.pdf'
                    : (editingGame?.category || selectedCategory) === 'rutube'
                    ? 'https://rutube.ru/video/...'
                    : (editingGame?.category || selectedCategory) === 'videos'
                    ? 'https://youtu.be/... или https://.../video.mp4'
                    : 'https://...'
                }
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

      {/* Модалка управления пользователями */}
      {showUsersModal && currentUser?.role === 'admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">Управление пользователями</h3>
              <button onClick={() => setShowUsersModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg mb-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'}`}>
                      {user.role}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.status}
                    </span>
                    <select
                      value={user.plan || 'free'}
                      onChange={(e) => handleChangeUserPlan(user.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                      title="План доступа"
                    >
                      <option value="free">free</option>
                      <option value="basic">basic</option>
                      <option value="pro">pro</option>
                    </select>
                    {user.id !== currentUser?.id && (
                      <>
                        <button onClick={() => handleChangeUserRole(user.id)} className="p-2 text-purple-600" title="Сменить роль">
                          <Shield className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleUserStatus(user.id)} className="p-2 text-orange-600" title="Заблокировать / Разблокировать">
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
      )}

      {/* Модалка настроек (кнопка "Заказать") */}
      {showSettingsModal && currentUser?.role === 'admin' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5" /> Настройки сайта
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Текст кнопки «Заказать»</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={settings.orderButtonText}
                  onChange={(e) => setSettings(s => ({ ...s, orderButtonText: e.target.value }))}
                  placeholder="Заказать"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ссылка для кнопки (необязательно)</label>
                <input
                  type="url"
                  className="w-full border rounded-lg px-3 py-2"
                  value={settings.orderButtonLink}
                  onChange={(e) => setSettings(s => ({ ...s, orderButtonLink: e.target.value }))}
                  placeholder="https://forms.yourdomain.com/order"
                />
                <p className="text-xs text-gray-500 mt-1">Если указать ссылку — кнопка откроет её в новой вкладке. Иначе откроется почтовый клиент на email ниже.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email для заказов (если ссылка пустая)</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2"
                  value={settings.orderEmail}
                  onChange={(e) => setSettings(s => ({ ...s, orderEmail: e.target.value }))}
                  placeholder="orders@example.com"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowSettingsModal(false)} className="px-4 py-2 border rounded-lg">Отмена</button>
              <button onClick={saveSettings} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Сохранить</button>
            </div>
          </div>
        </div>
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



