import { useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useDialogFocus } from './useDialogFocus';
import { usePresence } from './usePresence';

const DEFAULT_SURFACE = 'rounded-t-3xl sm:rounded-3xl bg-[#1C1C1E] border border-white/10';
const SWIPE_CLOSE_PX = 100;

interface SheetProps {
  open: boolean;
  onClose(): void;
  title?: string;
  children: ReactNode;
  /**
   * `responsive`: bottom sheet on mobile, centered panel from `sm` up.
   * `bottom`: bottom sheet at every size (centered, limited width).
   */
  placement?: 'responsive' | 'bottom';
  /** Background, border and radius of the panel; replaces the default surface. */
  surfaceClassName?: string;
  /** Extra classes for the panel (padding, max width...). */
  className?: string;
  /** Drag the sheet down to close it (when its content is scrolled to the top). */
  swipeToClose?: boolean;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  placement = 'responsive',
  surfaceClassName = DEFAULT_SURFACE,
  className = '',
  swipeToClose = false,
}: SheetProps) {
  const { mounted, visible } = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const titleId = useId();
  useDialogFocus(open, panelRef, onClose);

  if (!mounted) return null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!swipeToClose || e.pointerType === 'mouse' || (panelRef.current?.scrollTop ?? 0) > 0) return;
    dragStartY.current = e.clientY;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStartY.current));
  };
  const onPointerEnd = () => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragY > SWIPE_CLOSE_PX) onClose();
    setDragY(0);
  };

  const position =
    placement === 'bottom'
      ? `inset-x-0 bottom-0 mx-auto w-full max-w-lg ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full'}`
      : `inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:w-[min(92vw,480px)]
         ${visible ? 'translate-y-0 sm:-translate-x-1/2 sm:-translate-y-1/2 opacity-100' : 'translate-y-full sm:-translate-x-1/2 sm:-translate-y-[45%] opacity-0'}`;

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        className={`absolute ${position} max-h-[85dvh] overflow-y-auto shadow-2xl outline-none
          ${surfaceClassName}
          transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none
          ${className}`}
      >
        {title && (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
