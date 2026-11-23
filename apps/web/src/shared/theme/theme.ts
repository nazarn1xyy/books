export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'libify.theme';
const META_COLOR: Record<ResolvedTheme, string> = { dark: '#000000', light: '#f2f2f7' };

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

/** Applies the theme to <html> and the browser chrome (status bar / tab colour). */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);
}
