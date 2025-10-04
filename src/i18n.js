import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      app: {
        title: "Logistoria",
        welcome: "Welcome, {{name}}!",
        choose: "Choose a game or course",
        logout: "Logout",
        users: "Users",
        upgradeNeeded: "This section is available in PRO",
        upgradeCta: "Upgrade to PRO",
        adminClaimWarn: "Account is marked as admin in 'users' but has no server admin claim. Run setAdminClaim.cjs and re-login."
      },
      auth: {
        hello: "Welcome",
        signInToAccount: "Sign in to your account",
        signUp: "Sign up",
        createNew: "Create a new account",
        email: "Email",
        password: "Password",
        enterEmail: "you@email.com",
        enterPassword: "••••••••",
        show: "Show",
        hide: "Hide",
        login: "Log in",
        loginGoogle: "Sign in with Google",
        loginMagic: "Sign in via email link",
        noAccount: "No account? Sign up",
        haveAccount: "Already have an account? Log in",
        name: "Name",
        namePlaceholder: "John Smith",
        register: "Register",
        resetLink: "Forgot password?",
        resetTitle: "Password recovery",
        resetDesc: "We'll send a password reset link to your email.",
        resetSend: "Send",
        resetCancel: "Cancel",
        resetSent: "Email sent! Check your inbox.",
        resetError: "Failed to send email. Check the address.",
        invalidCreds: "Invalid email or password",
        emailInUse: "Email is already in use",
        registerError: "Registration error",
        welcomeBack: "Welcome!",
      },
      categories: {
        free: "Free games",
        board: "Board games",
        rutube: "Videos (RuTube)",
        online: "Online games",
        courses: "Courses (PDF)"
      },
      actions: {
        open: "Open",
        downloadPdf: "Download PDF",
        watchInline: "Watch inline",
        add: "Add",
        edit: "Edit",
        delete: "Delete",
        save: "Save",
        cancel: "Cancel",
        close: "Close"
      },
      admin: {
        manageUsers: "User management",
        role: "role",
        status: "status",
        blocked: "blocked",
        active: "active",
        changeRole: "Change role",
        banUnban: "Block/Unblock",
        remove: "Delete",
        cantDeleteSelf: "You can't delete yourself",
        updated: "Updated",
        error: "Error",
        added: "Item added",
        edited: "Item updated",
        removed: "Item removed",
        fillAll: "Fill in all fields",
      },
      addEdit: {
        addItem: "Add item",
        editItem: "Edit item",
        title: "Title",
        description: "Description",
        url: "URL",
        hintRutube: "Paste RuTube link: https://rutube.ru/video/...",
        hintPdf: "Path to PDF. Example: /downloads/professional-course.pdf",
      },
      modal: {
        videoTitle: "Video viewer",
        cantEmbed: "Failed to embed RuTube player or link is not embeddable.",
        openOnRutube: "Open on RuTube"
      },
      language: {
        switchLabel: "Language",
        ru: "Русский",
        en: "English"
      }
    }
  },
  ru: {
    translation: {
      app: {
        title: "Logistoria",
        welcome: "Добро пожаловать, {{name}}!",
        choose: "Выберите игру или курс",
        logout: "Выход",
        users: "Пользователи",
        upgradeNeeded: "Этот раздел доступен в PRO",
        upgradeCta: "Оформить PRO",
        adminClaimWarn: "Учётка помечена как admin в 'users', но нет серверного admin-claim. Запусти setAdminClaim.cjs и перелогинься."
      },
      auth: {
        hello: "Добро пожаловать",
        signInToAccount: "Войдите в свой аккаунт",
        signUp: "Регистрация",
        createNew: "Создайте новый аккаунт",
        email: "Email",
        password: "Пароль",
        enterEmail: "you@email.com",
        enterPassword: "••••••••",
        show: "Показать",
        hide: "Скрыть",
        login: "Войти",
        loginGoogle: "Войти через Google",
        loginMagic: "Войти по ссылке на email",
        noAccount: "Нет аккаунта? Регистрация",
        haveAccount: "Уже есть аккаунт? Войти",
        name: "Имя",
        namePlaceholder: "Иван Иванов",
        register: "Зарегистрироваться",
        resetLink: "Забыли пароль?",
        resetTitle: "Восстановление пароля",
        resetDesc: "Мы отправим письмо со ссылкой для сброса пароля.",
        resetSend: "Отправить",
        resetCancel: "Отмена",
        resetSent: "Письмо отправлено! Проверьте почту.",
        resetError: "Не удалось отправить письмо. Проверьте email.",
        invalidCreds: "Неверный email или пароль",
        emailInUse: "Email уже используется",
        registerError: "Ошибка регистрации",
        welcomeBack: "Добро пожаловать!",
      },
      categories: {
        free: "Бесплатные игры",
        board: "Настольные игры",
        rutube: "Видео (RuTube)",
        online: "Онлайн игры",
        courses: "Курсы (PDF)"
      },
      actions: {
        open: "Открыть",
        downloadPdf: "Скачать PDF",
        watchInline: "Смотреть на месте",
        add: "Добавить",
        edit: "Редактировать",
        delete: "Удалить",
        save: "Сохранить",
        cancel: "Отмена",
        close: "Закрыть"
      },
      admin: {
        manageUsers: "Управление пользователями",
        role: "роль",
        status: "статус",
        blocked: "заблокирован",
        active: "активен",
        changeRole: "Сменить роль",
        banUnban: "Заблокировать / Разблокировать",
        remove: "Удалить",
        cantDeleteSelf: "Нельзя удалить себя",
        updated: "Обновлено",
        error: "Ошибка",
        added: "Элемент добавлен",
        edited: "Элемент обновлён",
        removed: "Элемент удалён",
        fillAll: "Заполните все поля",
      },
      addEdit: {
        addItem: "Добавить элемент",
        editItem: "Редактировать",
        title: "Название",
        description: "Описание",
        url: "Ссылка",
        hintRutube: "Вставьте ссылку на RuTube: https://rutube.ru/video/...",
        hintPdf: "Путь к PDF. Пример: /downloads/professional-course.pdf",
      },
      modal: {
        videoTitle: "Просмотр видео",
        cantEmbed: "Не удалось встроить плеер RuTube или ссылка не поддерживает встраивание.",
        openOnRutube: "Открыть на RuTube"
      },
      language: {
        switchLabel: "Язык",
        ru: "Русский",
        en: "English"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
    }
  });

export default i18n;

