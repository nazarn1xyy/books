import { describe, expect, it, vi } from 'vitest';
import { loadWithReload } from './lazyWithReload';

const storage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe('loadWithReload', () => {
  it('returns the module and clears the guard on success', async () => {
    const s = storage();
    s.setItem('libify.chunk-reload', '1');
    const mod = await loadWithReload(async () => ({ default: 1 }), s, vi.fn());
    expect(mod).toEqual({ default: 1 });
    expect(s.getItem('libify.chunk-reload')).toBeNull();
  });
  it('reloads once on a failed chunk, then rethrows', async () => {
    const s = storage();
    const reload = vi.fn();
    const failing = async () => {
      throw new TypeError('Failed to fetch dynamically imported module');
    };
    void loadWithReload(failing, s, reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    await expect(loadWithReload(failing, s, reload)).rejects.toThrow();
    expect(reload).toHaveBeenCalledOnce();
  });
  it('waits while the page is being left, then reloads if the page is still there', async () => {
    vi.useFakeTimers();
    try {
      const s = storage();
      const reload = vi.fn();
      const failing = async () => {
        throw new TypeError('Importing a module script failed.');
      };
      void loadWithReload(failing, s, reload, () => true, 1000);
      await vi.advanceTimersByTimeAsync(900);
      expect(reload).not.toHaveBeenCalled(); // a real navigation would have replaced the page by now
      await vi.advanceTimersByTimeAsync(200);
      expect(reload).toHaveBeenCalledOnce(); // it did not happen (cancelled, download...), so recover
    } finally {
      vi.useRealTimers();
    }
  });
});
