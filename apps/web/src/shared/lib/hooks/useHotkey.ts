import { useEffect, useRef } from 'react';

/** True when the key press belongs to a text field and must not trigger shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !('tagName' in target) || typeof target.tagName !== 'string') return false;
  if ('isContentEditable' in target && target.isContentEditable === true) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Calls `handler` on `key` (KeyboardEvent.key) unless the user is typing or a modifier is held. */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, enabled = true): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== key || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      handlerRef.current(e);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, enabled]);
}
