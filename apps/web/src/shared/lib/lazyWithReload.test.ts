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
  it('does not reload when the import failed because the page is being left', async () => {
    const s = storage();
    const reload = vi.fn();
    const failing = async () => {
      throw new TypeError('Importing a module script failed.');
    };
    const pending = loadWithReload(failing, s, reload, () => true);
    const settled = await Promise.race([pending.then(() => 'settled'), new Promise((r) => setTimeout(() => r('pending'), 20))]);
    expect(settled).toBe('pending');
    expect(reload).not.toHaveBeenCalled();
    expect(s.getItem('libify.chunk-reload')).toBeNull();
  });
});
