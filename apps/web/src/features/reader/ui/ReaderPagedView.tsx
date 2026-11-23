import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { PARAGRAPHS_PER_PAGE } from '../model/usePagination';
import { useReaderSettings } from '../model/useReaderSettings';

interface ReaderPagedViewProps {
  pageParagraphs: string[];
  pageIndex: number;
  totalPages: number;
  textOf(index: number, original: string): string;
  activeParagraph: number | null;
  onPrev(): void;
  onNext(): void;
}

/** Page-flip reading mode with prev/next controls. */
export function ReaderPagedView({ pageParagraphs, pageIndex, totalPages, textOf, activeParagraph, onPrev, onNext }: ReaderPagedViewProps) {
  const { t } = useLanguage();
  const fontSize = useReaderSettings((s) => s.fontSize);
  return (
    <div className="h-full flex flex-col relative">
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-4 touch-pan-y" style={{ backgroundColor: 'var(--reader-bg)' }}>
        {/* Font size on the column so 68ch tracks the reading size (60–75 characters per line). */}
        <div className="max-w-[68ch] mx-auto" style={{ fontSize: `${fontSize}px` }}>
          {pageParagraphs.map((para, idx) => {
            const actualIndex = pageIndex * PARAGRAPHS_PER_PAGE + idx;
            const isActive = actualIndex === activeParagraph;
            return (
              <p
                key={actualIndex}
                className={`py-2 leading-relaxed transition-colors duration-200 ${
                  isActive ? 'bg-yellow-500/15 -mx-2 px-2 rounded-lg text-lg' : ''
                }`}
                style={{ fontSize: `${fontSize}px`, color: 'var(--reader-text)' }}
              >
                {textOf(actualIndex, para)}
              </p>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 bg-[var(--reader-bg)]/90 border-t border-white/5 flex-shrink-0">
        <button
          onClick={onPrev}
          disabled={pageIndex === 0}
          className="p-3 text-[var(--reader-text)] disabled:opacity-30 active:scale-95 transition-all rounded-full"
          aria-label={t('aria.previousPage')}
        >
          <ChevronLeft size={28} />
        </button>
        <span className="text-[var(--reader-text)] text-sm font-medium">
          {pageIndex + 1} / {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={pageIndex >= totalPages - 1}
          className="p-3 text-[var(--reader-text)] disabled:opacity-30 active:scale-95 transition-all rounded-full"
          aria-label={t('aria.nextPage')}
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}
