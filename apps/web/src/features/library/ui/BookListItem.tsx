import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBookCover } from '@/entities/book/lib/useBookCover';
import type { Book, ReadingProgress } from '@/entities/book/model/types';
import { BookCover } from '@/entities/book/ui/BookCover';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { useSwipeToRemove } from '../model/useSwipeToRemove';

function progressPercentage(progress: ReadingProgress | null): number {
  if (!progress) return 0;
  if (progress.scrollPercentage !== undefined) return progress.scrollPercentage;
  return progress.totalPages > 0 ? Math.round(((progress.currentPage + 1) / progress.totalPages) * 100) : 0;
}

/** A library book card: tap to read, swipe left (or the focus-visible button) to remove. */
export function BookListItem({ book, progress, onRemove }: { book: Book; progress: ReadingProgress | null; onRemove: () => void }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const coverSrc = useBookCover(book.id, book.cover);
  const swipe = useSwipeToRemove(onRemove);
  const percentage = progressPercentage(progress);

  return (
    <div className="relative group">
      {/* Delete Background Layer */}
      <div className="absolute inset-y-0 right-0 w-full bg-red-600 rounded-2xl flex items-center justify-end px-6 z-0" aria-hidden="true">
        <Trash2 className="text-fg" size={24} />
      </div>

      {/* Swipeable card: drag left past the threshold to remove */}
      <div
        role="link"
        tabIndex={0}
        onPointerDown={swipe.onPointerDown}
        onPointerMove={swipe.onPointerMove}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerUp}
        onClick={() => {
          if (!swipe.consumeClick()) navigate(`/reader/${book.id}`);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') navigate(`/reader/${book.id}`);
        }}
        style={{ transform: `translateX(${swipe.offset}px)` }}
        className={`relative bg-surface rounded-2xl z-10 touch-pan-y select-none cursor-pointer w-full ${swipe.dragging ? 'cursor-grabbing' : 'transition-transform duration-200 ease-out'}`}
      >
        <div className="flex gap-4 p-4 pointer-events-none select-none">
          <BookCover book={{ ...book, cover: coverSrc }} size="sm" lift={false} className="w-16 flex-shrink-0" />
          <div className="flex-1 flex flex-col justify-between text-left py-1">
            <div>
              <h3 className="font-semibold text-fg line-clamp-2">{book.title || 'Без назви'}</h3>
              <p className="text-sm text-subtle mt-0.5">{book.author || 'Невідомий автор'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <ProgressBar percentage={percentage} height={4} />
              </div>
              <span className="text-xs text-muted font-medium">{percentage}%</span>
            </div>
          </div>
        </div>
      </div>
      {/* Keyboard access to removal: visible only when focused */}
      <button
        type="button"
        onClick={onRemove}
        className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-3 focus:z-20 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-red-600 focus:text-white focus:text-sm"
      >
        {t('common.delete')}
      </button>
    </div>
  );
}
