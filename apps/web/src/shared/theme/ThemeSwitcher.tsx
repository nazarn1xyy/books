import { Monitor, Moon, Sun } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import type { ThemeChoice } from './theme';
import { useTheme } from './useTheme';

const OPTIONS: Array<{ value: ThemeChoice; icon: typeof Sun; labelKey: string }> = [
  { value: 'light', icon: Sun, labelKey: 'theme.light' },
  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
  { value: 'system', icon: Monitor, labelKey: 'theme.system' },
];

export function ThemeSwitcher() {
  const { t } = useLanguage();
  const { choice, setChoice } = useTheme();
  return (
    <div role="radiogroup" aria-label={t('theme.label')} className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-fg/5 border border-line">
      {OPTIONS.map(({ value, icon: Icon, labelKey }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          onClick={() => setChoice(value)}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
            choice === value ? 'bg-surface text-fg shadow-sm' : 'text-subtle hover:text-fg'
          }`}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
