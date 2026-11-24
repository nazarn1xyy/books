import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Home, Search } from 'lucide-react';
import { useKeyboardHeight } from '@/shared/lib/hooks/useKeyboardHeight';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { usePresence } from '@/shared/ui/usePresence';

const ITEMS = [
  { to: '/', icon: Home, labelKey: 'nav.home' },
  { to: '/search', icon: Search, labelKey: 'nav.search' },
  { to: '/my-books', icon: BookOpen, labelKey: 'nav.myBooks' },
] as const;

/** Index of the tab owning the current path, or -1 (no highlight) off the tab routes. */
function activeIndex(pathname: string): number {
  if (pathname === '/') return 0;
  return ITEMS.findIndex((item) => item.to !== '/' && pathname.startsWith(item.to));
}

/**
 * Floating capsule tab bar in the manner of iOS 26: frosted glass over the content, and a
 * selection lens that glides to the chosen tab instead of jumping.
 */
export function BottomNav() {
  const { isKeyboardOpen } = useKeyboardHeight();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const { mounted, visible } = usePresence(!isKeyboardOpen);
  const index = activeIndex(pathname);

  if (!mounted) return null;

  return (
    <nav
      aria-label="Mobile Navigation"
      className={`mobile-only pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem))] z-50 flex justify-center transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-[150%] opacity-0'
      }`}
    >
      <div className="pointer-events-auto relative flex rounded-full border border-white/[0.08] bg-[rgb(30_30_32/0.72)] p-1 shadow-[0_10px_30px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-2xl backdrop-saturate-150">
        {index >= 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-1 w-[88px] rounded-full bg-white/[0.14] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
        )}
        {ITEMS.map(({ to, icon: Icon, labelKey }, i) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={`relative z-10 flex h-[54px] w-[88px] flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200 active:scale-[0.96] ${
              i === index ? 'text-fg' : 'text-fg/60'
            }`}
          >
            <Icon size={22} strokeWidth={i === index ? 2.25 : 1.9} aria-hidden="true" />
            <span className="text-[10px] font-semibold tracking-[0.01em]">{t(labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
