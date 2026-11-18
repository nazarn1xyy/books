import { useCallback, useEffect, useRef, useState } from 'react';

/** Transient message state: `show(msg)` displays it for `durationMs`, a newer message restarts the timer. */
export function useToast(durationMs = 2500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback(
    (msg: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(msg);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  return { message, show };
}

/** Renders the current toast message (if any) with the caller's positioning/look. */
export function Toast({ message, className }: { message: string | null; className: string }) {
  if (!message) return null;
  return (
    <div role="status" className={className}>
      {message}
    </div>
  );
}
