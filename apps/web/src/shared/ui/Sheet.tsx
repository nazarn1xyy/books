import { useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './useDialogFocus';
import { usePresence } from './usePresence';

const DEFAULT_SURFACE = 'rounded-[32px] bg-surface';
const SWIPE_CLOSE_PX = 100;
/** iOS 26 sheets float: inset from the screen edges and lifted above the home indicator. */
const FLOATING = 'inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))]';

interface SheetProps {
  open: boolean;
  onClose(): void;
  title?: string;
  children: ReactNode;
  /**
   * `responsive`: bottom sheet on mobile, centered panel from `sm` up.
   * `bottom`: bottom sheet at every size, horizontally centered; set its width via `className`.
   */
  placement?: 'responsive' | 'bottom';
  /** Background, border and radius of the panel; replaces the default surface. */
  surfaceClassName?: string;
  /** Extra classes for the panel (padding, max width...). */
  className?: string;
  /** Drag the sheet down to close it (when its content is scrolled to the top). */
  swipeToClose?: boolean;
  /**
   * Render into <body> so no ancestor stacking context (scroll panes, page transitions) can put the
   * bottom nav or floating buttons above the sheet. Reader sheets pass `false`: they need the reader
   * theme variables of their container.
   */
  portal?: boolean;
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
  portal = true,
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
      ? `${FLOATING} mx-auto ${visible ? 'translate-y-0 opacity-100' : 'translate-y-[calc(100%+2rem)]'}`
      : `${FLOATING} sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:w-[min(92vw,480px)]
         ${visible ? 'translate-y-0 sm:-translate-x-1/2 sm:-translate-y-1/2 opacity-100' : 'translate-y-[calc(100%+2rem)] sm:-translate-x-1/2 sm:-translate-y-[45%] opacity-0'}`;

  const sheet = (
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
        className={`absolute ${position} max-h-[85dvh] overflow-y-auto shadow-[0_24px_64px_rgb(0_0_0/0.6)] outline-none
          ${surfaceClassName}
          transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none
          ${className}`}
      >
        <div aria-hidden="true" className="mx-auto -mt-1.5 mb-3 h-[5px] w-9 rounded-full bg-current opacity-25 sm:hidden" />
        {title && (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );

  return portal ? createPortal(sheet, document.body) : sheet;
}
