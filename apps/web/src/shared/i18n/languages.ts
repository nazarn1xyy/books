import type { Language } from './LanguageContext';

export interface LanguageOption {
    code: Language;
    name: string;
    flag: string;
}

export const DEFAULT_LANGUAGE: LanguageOption = { code: 'uk', name: 'Українська', flag: '🇺🇦' };

export const LANGUAGES: LanguageOption[] = [
    DEFAULT_LANGUAGE,
    { code: 'en', name: 'English', flag: '🇬🇧' },
];
