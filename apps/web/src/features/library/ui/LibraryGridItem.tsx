import { MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book, ReadingProgress } from '@/entities/book/model/types';
import { BookCover } from '@/entities/book/ui/BookCover';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { progressPercentage } from '../model/progressPercentage';
import { useLongPress } from '../model/useLongPress';

interface LibraryGridItemProps {
  book: Book;
  progress: ReadingProgress | null;
  priority?: boolean;
  onOpenActions(book: Book): void;
}

/** A cover tile: tap to read; long press, right click or the "…" button opens the actions sheet. */
export function LibraryGridItem({ book, progress, priority, onOpenActions }: LibraryGridItemProps) {
  const { t } = useLanguage();
  const press = useLongPress(() => onOpenActions(book));
  const title = book.title || 'Без назви';
  const percentage = progressPercentage(progress);

  return (
    <div className="group relative flex flex-col">
      <Link
        to={`/reader/${book.id}`}
        aria-label={[title, book.author, percentage > 0 ? t('home.percentRead', { percent: percentage }) : ''].filter(Boolean).join(', ')}
        onPointerDown={press.onPointerDown}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onContextMenu={press.onContextMenu}
        onClick={(e) => {
          if (press.consumeClick()) e.preventDefault();
        }}
        className="group flex flex-col rounded-lg select-none [-webkit-touch-callout:none] active:scale-[0.97] transition-transform duration-200"
      >
        <BookCover book={book} size="md" priority={priority} progress={percentage} />
        <h3 className="mt-2.5 text-[13px] font-semibold leading-snug text-fg line-clamp-2">{title}</h3>
        <p className="mt-0.5 text-xs text-subtle line-clamp-1">{book.author || 'Невідомий автор'}</p>
      </Link>
      <button
        type="button"
        onClick={() => onOpenActions(book)}
        aria-label={t('myBooks.bookActions', { title })}
        className="absolute top-1.5 right-1.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition-opacity hover:bg-black/75 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
