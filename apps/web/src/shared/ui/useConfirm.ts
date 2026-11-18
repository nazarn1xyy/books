import { useCallback, useRef, useState } from 'react';

/** `confirm(label)` opens the dialog and resolves with the user's answer; render `dialog` once. */
export function useConfirm() {
  const [label, setLabel] = useState<string | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((question: string) => {
    resolver.current?.(false);
    setLabel(question);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const onAnswer = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setLabel(null);
  }, []);

  return { confirm, dialogProps: { label, onAnswer } };
}
