import { NavLink } from 'react-router-dom';
import { Home, Search, BookOpen, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
    { to: '/', icon: Home, label: 'Главная' },
    { to: '/search', icon: Search, label: 'Поиск' },
    { to: '/my-books', icon: BookOpen, label: 'Мои книги' },
];

export function Sidebar() {
    const { user, signOut } = useAuth();

    return (
        <aside className="desktop-only fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] bg-black/95 backdrop-blur-xl border-r border-white/10 flex flex-col z-50">
            {/* Logo */}
            <div className="p-6 border-b border-white/10">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                    📚 Libify
                </h1>
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
                            title="Выйти"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            )}
        </aside>
    );
}
