import { NavLink } from 'react-router-dom';
import { BookOpen, ChevronDown, Home, LogOut, Search } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { LANGUAGES } from '@/shared/i18n/languages';
import { SyncStatusBadge } from '@/shared/ui/SyncStatusBadge';
import { ThemeSwitcher } from '@/shared/theme/ThemeSwitcher';

/**
 * Desktop sidebar in the manner of a macOS source list: a plain wordmark, rows with a quiet
 * selection fill, and preferences set in small type at the foot. No tiles, gradients or cards.
 */
export function Sidebar() {
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const navItems = [
    { to: '/', icon: Home, label: t('nav.home') },
    { to: '/search', icon: Search, label: t('nav.search') },
    { to: '/my-books', icon: BookOpen, label: t('nav.myBooks') },
  ];

  const handleSignOut = async () => {
    if ((await signOut()) === 'unsynced' && window.confirm(t('auth.unsyncedSignOut'))) {
      await signOut({ discardUnsynced: true });
    }
  };

  return (
    <aside
      aria-label="Sidebar Navigation"
      className="desktop-only fixed left-0 top-0 bottom-0 z-50 flex w-[var(--sidebar-width)] flex-col border-r border-line bg-app"
    >
      <div className="px-5 pt-7 pb-5">
        <p className="text-[22px] font-semibold tracking-[-0.02em] text-fg">Libify</p>
        <SyncStatusBadge className="mt-1" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main Navigation">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[15px] transition-colors duration-150 ${
                isActive ? 'bg-fg/[0.09] font-medium text-fg' : 'text-fg/80 hover:bg-fg/[0.05] hover:text-fg'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2 : 1.75} className={isActive ? 'text-fg' : 'text-muted group-hover:text-fg'} aria-hidden="true" />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-4 px-5 pb-5">
        <section aria-labelledby="sidebar-appearance">
          <h2 id="sidebar-appearance" className="mb-2 text-[11px] font-medium text-subtle">
            {t('theme.label')}
          </h2>
          <ThemeSwitcher size="small" />
        </section>

        <label className="flex h-8 items-center justify-between gap-3 text-[13px]">
          <span className="text-subtle">{t('language.title')}</span>
          <span className="relative flex items-center">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as (typeof LANGUAGES)[number]['code'])}
              aria-label={t('aria.switchLanguage')}
              className="cursor-pointer appearance-none bg-transparent pr-5 text-right font-medium text-fg outline-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-0 text-subtle" aria-hidden="true" />
          </span>
        </label>
      </div>

      {user && (
        <div className="flex items-center gap-3 border-t border-line px-5 py-4">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fg/[0.12] text-[13px] font-semibold text-fg"
            aria-hidden="true"
          >
            {user.nickname[0]?.toUpperCase() ?? 'U'}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{user.nickname}</span>
          <button
            type="button"
            onClick={handleSignOut}
            title={t('common.logout')}
            aria-label={t('common.logout')}
            className="-mr-1.5 grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </aside>
  );
}
