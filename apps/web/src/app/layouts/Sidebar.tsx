import { NavLink } from 'react-router-dom';
import { Home, Search, BookOpen, LogOut, Globe } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { LANGUAGES } from '@/shared/i18n/languages';
import { SyncStatusBadge } from '@/shared/ui/SyncStatusBadge';
import { ThemeSwitcher } from '@/shared/theme/ThemeSwitcher';
import { useState, useEffect, useRef } from 'react';

export function Sidebar() {
    const { user, signOut } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const [showLangMenu, setShowLangMenu] = useState(false);
    const langMenuRef = useRef<HTMLDivElement>(null);

    const navItems = [
        { to: '/', icon: Home, label: t('nav.home') },
        { to: '/search', icon: Search, label: t('nav.search') },
        { to: '/my-books', icon: BookOpen, label: t('nav.myBooks') },
    ];

    const currentLang = LANGUAGES.find(l => l.code === language);

    // Dismiss language menu on outside click or Escape key
    useEffect(() => {
        if (!showLangMenu) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
                setShowLangMenu(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowLangMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showLangMenu]);

    return (
        <aside
            aria-label="Sidebar Navigation"
            className="desktop-only fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] bg-app/95 backdrop-blur-xl border-r border-line flex flex-col z-50"
        >
            {/* Logo */}
            <div className="p-6 border-b border-line">
                <div className="flex items-center gap-2">
                    <img src="/logo-192.png" alt="Libify Logo" width={32} height={32} className="w-8 h-8 rounded-lg" />
                    <span className="text-2xl font-bold text-fg tracking-tight">Libify</span>
                </div>
                <SyncStatusBadge className="mt-2" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2" aria-label="Main Navigation">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-accent text-on-accent font-semibold shadow-sm'
                                : 'text-muted hover:text-fg hover:bg-fg/10'
                            }`
                        }
                    >
                        <Icon size={20} strokeWidth={2} aria-hidden="true" />
                        <span className="text-sm">{label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="px-4 pb-2">
                <ThemeSwitcher />
            </div>

            {/* Language Switcher */}
            <div className="px-4 pb-2 relative" ref={langMenuRef}>
                <button
                    onClick={() => setShowLangMenu(!showLangMenu)}
                    aria-expanded={showLangMenu}
                    aria-label={t('aria.switchLanguage')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-fg hover:bg-fg/10 transition-all"
                >
                    <Globe size={20} aria-hidden="true" />
                    <span className="text-sm flex-1 text-left">{currentLang?.flag} {currentLang?.name}</span>
                </button>

                {showLangMenu && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-surface rounded-xl border border-line overflow-hidden shadow-xl z-50">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => {
                                    setLanguage(lang.code);
                                    setShowLangMenu(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${language === lang.code
                                    ? 'bg-fg/10 text-fg font-medium'
                                    : 'text-muted hover:bg-fg/5 hover:text-fg'
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
                <div className="p-4 border-t border-line">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-fg/5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                            {user.nickname[0]?.toUpperCase() ?? 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-fg text-sm font-medium truncate">
                                {user.nickname}
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                if ((await signOut()) === 'unsynced' && window.confirm(t('auth.unsyncedSignOut'))) {
                                    await signOut({ discardUnsynced: true });
                                }
                            }}
                            className="p-2 text-muted hover:text-fg transition-colors rounded-lg hover:bg-fg/10"
                            title={t('common.logout')}
                            aria-label={t('common.logout')}
                        >
                            <LogOut size={18} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}
        </aside>
    );
}
