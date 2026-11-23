/** Accent colours taken from book covers (Apple Books style glows). */

export const NEUTRAL_ACCENT = 'rgb(120 120 128)';
const STORAGE_KEY = 'libify.coverColors';
const MAX_STORED = 300;

/**
 * Average of the visible, non-extreme pixels of an RGBA buffer as `rgb(r g b)`.
 * Near-black, near-white and transparent pixels are skipped (borders, paper, letterboxing);
 * the result is lifted so the brightest channel reaches 150, keeping glows visible on a dark base.
 */
export function averageColor(pixels: Uint8ClampedArray): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const pr = pixels[i] ?? 0;
    const pg = pixels[i + 1] ?? 0;
    const pb = pixels[i + 2] ?? 0;
    if ((pixels[i + 3] ?? 0) < 128) continue;
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    if (max < 28 || min > 228) continue;
    r += pr;
    g += pg;
    b += pb;
    n++;
  }
  if (n === 0) return NEUTRAL_ACCENT;
  r /= n;
  g /= n;
  b /= n;
  const lift = Math.max(1, 150 / Math.max(r, g, b, 1));
  const c = (v: number) => Math.min(255, Math.round(v * lift));
  return `rgb(${c(r)} ${c(g)} ${c(b)})`;
}

const memory = new Map<string, string>();
let stored: Record<string, string> | null = null;

function storedColors(): Record<string, string> {
  if (stored) return stored;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    stored = {};
  }
  return stored;
}

/** Data URLs are huge and per-device: keep them in memory only. */
const persistable = (src: string) => !src.startsWith('data:');

export function cachedCoverColor(src: string): string | undefined {
  return memory.get(src) ?? (persistable(src) ? storedColors()[src] : undefined);
}

function remember(src: string, color: string): void {
  memory.set(src, color);
  if (!persistable(src)) return;
  const all = storedColors();
  all[src] = color;
  const keys = Object.keys(all);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STORED))) delete all[key];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Quota: the in-memory cache still works.
  }
}

const pending = new Map<string, Promise<string>>();

/** Dominant colour of a cover image; same-origin (proxied) and data: URLs only. Errors give a neutral colour. */
export function extractDominantColor(src: string): Promise<string> {
  const cached = cachedCoverColor(src);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(src);
  if (inFlight) return inFlight;

  const job = new Promise<string>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 36;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(NEUTRAL_ACCENT);
        ctx.drawImage(img, 0, 0, 24, 36);
        const color = averageColor(ctx.getImageData(0, 0, 24, 36).data);
        remember(src, color);
        resolve(color);
      } catch {
        resolve(NEUTRAL_ACCENT); // tainted canvas or decode failure
      }
    };
    img.onerror = () => resolve(NEUTRAL_ACCENT);
    img.src = src;
  }).finally(() => pending.delete(src));
  pending.set(src, job);
  return job;
}
