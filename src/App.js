import React, { useState, useEffect } from 'react';
import {
  Truck, BookOpen, Gamepad2, Package, Plus, Edit2, Trash2, LogOut,
  Mail, Lock, Eye, EyeOff, Users, Shield, Ban, CheckCircle, X, PlayCircle
} from 'lucide-react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, onIdTokenChanged
} from 'firebase/auth';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc, getDoc
} from 'firebase/firestore';
import RuTubeModal from './RuTubeModal';

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
            setCurrentUser({
              id: firebaseUser.uid,
              email: firebaseUser.email,
              name: userData.name,
              role: userData.role
            });
            setCurrentPage('dashboard');
            await loadGames();
            if (userData.role === 'admin' && adminFromClaim) await loadUsers();
          } else {
            await signOut(auth);
            showNotification('Ваш аккаунт заблокирован', 'error');
          }
        } else {
          await signOut(auth);
          setLoginError('Пользователь не найден в системе');
          setCurrentUser(null);
          setCurrentPage('login');
        }
      } else {
        setCurrentUser(null);
        setCurrentPage('login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // обновляем admin-claim при изменении ID токена
  useEffect(() => {
    const sub = onIdTokenChanged(auth, async (u) => {
      if (!u) {
        setIsAdminClaim(false);
        return;
      }
      const res = await u.getIdTokenResult(true).catch(() => null);
      setIsAdminClaim(!!res?.claims?.admin);
    });
    return () => sub();
  }, []);

  const loadGames = async () => {
    try {
      const gamesSnapshot = await getDocs(collection(db, 'games'));
      const loadedGames = gamesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setGames([...INITIAL_GAMES, ...loadedGames]);
    } catch (error) {
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

  const handleLogin = async () => {
    try {
      setLoginError('');
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        setLoginError('Пользователь не найден в системе');
        return;
      }
      if (userDoc.data().status === 'blocked') {
        await signOut(auth);
        setLoginError('Ваш аккаунт заблокирован');
        return;
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

  const handleLogout = async () => {
    await signOut(auth);
    setLoginEmail('');
    setLoginPassword('');
    setIsAdminClaim(false);
  };

  const handleToggleUserStatus = async (userId) => {
    if (!isAdminClaim) {
      showNotification('Требуются права администратора', 'error');
      return;
    }
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      const newStatus = userDoc.data().status === 'active' ? 'blocked' : 'active';
      await updateDoc(userDocRef, { status: newStatus });
      await loadUsers();
      showNotification('Статус изменен');
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      showNotification('Ошибка изменения статуса', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!isAdminClaim) {
      showNotification('Требуются права администратора', 'error');
      return;
    }
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

  const handleChangeUserRole = async (userId) => {
    if (!isAdminClaim) {
      showNotification('Требуются права администратора', 'error');
      return;
    }
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      const newRole = userDoc.data().role === 'admin' ? 'user' : 'admin';
      await updateDoc(userDocRef, { role: newRole });
      await loadUsers();
      showNotification('Роль изменена');
    } catch (error) {
      console.error('Ошибка изменения роли:', error);
      showNotification('Ошибка изменения роли', 'error');
    }
  };

  const getCategoryGames = (category) => games.filter(g => g.category === category);

  const handleAddGame = async () => {
    if (!isAdminClaim) {
      showNotification('Требуются права администратора', 'error');
      return;
    }
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
    if (!isAdminClaim) {
      showNotification('Требуются права администратора', 'error');
      return;
    }
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
    if (!isAdminClaim) {
      showNotification('Требуются права администратора', 'error');
      return;
    }
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
                <p className="text-gray-600 mb-8">Войдите в свой аккаунт</p>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="your@email.com" />
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
                  <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg">Войти</button>
                  <div className="text-center">
                    <button onClick={() => { setIsRegistering(true); setLoginError(''); }} className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                      Нет аккаунта? Зарегистрируйтесь
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Регистрация</h2>
                <p className="text-gray-600 mb-8">Создайте новый аккаунт</p>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Имя</label>
                    <input type="text" value={registerName} onChange={(e) => setRegisterName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Иван Иванов" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="your@email.com" />
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
                      Уже есть аккаунт? Войдите
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
      </div>
    );
  }

  const categories = [
    { id: 'free',    title: 'Бесплатные игры', icon: Gamepad2,   color: 'green',   bgColor: 'bg-green-500',   hoverColor: 'hover:bg-green-600' },
    { id: 'online',  title: 'Онлайн игры',     icon: Gamepad2,   color: 'blue',    bgColor: 'bg-blue-500',    hoverColor: 'hover:bg-blue-600' },
    { id: 'board',   title: 'Настольные игры', icon: Package,    color: 'purple',  bgColor: 'bg-purple-500',  hoverColor: 'hover:bg-purple-600' },
    { id: 'courses', title: 'Курсы (PDF)',     icon: BookOpen,   color: 'orange',  bgColor: 'bg-orange-500',  hoverColor: 'hover:bg-orange-600' },
    { id: 'videos',  title: 'Видеокурсы',      icon: PlayCircle, color: 'rose',    bgColor: 'bg-rose-500',    hoverColor: 'hover:bg-rose-600' },
    { id: 'rutube',  title: 'Видео (RuTube)',  icon: PlayCircle, color: 'emerald', bgColor: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-600' }
  ];

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
            {currentUser?.role === 'admin' && isAdminClaim && (
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
            return (
              <section key={category.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`${category.bgColor} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">{category.title}</h3>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryGames.map(game => (
                    <div key={game.id} className="border rounded-lg p-5 hover:shadow-lg transition group">
                      <div className="flex items-start justify-between mb-3">
                        {category.id === 'courses'
                          ? <BookOpen className="w-8 h-8" />
                          : <PlayCircle className="w-8 h-8" />
                        }
                        {currentUser?.role === 'admin' && isAdminClaim && !game.isBuiltIn && (
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
                          {game.type === 'pdf'
                            ? 'Скачать PDF'
                            : game.type === 'video'
                            ? 'Смотреть видео'
                            : 'Открыть'}
                        </a>
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
        </div>
      </main>

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
                Вставьте ссылку на RuTube: <code>https://rutube.ru/video/...</code> (плейлисты откроются в новой вкладке).
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
                  selectedCategory === 'courses'
                    ? 'https://.../file.pdf'
                    : selectedCategory === 'rutube'
                    ? 'https://rutube.ru/video/...'
                    : selectedCategory === 'videos'
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

      {showUsersModal && currentUser?.role === 'admin' && isAdminClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">Управление пользователями</h3>
              <button onClick={closeModals} className="text-gray-400 hover:text-gray-600">
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
                    <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'}`}>
                      {user.role}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.status}
                    </span>
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
              <button onClick={closeModals} className="w-full px-4 py-2 border rounded-lg">Закрыть</button>
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
