import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { Book, ReadingProgress } from '@/entities/book/model/types';
import { useBookCover } from '@/entities/book/lib/useBookCover';
import { useCoverAccent } from '@/entities/book/lib/useCoverAccent';
import { BookCover } from '@/entities/book/ui/BookCover';
import { useLanguage } from '@/shared/i18n/LanguageContext';

function percentOf(progress: ReadingProgress): number {
  if (progress.scrollPercentage !== undefined) return progress.scrollPercentage;
  return progress.totalPages > 0 ? Math.round(((progress.currentPage + 1) / progress.totalPages) * 100) : 0;
}

/**
 * The last book being read, staged like a shelf display: the cover large on the left,
 * its own blurred copy as the backdrop and its dominant colour as the glow (`--cover-accent`).
 */
export function ContinueHero({ book, progress }: { book: Book; progress: ReadingProgress }) {
  const { t } = useLanguage();
  const cover = useBookCover(book.id, book.cover);
  const accent = useCoverAccent(cover || undefined);
  const percent = Math.max(0, Math.min(100, percentOf(progress)));
  const title = book.title || 'Без назви';

  return (
    <section
      aria-labelledby="continue-title"
      style={{ '--cover-accent': accent } as CSSProperties}
      className="continue-hero relative isolate overflow-hidden rounded-[28px] border border-line bg-surface"
    >
      {cover && (
        <img
          src={cover}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full scale-125 object-cover opacity-40 blur-3xl"
        />
      )}
      <div aria-hidden="true" className="continue-hero-veil absolute inset-0 -z-10" />

      <div className="flex items-center gap-5 p-5 sm:gap-8 sm:p-8 lg:p-10">
        <Link to={`/reader/${book.id}`} tabIndex={-1} aria-hidden="true" className="group w-28 flex-shrink-0 sm:w-40 lg:w-48">
          <BookCover book={{ ...book, cover }} size="lg" priority className="continue-hero-cover" />
        </Link>

        <div className="min-w-0 flex-1">
          <h2 id="continue-title" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {t('home.continueReading')}
          </h2>
          <p className="mt-2 text-xl font-bold leading-tight tracking-tight text-fg line-clamp-3 sm:text-3xl lg:text-[34px]">
            {title}
          </p>
          <p className="mt-1.5 text-sm text-muted line-clamp-1 sm:text-base">{book.author}</p>

          <div className="mt-4 max-w-xs sm:mt-6">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-fg/15"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('home.percentRead', { percent })}
            >
              <div className="h-full rounded-full bg-[var(--cover-accent)]" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted">{t('home.percentRead', { percent })}</p>
          </div>

          <Link
            to={`/reader/${book.id}`}
            aria-label={`${t('home.continue')}: ${title}`}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg transition-transform active:scale-95 sm:mt-6"
          >
            <Play size={15} fill="currentColor" aria-hidden="true" />
            {t('home.continue')}
          </Link>
        </div>
      </div>
    </section>
  );
}
