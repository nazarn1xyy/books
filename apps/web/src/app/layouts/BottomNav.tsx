import { NavLink } from 'react-router-dom';
import { Home, Search, BookOpen } from 'lucide-react';
import { useKeyboardHeight } from '@/shared/lib/hooks/useKeyboardHeight';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { usePresence } from '@/shared/ui/usePresence';

export function BottomNav() {
    const { isKeyboardOpen } = useKeyboardHeight();
    const { t } = useLanguage();
    const { mounted, visible } = usePresence(!isKeyboardOpen);

    const navItems = [
        { to: '/', icon: Home, label: t('nav.home') },
        { to: '/search', icon: Search, label: t('nav.search') },
        { to: '/my-books', icon: BookOpen, label: t('nav.myBooks') },
    ];

    if (!mounted) return null;

    return (
                <nav
                    aria-label="Mobile Navigation"
                    className={`mobile-only fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)] pointer-events-auto transition-[opacity,transform] duration-200 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}
                >
                    <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                        {navItems.map(({ to, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center gap-1 px-6 py-2 transition-all duration-200 ${isActive
                                        ? 'text-white'
                                        : 'text-gray-400 hover:text-gray-300'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon
                                            size={24}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className="transition-transform duration-200 active:scale-90"
                                            aria-hidden="true"
                                        />
                                        <span className="text-[10px] font-medium">{label}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                </nav>
    );
}
