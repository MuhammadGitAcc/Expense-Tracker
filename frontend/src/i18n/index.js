import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/i18n/en.json';
import ar from '@/i18n/ar.json';
import { DEFAULT_LANGUAGE, LANGUAGES, STORAGE_KEYS } from '@/utils/constants';
import { storage } from '@/utils/storage';

const SUPPORTED = LANGUAGES.map((language) => language.code);

/** The saved choice, else the browser language, else English. */
function detectLanguage() {
  const saved = storage.get(STORAGE_KEYS.language);
  if (SUPPORTED.includes(saved)) return saved;
  const browser = (navigator.language || '').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browser) ? browser : DEFAULT_LANGUAGE;
}

/** Sets <html lang> and <html dir>: this is what turns the whole app right-to-left. */
export function applyDocumentLanguage(code) {
  const language = LANGUAGES.find((item) => item.code === code) ?? LANGUAGES[0];
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.dir;
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false, // resources are inline: ready at once, no suspense on the first paint
  react: { useSuspense: false },
});

applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', applyDocumentLanguage);

/** The one way to switch language: saves the choice (JSON, read by the script in index.html). */
export function changeLanguage(code) {
  if (!SUPPORTED.includes(code)) return Promise.resolve();
  storage.set(STORAGE_KEYS.language, code);
  return i18n.changeLanguage(code);
}

export default i18n;
