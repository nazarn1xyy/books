import { Plus } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageContext';

interface UploadButtonProps {
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange(event: ChangeEvent<HTMLInputElement>): void;
  onOpenPicker(): void;
}

/** Floating "add a book from this device" button. */
export function UploadButton({ isUploading, fileInputRef, onFileChange, onOpenPicker }: UploadButtonProps) {
  const { t } = useLanguage();
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] lg:bottom-8 right-5 z-20">
      <input type="file" ref={fileInputRef} onChange={onFileChange} accept=".fb2,.zip,.fb2.zip,.pdf" className="hidden" />
      <button
        onClick={onOpenPicker}
        disabled={isUploading}
        className="w-14 h-14 min-w-[56px] min-h-[56px] bg-accent text-on-accent rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform disabled:opacity-50"
        aria-label={t('myBooks.addBook')}
      >
        {isUploading ? <div className="animate-spin rounded-full h-6 w-6 border-2 border-on-accent border-t-transparent" /> : <Plus size={28} />}
      </button>
    </div>
  );
}
