import { useState } from 'react';
import { BookOpen, ChevronLeft } from 'lucide-react';
import type { Book } from '@/entities/book/model/types';
import { BookGrid } from '@/shared/ui/BookGrid';
import { EmptyState } from '@/shared/ui/EmptyState';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import type { LibraryEntry } from '../model/useLibraryGrouping';
import type { LibraryView } from '../model/useLibraryView';
import { BookActionsSheet } from './BookActionsSheet';
import { BookListItem } from './BookListItem';
import { LibraryGridItem } from './LibraryGridItem';
import { SeriesStack } from './SeriesStack';

/** Covers on the first row load first. */
const PRIORITY_TILES = 6;

interface LibraryTabProps {
  entries: LibraryEntry[];
  view: LibraryView;
  onRemove: (bookId: string) => void;
}

/** Library books as a cover grid (series stack into one tile) or as a list (series expand in place). */
export function LibraryTab({ entries, view, onRemove }: LibraryTabProps) {
  const { t } = useLanguage();
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<Book | null>(null);

  if (entries.length === 0) {
    return (
      <EmptyState icon={BookOpen} text={t('myBooks.noBooks')} action={{ label: t('empty.findBook'), to: '/search' }} />
    );
  }

  if (view === 'grid') {
    const openSeries = entries.find((e) => e.type === 'series' && e.name === expandedSeries);
    const sheet = <BookActionsSheet book={actionsFor} onClose={() => setActionsFor(null)} onRemove={onRemove} />;

    if (openSeries?.type === 'series') {
      return (
        <section aria-labelledby="series-title">
          <div className="mb-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpandedSeries(null)}
              className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-fg hover:bg-fg/10"
              aria-label={t('common.back')}
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h2 id="series-title" className="text-xl font-semibold tracking-tight text-fg truncate">{openSeries.name}</h2>
              <p className="text-xs text-subtle">{t('myBooks.booksCount', { count: openSeries.books.length })}</p>
            </div>
          </div>
          <BookGrid>
            {openSeries.books.map(({ book, progress }, i) => (
              <LibraryGridItem key={book.id} book={book} progress={progress} priority={i < PRIORITY_TILES} onOpenActions={setActionsFor} />
            ))}
          </BookGrid>
          {sheet}
        </section>
      );
    }

    return (
      <>
        <BookGrid>
          {entries.map((entry, i) =>
            entry.type === 'book' ? (
              <LibraryGridItem
                key={entry.item.book.id}
                book={entry.item.book}
                progress={entry.item.progress}
                priority={i < PRIORITY_TILES}
                onOpenActions={setActionsFor}
              />
            ) : (
              <SeriesStack
                key={`series-${entry.name}`}
                name={entry.name}
                books={entry.books.map((b) => b.book)}
                onOpen={() => setExpandedSeries(entry.name)}
              />
            ),
          )}
        </BookGrid>
        {sheet}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        if (entry.type === 'book') {
          const { book, progress } = entry.item;
          return <BookListItem key={book.id} book={book} progress={progress} onRemove={() => onRemove(book.id)} />;
        }
        const isExpanded = expandedSeries === entry.name;
        return (
          <div key={`series-${entry.name}`} className="space-y-4">
            <div
              onClick={() => setExpandedSeries(isExpanded ? null : entry.name)}
              className="bg-surface/50 border border-fg/5 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="w-16 h-24 bg-surface-2 rounded-lg flex items-center justify-center text-fg/20">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 border-2 border-fg/20 rounded mb-1 bg-surface-2"></div>
                  <div className="w-12 h-1 bg-fg/20 rounded-full"></div>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-fg text-lg">{entry.name}</h3>
                <p className="text-sm text-subtle">
                  {entry.books.length} {t('myBooks.books').toLowerCase()}
                </p>
              </div>
              <div className={`text-subtle transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                <ChevronLeft size={20} className="rotate-180" />
              </div>
            </div>

            {isExpanded && (
              <div className="pl-4 space-y-4 border-l-2 border-line ml-8 animate-page-in">
                {entry.books.map(({ book, progress }) => (
                  <BookListItem key={book.id} book={book} progress={progress} onRemove={() => onRemove(book.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
