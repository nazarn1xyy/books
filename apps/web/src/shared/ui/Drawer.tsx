import { useId, useRef, type ReactNode } from 'react';
import { useDialogFocus } from './useDialogFocus';
import { usePresence } from './usePresence';

interface DrawerProps {
  open: boolean;
  onClose(): void;
  title?: string;
  children: ReactNode;
  /** Extra classes for the panel. */
  className?: string;
}

/** Side panel sliding in from the right. */
export function Drawer({ open, onClose, title, children, className = '' }: DrawerProps) {
  const { mounted, visible } = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(open, panelRef, onClose);

  if (!mounted) return null;

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
        className={`absolute inset-y-0 right-0 w-full max-w-xs outline-none
          transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none
          ${visible ? 'translate-x-0' : 'translate-x-full'}
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
