import type { Book } from '@/entities/book/model/types';
import { BookCover } from '@/entities/book/ui/BookCover';
import { useLanguage } from '@/shared/i18n/LanguageContext';

/** A series as one cover with two sheets peeking out behind it and a count badge. */
export function SeriesStack({ name, books, onOpen }: { name: string; books: Book[]; onOpen(): void }) {
  const { t } = useLanguage();
  const front = books[0];
  if (!front) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('myBooks.openSeries', { name, count: books.length })}
      className="group flex flex-col text-left rounded-lg active:scale-[0.97] transition-transform duration-200"
    >
      <div className="relative w-full pt-2.5 pr-2.5">
        <span aria-hidden="true" className="book-cover absolute top-0 right-0 bottom-2.5 left-2.5 bg-surface-2 opacity-60" />
        <span aria-hidden="true" className="book-cover absolute top-[5px] right-[5px] bottom-[5px] left-[5px] bg-surface-2 opacity-90" />
        <BookCover book={front} size="md" className="w-full" />
        <span className="absolute bottom-2 right-0 z-10 min-w-7 rounded-full bg-accent px-2 py-0.5 text-center text-xs font-bold text-on-accent shadow-md">
          {books.length}
        </span>
      </div>
      <h3 className="mt-2.5 text-[13px] font-semibold leading-snug text-fg line-clamp-2">{name}</h3>
      <p className="mt-0.5 text-xs text-subtle line-clamp-1">{front.author}</p>
    </button>
  );
}
