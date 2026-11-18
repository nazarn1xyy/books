import { useEffect, useState } from 'react';

/**
 * Keeps an element mounted while its exit transition plays.
 * `visible` toggles the CSS state one frame after mount so the enter transition runs.
 */
export function usePresence(open: boolean, exitMs = 220): { mounted: boolean; visible: boolean } {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const mount = requestAnimationFrame(() => {
        setMounted(true);
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(mount);
    }
    const hide = requestAnimationFrame(() => setVisible(false));
    const unmount = setTimeout(() => setMounted(false), exitMs);
    return () => {
      cancelAnimationFrame(hide);
      clearTimeout(unmount);
    };
  }, [open, exitMs]);

  return { mounted: mounted || open, visible };
}
