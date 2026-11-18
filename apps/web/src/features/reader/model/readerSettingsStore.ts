import { createStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { UserSettings } from '@/entities/book/model/types';

type Theme = NonNullable<UserSettings['theme']>;
type FontFamily = NonNullable<UserSettings['fontFamily']>;
type ReaderMode = NonNullable<UserSettings['readerMode']>;

export interface ReaderSettings {
  fontSize: number;
  brightness: number;
  theme: Theme;
  fontFamily: FontFamily;
  readerMode: ReaderMode;
}

export interface ReaderSettingsState extends ReaderSettings {
  changeFontSize(delta: number): void;
  setBrightness(value: number): void;
  setTheme(theme: Theme): void;
  setFontFamily(fontFamily: FontFamily): void;
  setReaderMode(mode: ReaderMode): void;
}

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 28;
export const BRIGHTNESS_MIN = 30;
export const BRIGHTNESS_MAX = 100;
const STORAGE_KEY = 'libify.reader-settings';

const DEFAULTS: ReaderSettings = { fontSize: 18, brightness: 100, theme: 'dark', fontFamily: 'sans', readerMode: 'scroll' };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * @param legacy settings saved by older versions (inside `book-library-state`); used only until the
 *   store has persisted state of its own.
 */
export function createReaderSettingsStore(storage: StateStorage = localStorage, legacy?: () => Partial<UserSettings>) {
  const initial: ReaderSettings = { ...DEFAULTS };
  if (legacy && storage.getItem(STORAGE_KEY) === null) {
    const old = legacy();
    initial.fontSize = clamp(old.fontSize ?? DEFAULTS.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX);
    initial.brightness = clamp(old.brightness ?? DEFAULTS.brightness, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
    initial.theme = old.theme ?? DEFAULTS.theme;
    initial.fontFamily = old.fontFamily ?? DEFAULTS.fontFamily;
    initial.readerMode = old.readerMode ?? DEFAULTS.readerMode;
  }

  return createStore<ReaderSettingsState>()(
    persist(
      (set) => ({
        ...initial,
        changeFontSize: (delta) => set((s) => ({ fontSize: clamp(s.fontSize + delta, FONT_SIZE_MIN, FONT_SIZE_MAX) })),
        setBrightness: (value) => set({ brightness: clamp(value, BRIGHTNESS_MIN, BRIGHTNESS_MAX) }),
        setTheme: (theme) => set({ theme }),
        setFontFamily: (fontFamily) => set({ fontFamily }),
        setReaderMode: (readerMode) => set({ readerMode }),
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => storage),
        partialize: ({ fontSize, brightness, theme, fontFamily, readerMode }): ReaderSettings => ({
          fontSize,
          brightness,
          theme,
          fontFamily,
          readerMode,
        }),
      },
    ),
  );
}
