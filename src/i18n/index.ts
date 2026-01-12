import i18next from 'i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';

// Инициализируем i18next
i18next.init({
  lng: 'ru', // Язык по умолчанию
  fallbackLng: 'ru', // Fallback язык если перевод не найден
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  interpolation: {
    escapeValue: false, // React/Vue уже экранируют, нам не нужно
  },
});

export default i18next;

// Хелпер для получения переводчика для конкретного языка
export function getTranslator(language: string) {
  return i18next.getFixedT(language);
}
