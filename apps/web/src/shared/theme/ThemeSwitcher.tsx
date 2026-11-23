import { useLanguage } from '@/shared/i18n/LanguageContext';
import type { ThemeChoice } from './theme';
import { useTheme } from './useTheme';

const OPTIONS: Array<{ value: ThemeChoice; labelKey: string }> = [
  { value: 'light', labelKey: 'theme.light' },
  { value: 'dark', labelKey: 'theme.dark' },
  { value: 'system', labelKey: 'theme.system' },
];

interface ThemeSwitcherProps {
  /** `small` is the 28px macOS control for the sidebar; `regular` keeps 44px touch targets in sheets. */
  size?: 'small' | 'regular';
}

/** Apple-style segmented control: text-only segments, the chosen one lifted on a quiet track. */
export function ThemeSwitcher({ size = 'regular' }: ThemeSwitcherProps) {
  const { t } = useLanguage();
  const { choice, setChoice } = useTheme();
  const segment = size === 'small' ? 'h-7 text-[13px]' : 'min-h-[44px] text-sm';

  return (
    <div role="radiogroup" aria-label={t('theme.label')} className="grid grid-cols-3 gap-0.5 rounded-[9px] bg-fg/[0.08] p-0.5">
      {OPTIONS.map(({ value, labelKey }) => {
        const selected = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setChoice(value)}
            className={`${segment} rounded-[7px] px-2 font-medium transition-[background-color,color,box-shadow] duration-150 ${
              selected
                ? 'bg-segment text-fg shadow-[0_1px_2px_rgb(0_0_0/0.12),0_1px_1px_rgb(0_0_0/0.06)]'
                : 'text-fg/70 hover:text-fg'
            }`}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
