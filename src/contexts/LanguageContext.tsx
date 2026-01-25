import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import ukLocale from '../locales/uk.json';
import ruLocale from '../locales/ru.json';
import enLocale from '../locales/en.json';

export type Language = 'uk' | 'ru' | 'en';

type LocaleData = typeof ukLocale;

const locales: Record<Language, LocaleData> = {
    uk: ukLocale,
    ru: ruLocale,
    en: enLocale,
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = 'libify_language';

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
    const keys = path.split('.');
    let result: unknown = obj;

    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = (result as Record<string, unknown>)[key];
        } else {
            return undefined;
        }
    }

    return typeof result === 'string' ? result : undefined;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && ['uk', 'ru', 'en'].includes(saved)) {
            return saved as Language;
        }
        return 'uk'; // Ukrainian as default
    });

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem(STORAGE_KEY, lang);
        document.documentElement.lang = lang;
    }, []);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
        const locale = locales[language];
        let value = getNestedValue(locale as unknown as Record<string, unknown>, key);

        if (!value) {
            // Fallback to Ukrainian
            value = getNestedValue(ukLocale as unknown as Record<string, unknown>, key);
        }

        if (!value) {
            console.warn(`Missing translation: ${key}`);
            return key;
        }

        // Replace params like {count} with actual values
        if (params) {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                value = value!.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
            });
        }

        return value;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

// Shorthand hook for just translation
export function useTranslation() {
    const { t } = useLanguage();
    return t;
}
