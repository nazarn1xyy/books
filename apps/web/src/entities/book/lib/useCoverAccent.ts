import { useEffect, useState } from 'react';
import { NEUTRAL_ACCENT, cachedCoverColor, extractDominantColor } from '@/shared/lib/coverColor';

/** Dominant colour of a cover (neutral until known or when there is no cover). */
export function useCoverAccent(src: string | undefined): string {
  const [color, setColor] = useState<{ src: string; value: string } | null>(null);

  useEffect(() => {
    if (!src || cachedCoverColor(src)) return;
    let alive = true;
    void extractDominantColor(src).then((value) => {
      if (alive) setColor({ src, value });
    });
    return () => {
      alive = false;
    };
  }, [src]);

  if (!src) return NEUTRAL_ACCENT;
  return cachedCoverColor(src) ?? (color?.src === src ? color.value : NEUTRAL_ACCENT);
}
