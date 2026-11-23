import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { Book, ReadingProgress } from '@/entities/book/model/types';
import { useBookCover } from '@/entities/book/lib/useBookCover';
import { useCoverAccent } from '@/entities/book/lib/useCoverAccent';
import { BookCover } from '@/entities/book/ui/BookCover';
import { displayTitle } from '@/shared/lib/displayTitle';
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
  const title = displayTitle(book.title || 'Без назви');

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

      <div className="p-4 sm:p-8 lg:p-10">
      <div className="flex items-center gap-4 sm:gap-8">
        <Link to={`/reader/${book.id}`} tabIndex={-1} aria-hidden="true" className="group w-[5.5rem] flex-shrink-0 sm:w-40 lg:w-48">
          <BookCover book={{ ...book, cover }} size="lg" priority className="continue-hero-cover" />
        </Link>

        <div className="min-w-0 flex-1">
          <h2 id="continue-title" className="sr-only">
            {t('home.continueReading')}
          </h2>
          <p className="text-[17px] font-bold leading-snug tracking-tight text-fg line-clamp-2 sm:line-clamp-3 sm:text-3xl sm:leading-tight lg:text-[34px]">
            {title}
          </p>
          <p className="mt-1 text-[13px] text-muted line-clamp-1 sm:mt-1.5 sm:text-base">{book.author}</p>

          <div className="mt-3 flex items-center gap-2.5 sm:mt-6 sm:block sm:max-w-xs">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-fg/15 sm:h-1.5"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('home.percentRead', { percent })}
            >
              <div className="h-full rounded-full bg-[var(--cover-accent)]" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs font-medium tabular-nums text-muted sm:hidden">{percent}%</p>
            <p className="mt-1.5 hidden text-xs font-medium text-muted sm:block">{t('home.percentRead', { percent })}</p>
          </div>

          <Link
            to={`/reader/${book.id}`}
            aria-label={`${t('home.continue')}: ${title}`}
            className="mt-4 hidden items-center gap-2 sm:inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg transition-transform active:scale-95 sm:mt-6"
          >
            <Play size={15} fill="currentColor" aria-hidden="true" />
            {t('home.continue')}
          </Link>
        </div>
      </div>

      {/* Phones: a full-width button under the row, easy to reach with a thumb */}
      <Link
        to={`/reader/${book.id}`}
        aria-label={`${t('home.continue')}: ${title}`}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98] sm:hidden"
      >
        <Play size={15} fill="currentColor" aria-hidden="true" />
        {t('home.continue')}
      </Link>
      </div>
    </section>
  );
}
