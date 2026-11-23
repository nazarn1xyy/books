import { useRef, type PointerEvent } from 'react';

const HOLD_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Long press on touch (iOS Safari has no contextmenu event); right click via onContextMenu.
 * `consumeClick()` tells the click handler to skip the click that ends a long press.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  return {
    onPointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse') return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLongPress();
      }, HOLD_MS);
    },
    onPointerMove(e: PointerEvent) {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(e: { preventDefault(): void }) {
      e.preventDefault();
      cancel();
      onLongPress();
    },
    consumeClick(): boolean {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
