import { useEffect, useEffectEvent, type RefObject } from 'react';

/** While open: focus the panel, close on Escape, and return focus to the opener on close. */
export function useDialogFocus(open: boolean, panelRef: RefObject<HTMLElement | null>, onClose: () => void): void {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Mark as handled: closing re-renders synchronously, and listeners re-attached further up the
      // bubbling path (e.g. page keys on window) would otherwise still see this same event.
      e.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [open, panelRef]);
}
