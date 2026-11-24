import { useState } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { Sheet } from './Sheet';

interface ConfirmDialogProps {
  /** Question shown to the user; null when closed. */
  label: string | null;
  onAnswer(confirmed: boolean): void;
  confirmText?: string;
}

/** Destructive-action confirmation (bottom sheet). */
export function ConfirmDialog({ label, onAnswer, confirmText }: ConfirmDialogProps) {
  const { t } = useLanguage();
  // Keep the last label while the sheet animates out.
  const [shownLabel, setShownLabel] = useState(label);
  if (label !== null && label !== shownLabel) setShownLabel(label);

  return (
    <Sheet
      open={label !== null}
      onClose={() => onAnswer(false)}
      title={shownLabel ?? undefined}
      placement="bottom"
      surfaceClassName="bg-surface rounded-[32px]"
      className="max-w-md p-6 mb-[calc(1rem+env(safe-area-inset-bottom))] w-[calc(100%-2rem)]"
    >
      <p className="text-fg font-semibold text-center mb-5">{shownLabel}</p>
      <div className="flex gap-3">
        <button
          onClick={() => onAnswer(false)}
          className="flex-1 h-12 bg-fg/10 text-fg rounded-xl font-medium active:scale-95 transition"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={() => onAnswer(true)}
          className="flex-1 h-12 bg-red-500 text-white rounded-xl font-medium active:scale-95 transition"
        >
          {confirmText ?? t('common.delete')}
        </button>
      </div>
    </Sheet>
  );
}
