import { memo, type ReactNode } from 'react';
import type { Book } from '../model/types';
import { useBookCover } from '../lib/useBookCover';
import { ImageWithLoader } from './ImageWithLoader';

interface BookCoverProps {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover' | 'format'>;
  size?: 'sm' | 'md' | 'lg';
  /** Eager, high-priority load for the first row on screen. */
  priority?: boolean;
  /** 0–100: a thin progress strip along the bottom edge; hidden at 0. */
  progress?: number;
  /** Lift on hover inside a `.group` (desktop only). */
  lift?: boolean;
  className?: string;
  /** Overlays (badges, buttons) positioned over the cover. */
  children?: ReactNode;
}

/** The single cover look of the app: 2:3, spine highlight, shadow, optional progress strip. Decorative (alt=""). */
export const BookCover = memo(function BookCover({
  book,
  size = 'md',
  priority = false,
  progress = 0,
  lift = true,
  className = '',
  children,
}: BookCoverProps) {
  const src = useBookCover(book.id, book.cover);
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className={`book-cover ${lift ? 'book-cover-lift' : ''} relative aspect-[2/3] overflow-hidden bg-surface-2 ${className}`}>
      <ImageWithLoader
        src={src}
        alt=""
        fallbackTitle={book.title}
        fallbackAuthor={book.author}
        fallbackFormat={book.format}
        size={size}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'low'}
        wrapperClassName="w-full h-full"
      />
      {/* Spine: a narrow shade-and-glint band along the left edge */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[6px] bg-gradient-to-r from-black/30 via-white/25 to-transparent"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10" />
      {pct > 0 && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-black/45">
          <span className="block h-full bg-white" style={{ width: `${pct}%` }} />
        </span>
      )}
      {children}
    </div>
  );
});
