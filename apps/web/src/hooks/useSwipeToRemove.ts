import { useRef, useState, type PointerEvent } from 'react';

const MAX_OFFSET = 180;
const REMOVE_THRESHOLD = 140;
const DIRECTION_LOCK_PX = 8;

/**
 * Horizontal swipe-left on a card: the card follows the finger (rubber-banded past MAX_OFFSET),
 * releasing past REMOVE_THRESHOLD calls onRemove; otherwise it springs back via CSS transition.
 */
export function useSwipeToRemove(onRemove: () => void) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const axis = useRef<'x' | 'y' | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    axis.current = null;
    moved.current = false;
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!axis.current) {
      if (Math.abs(dx) < DIRECTION_LOCK_PX && Math.abs(dy) < DIRECTION_LOCK_PX) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis.current === 'x') {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (axis.current !== 'x') return;
    moved.current = true;
    const raw = Math.min(0, dx);
    // Rubber band beyond the max offset.
    setOffset(raw < -MAX_OFFSET ? -MAX_OFFSET + (raw + MAX_OFFSET) * 0.3 : raw);
  };

  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (axis.current === 'x' && offset < -REMOVE_THRESHOLD) {
      try {
        navigator.vibrate?.(10);
      } catch {
        /* ignore vibrate failure */
      }
      onRemove();
    }
    setOffset(0);
  };

  /** True (once) if the last pointer gesture was a swipe, so the click that follows must be ignored. */
  const consumeClick = () => {
    const wasSwipe = moved.current;
    moved.current = false;
    return wasSwipe;
  };

  return { offset, dragging, onPointerDown, onPointerMove, onPointerUp, consumeClick };
}
