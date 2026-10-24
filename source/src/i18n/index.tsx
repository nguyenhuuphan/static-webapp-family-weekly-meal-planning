import { subscribeTranslations, translationVersion } from "./automatic";
import { I18nextProvider } from "react-i18next";
import { translationEngine } from "./engine";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  languages,
  LANGUAGE_STORAGE_KEY,
  resolveLanguage,
  type Language,
} from "./catalog";
import { createTranslator } from "./translate";
export { languages, supportedLanguages, LANGUAGE_STORAGE_KEY } from "./catalog";
export type { Language } from "./catalog";

type I18n = ReturnType<typeof createTranslator> & {
  language: Language;
  setLanguage: (language: Language) => void;
};
const Context = createContext<I18n | null>(null);

function initialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    /* Language switching remains available when storage is blocked. */
  }
  return resolveLanguage(
    window.navigator.languages.length
      ? window.navigator.languages
      : [window.navigator.language],
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const translationRevision = useSyncExternalStore(
    subscribeTranslations,
    translationVersion,
    () => 0,
  );
  const value = useMemo(
    () => ({ ...createTranslator(language, true), language, setLanguage }),
    [language, translationRevision],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = value.t("pageTitle");
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* Optional persistence. */
    }
  }, [language, value]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY && isLanguage(event.newValue))
        setLanguage(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return (
    <I18nextProvider i18n={translationEngine(language)}>
      <Context.Provider value={value}>{children}</Context.Provider>
    </I18nextProvider>
  );
}

export function useI18n(): I18n {
  const value = useContext(Context);
  if (!value) throw Error("useI18n requires I18nProvider");
  return value;
}

export function useText() {
  const { language } = useI18n();
  return useMemo(
    () => (vi: string, en: string) => (language === "vi" ? vi : en),
    [language],
  );
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  return (
    <label className="language-switcher">
      <span>{t("language")}</span>
      <select
        aria-label={t("language")}
        value={language}
        onChange={(event) => {
          if (isLanguage(event.target.value)) setLanguage(event.target.value);
        }}
      >
        {Object.entries(languages).map(([code, config]) => (
          <option key={code} value={code} lang={code}>
            {config.name}
          </option>
        ))}
      </select>
    </label>
  );
}
