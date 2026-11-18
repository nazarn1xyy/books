import { useEffect, useEffectEvent, type RefObject } from 'react';

/** While open: focus the panel, close on Escape, and return focus to the opener on close. */
export function useDialogFocus(open: boolean, panelRef: RefObject<HTMLElement | null>, onClose: () => void): void {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [open, panelRef]);
}
