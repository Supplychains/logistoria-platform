import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage || 'ru';

  const changeLanguage = (e) => {
    const lng = e.target.value;
    i18n.changeLanguage(lng);
    try { localStorage.setItem('i18nextLng', lng); } catch {}
  };

  return (
    <select
      onChange={changeLanguage}
      value={current.startsWith('ru') ? 'ru' : 'en'}
      className="border rounded px-2 py-1 text-sm"
    >
      <option value="ru">🇷🇺 Русский</option>
      <option value="en">🇬🇧 English</option>
    </select>
  );
}
