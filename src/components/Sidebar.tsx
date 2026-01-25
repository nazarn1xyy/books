import { NavLink } from 'react-router-dom';
import { Home, Search, BookOpen, LogOut, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage, type Language } from '../contexts/LanguageContext';
import { useState } from 'react';

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
    { code: 'uk', name: 'Українська', flag: '🇺🇦' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
];

export function Sidebar() {
    const { user, signOut } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const [showLangMenu, setShowLangMenu] = useState(false);

    const navItems = [
        { to: '/', icon: Home, label: t('nav.home') },
        { to: '/search', icon: Search, label: t('nav.search') },
        { to: '/my-books', icon: BookOpen, label: t('nav.myBooks') },
    ];

    const currentLang = LANGUAGES.find(l => l.code === language);

    return (
        <aside className="desktop-only fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] bg-black/95 backdrop-blur-xl border-r border-white/10 flex flex-col z-50">
            {/* Logo */}
            <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <img src="/icon 1.png" alt="Libify" className="w-8 h-8" />
                    <span className="text-2xl font-bold text-white tracking-tight">Libify</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-white text-black font-semibold'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`
                        }
                    >
                        <Icon size={20} strokeWidth={2} />
                        <span className="text-sm">{label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Language Switcher */}
            <div className="px-4 pb-2 relative">
                <button
                    onClick={() => setShowLangMenu(!showLangMenu)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                    <Globe size={20} />
                    <span className="text-sm flex-1 text-left">{currentLang?.flag} {currentLang?.name}</span>
                </button>

                {showLangMenu && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#1C1C1E] rounded-xl border border-white/10 overflow-hidden shadow-xl">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => {
                                    setLanguage(lang.code);
                                    setShowLangMenu(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${language === lang.code
                                        ? 'bg-white/10 text-white'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <span>{lang.flag}</span>
                                <span className="text-sm">{lang.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* User section */}
            {user && (
                <div className="p-4 border-t border-white/10">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                            {user.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                                {user.email?.split('@')[0] || 'User'}
                            </p>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                            title={t('common.logout')}
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            )}
        </aside>
    );
}
