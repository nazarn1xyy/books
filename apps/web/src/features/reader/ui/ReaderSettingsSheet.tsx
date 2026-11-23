import type { ReactNode } from 'react';
import { Check, Sun, X } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { Sheet } from '@/shared/ui/Sheet';
import { FONT_FAMILIES } from '../model/fontFamilies';
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN, FONT_SIZE_MAX, FONT_SIZE_MIN, type ReaderSettings } from '../model/readerSettingsStore';
import { useReaderSettings } from '../model/useReaderSettings';

interface ReaderSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isPdf: boolean;
  /** Side effect of switching mode (e.g. open the page with the current paragraph). */
  onReaderModeChange?: (mode: ReaderSettings['readerMode']) => void;
}

/** Swatches use each theme's own page and ink, so the tile is a preview of the page. */
const THEMES: Array<{ id: ReaderSettings['theme']; labelKey: string; bg: string; ink: string }> = [
  { id: 'light', labelKey: 'reader.themeLight', bg: '#ffffff', ink: '#000000' },
  { id: 'sepia', labelKey: 'reader.themeSepia', bg: '#f8f1e3', ink: '#5f4b32' },
  { id: 'dark', labelKey: 'reader.themeDark', bg: '#1c1c1e', ink: '#ffffff' },
  { id: 'oled', labelKey: 'reader.themeOled', bg: '#000000', ink: '#b0b0b0' },
];

const FONTS: Array<{ key: ReaderSettings['fontFamily']; labelKey: string }> = [
  { key: 'sans', labelKey: 'reader.fontSans' },
  { key: 'serif', labelKey: 'reader.fontSerif' },
  { key: 'rounded', labelKey: 'reader.fontRounded' },
  { key: 'mono', labelKey: 'reader.fontMono' },
];

const hairline = 'color-mix(in srgb, var(--reader-text) 12%, transparent)';

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 px-1 text-[13px] reader-muted">{label}</legend>
      {children}
    </fieldset>
  );
}

/** Reader appearance in the manner of Apple Books: previews instead of labels, one control per idea. */
export function ReaderSettingsSheet({ isOpen, onClose, isPdf, onReaderModeChange }: ReaderSettingsSheetProps) {
  const { t } = useLanguage();
  const settings = useReaderSettings((s) => s);
  const setMode = (mode: ReaderSettings['readerMode']) => {
    settings.setReaderMode(mode);
    onReaderModeChange?.(mode);
  };
  const brightnessFill = ((settings.brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * 100;

  return (
    <Sheet
      portal={false}
      open={isOpen}
      onClose={onClose}
      title={t('reader.settings')}
      placement="bottom"
      swipeToClose
      surfaceClassName="bg-[var(--reader-ui-bg)] text-[var(--reader-text)] rounded-[32px]"
      className="max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain px-5 pt-5 pb-6 touch-pan-y"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{t('reader.settings')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('aria.closeSettings')}
          className="-mr-1 grid h-11 w-11 place-items-center rounded-full"
        >
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full reader-fill reader-muted">
            <X size={16} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </button>
      </div>

      <div className="space-y-6">
        <Group label={t('reader.theme')}>
          <div className="grid grid-cols-4 gap-3" role="radiogroup" aria-label={t('reader.theme')}>
            {THEMES.map((theme) => {
              const selected = settings.theme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => settings.setTheme(theme.id)}
                  className="flex flex-col items-center gap-2"
                >
                  <span
                    className={`grid aspect-[4/3] w-full place-items-center rounded-2xl text-[22px] transition-shadow duration-200 ${
                      selected ? 'ring-2 ring-[var(--reader-text)] ring-offset-2 ring-offset-[var(--reader-ui-bg)]' : ''
                    }`}
                    style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${hairline}`, fontFamily: FONT_FAMILIES[settings.fontFamily] }}
                    aria-hidden="true"
                  >
                    Аа
                  </span>
                  <span className={`text-xs ${selected ? 'font-semibold' : 'reader-muted'}`}>{t(theme.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </Group>

        {!isPdf && (
          <Group label={t('reader.fontSize')}>
            <div className="flex h-12 items-stretch overflow-hidden rounded-2xl reader-fill">
              <button
                type="button"
                onClick={() => settings.changeFontSize(-2)}
                disabled={settings.fontSize <= FONT_SIZE_MIN}
                aria-label={t('aria.decreaseFontSize')}
                className="flex-1 text-[15px] font-medium disabled:opacity-30 active:bg-[color-mix(in_srgb,var(--reader-text)_8%,transparent)]"
              >
                A
              </button>
              <span className="grid w-16 place-items-center border-x text-[15px] tabular-nums reader-muted" style={{ borderColor: hairline }}>
                {settings.fontSize}
              </span>
              <button
                type="button"
                onClick={() => settings.changeFontSize(2)}
                disabled={settings.fontSize >= FONT_SIZE_MAX}
                aria-label={t('aria.increaseFontSize')}
                className="flex-1 text-[24px] font-medium disabled:opacity-30 active:bg-[color-mix(in_srgb,var(--reader-text)_8%,transparent)]"
              >
                A
              </button>
            </div>
          </Group>
        )}

        {!isPdf && (
          <Group label={t('reader.fontFamily')}>
            <div className="overflow-hidden rounded-2xl reader-fill" role="radiogroup" aria-label={t('reader.fontFamily')}>
              {FONTS.map((font, i) => {
                const selected = settings.fontFamily === font.key;
                return (
                  <button
                    key={font.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => settings.setFontFamily(font.key)}
                    className="flex h-12 w-full items-center justify-between px-4 text-left text-[17px]"
                    style={{ fontFamily: FONT_FAMILIES[font.key], borderTop: i > 0 ? `1px solid ${hairline}` : undefined }}
                  >
                    {t(font.labelKey)}
                    {selected && <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </Group>
        )}

        {!isPdf && (
          <Group label={t('reader.readingMode')}>
            <div className="grid grid-cols-2 gap-0.5 rounded-xl reader-fill p-0.5" role="radiogroup" aria-label={t('reader.readingMode')}>
              {(
                [
                  { mode: 'scroll', labelKey: 'reader.scroll' },
                  { mode: 'page', labelKey: 'reader.pageFlip' },
                ] as const
              ).map(({ mode, labelKey }) => {
                const selected = (settings.readerMode === 'page') === (mode === 'page');
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(mode)}
                    className={`h-9 rounded-[10px] text-[15px] transition-colors duration-150 ${
                      selected
                        ? 'bg-[color-mix(in_srgb,var(--reader-text)_18%,var(--reader-ui-bg))] font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.15)]'
                        : 'reader-muted'
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </Group>
        )}

        <Group label={t('reader.brightness')}>
          <div className="flex h-12 items-center gap-3 rounded-2xl reader-fill px-4">
            <Sun size={15} className="reader-muted shrink-0" aria-hidden="true" />
            <input
              type="range"
              min={BRIGHTNESS_MIN}
              max={BRIGHTNESS_MAX}
              value={settings.brightness}
              onChange={(e) => settings.setBrightness(Number(e.target.value))}
              aria-label={t('reader.brightness')}
              aria-valuetext={`${settings.brightness}%`}
              className="reader-range flex-1"
              style={{ ['--fill' as string]: `${brightnessFill}%` }}
            />
            <Sun size={22} className="reader-muted shrink-0" aria-hidden="true" />
          </div>
        </Group>
      </div>
    </Sheet>
  );
}
