import { beforeEach, describe, expect, it } from 'vitest';
import { createReaderSettingsStore } from './readerSettingsStore';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe('readerSettingsStore', () => {
  let storage: ReturnType<typeof memory>;
  beforeEach(() => {
    storage = memory();
  });

  it('clamps font size and brightness, and persists', () => {
    const store = createReaderSettingsStore(storage);
    store.getState().changeFontSize(100);
    expect(store.getState().fontSize).toBe(28);
    store.getState().changeFontSize(-100);
    expect(store.getState().fontSize).toBe(14);
    store.getState().setBrightness(5);
    expect(store.getState().brightness).toBe(30);
    expect(JSON.parse(storage.getItem('libify.reader-settings') ?? '{}').state.fontSize).toBe(14);
  });

  it('restores persisted settings', () => {
    createReaderSettingsStore(storage).getState().setTheme('sepia');
    expect(createReaderSettingsStore(storage).getState().theme).toBe('sepia');
  });

  it('starts from legacy settings when nothing is persisted yet', () => {
    const store = createReaderSettingsStore(storage, () => ({ fontSize: 22, brightness: 80, theme: 'oled' }));
    expect(store.getState()).toMatchObject({ fontSize: 22, brightness: 80, theme: 'oled', fontFamily: 'sans', readerMode: 'scroll' });
  });

  it('prefers persisted settings over legacy ones', () => {
    createReaderSettingsStore(storage).getState().changeFontSize(2);
    const store = createReaderSettingsStore(storage, () => ({ fontSize: 26, brightness: 100 }));
    expect(store.getState().fontSize).toBe(20);
  });
});
