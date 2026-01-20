import { NavLink } from 'react-router-dom';
import { Home, Search, BookOpen } from 'lucide-react';

const navItems = [
    { to: '/', icon: Home, label: 'Главная' },
    { to: '/search', icon: Search, label: 'Поиск' },
    { to: '/my-books', icon: BookOpen, label: 'Мои книги' },
];

export function BottomNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center gap-1 px-6 py-2 transition-all duration-200 ${isActive
                                ? 'text-white'
                                : 'text-gray-500 hover:text-gray-300'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <Icon
                                    size={24}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className="transition-transform duration-200 active:scale-90"
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
