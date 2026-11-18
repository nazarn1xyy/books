import type { ReaderSettings } from './readerSettingsStore';

/** CSS font stacks for the reader's font choices. */
export const FONT_FAMILIES: Record<ReaderSettings['fontFamily'], string> = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
  rounded: "'Nunito', 'SF Pro Rounded', ui-rounded, sans-serif",
};
