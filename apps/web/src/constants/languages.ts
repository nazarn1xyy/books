import type { Language } from '../contexts/LanguageContext';

export interface LanguageOption {
    code: Language;
    name: string;
    flag: string;
}

export const LANGUAGES: LanguageOption[] = [
    { code: 'uk', name: 'Українська', flag: '🇺🇦' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
];
