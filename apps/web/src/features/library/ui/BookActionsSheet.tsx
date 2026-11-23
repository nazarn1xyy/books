import { BookOpen, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Book } from '@/entities/book/model/types';
import { BookCover } from '@/entities/book/ui/BookCover';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { Sheet } from '@/shared/ui/Sheet';

/** Context menu of a library book (long press / "…"): read or remove. */
export function BookActionsSheet({ book, onClose, onRemove }: { book: Book | null; onClose(): void; onRemove(id: string): void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const title = book?.title || 'Без назви';

  return (
    <Sheet open={book !== null} onClose={onClose} title={t('myBooks.bookActions', { title })} className="p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:max-w-sm" swipeToClose>
      {book && (
        <>
          <div className="mb-5 flex items-center gap-4">
            <BookCover book={book} size="sm" lift={false} className="w-14 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-fg line-clamp-2">{title}</p>
              <p className="text-sm text-subtle line-clamp-1">{book.author}</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl bg-surface-2/60">
            <button
              type="button"
              onClick={() => {
                onClose();
                void navigate(`/reader/${book.id}`);
              }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-fg hover:bg-fg/5"
            >
              <BookOpen size={18} aria-hidden="true" />
              {t('myBooks.read')}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRemove(book.id);
              }}
              className="flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left text-danger hover:bg-fg/5"
            >
              <Trash2 size={18} aria-hidden="true" />
              {t('common.delete')}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
