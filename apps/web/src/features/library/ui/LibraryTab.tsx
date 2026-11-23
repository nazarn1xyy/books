import { useState } from 'react';
import { BookOpen, ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import type { LibraryEntry } from '../model/useLibraryGrouping';
import { BookListItem } from './BookListItem';

/** Library books; series collapse into an expandable group. */
export function LibraryTab({ entries, onRemove }: { entries: LibraryEntry[]; onRemove: (bookId: string) => void }) {
  const { t } = useLanguage();
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BookOpen size={48} className="text-subtle mb-4" />
        <p className="text-subtle text-center">{t('myBooks.noBooks')}</p>
      </div>
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
