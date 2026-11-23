import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { BookCover } from '@/entities/book/ui/BookCover';
import type { Book } from '@/entities/book/model/types';
import { useLanguage } from '@/shared/i18n/LanguageContext';

const SLOW_AFTER_MS = 8_000;

interface ReaderStatusProps {
  /** Library metadata, when the book is already known (shown while the text downloads). */
  book: Book | undefined;
  onBack(): void;
  /** Set when loading failed; shows the reason and a retry action. */
  error?: string | null;
  onRetry?(): void;
}

/** Opening / failed state of the reader: the book's own cover and title instead of a bare spinner. */
export function ReaderStatus({ book, onBack, error, onRetry }: ReaderStatusProps) {
  const { t } = useLanguage();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (error) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--reader-bg)] text-[var(--reader-text)]">
      <header className="flex items-center px-4 pt-[env(safe-area-inset-top)] min-h-[3.5rem]">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back')}
          className="-ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:opacity-60"
        >
          <ChevronLeft size={28} aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 pb-[15vh] text-center">
        {book && (
          <div className={`w-32 ${error ? '' : 'animate-pulse'}`}>
            <BookCover book={book} size="md" priority />
          </div>
        )}
        <div className="max-w-xs space-y-1.5" role="status" aria-live="polite">
          {book?.title && <p className="text-lg font-semibold leading-snug text-balance">{book.title}</p>}
          {book?.author && <p className="text-sm opacity-70">{book.author}</p>}
          <p className="pt-2 text-sm opacity-70">
            {error ? t('reader.loadFailed') : slow ? t('reader.openingSlow') : t('reader.opening')}
          </p>
        </div>
        {error && (
          <div className="flex gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="min-h-[44px] px-5 rounded-full bg-[var(--reader-text)] text-[var(--reader-bg)] text-sm font-semibold active:opacity-80"
              >
                {t('common.retry')}
              </button>
            )}
            <button type="button" onClick={onBack} className="min-h-[44px] px-5 rounded-full border border-current/20 text-sm font-medium">
              {t('common.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
