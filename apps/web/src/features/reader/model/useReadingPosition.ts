import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { ReadingProgress } from '@/entities/book/model/types';
import { getReadingProgress, saveReadingProgress } from '@/shared/storage/storage';

const SAVE_DEBOUNCE_MS = 1000;

export interface VisibleRange {
  startIndex: number;
  endIndex: number;
}

interface Options {
  bookId: string | undefined;
  /** Paragraph count for text books, page count for PDFs. */
  total: number;
  isPdf: boolean;
  /** `?p=` bookmark target, takes precedence over saved progress. */
  bookmarkParagraph: string | null;
  virtuosoRef: RefObject<VirtuosoHandle | null>;
}

/** Restores the saved position, tracks the visible range and saves progress (debounced, flushed on leave). */
export function useReadingPosition({ bookId, total, isPdf, bookmarkParagraph, virtuosoRef }: Options) {
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({ startIndex: 0, endIndex: 0 });
  const [scrollProgress, setScrollProgress] = useState(0);
  const [displayPageNumber, setDisplayPageNumber] = useState(1);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<ReadingProgress | null>(null);

  // Flush a pending progress save on unmount.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pending.current) saveReadingProgress(pending.current);
    },
    [],
  );

  // Restore the scroll position once the content is known.
  useEffect(() => {
    if (!bookId || !virtuosoRef.current || total === 0) return;

    let startIndex = 0;
    if (bookmarkParagraph !== null) {
      startIndex = parseInt(bookmarkParagraph, 10);
    } else {
      const progress = getReadingProgress(bookId);
      if (progress) {
        if (progress.currentPage !== undefined && progress.currentPage < total) {
          startIndex = progress.currentPage;
        } else if (progress.scrollPercentage) {
          startIndex = Math.floor((progress.scrollPercentage / 100) * total);
        }
      }
    }
    const safeIndex = Math.max(0, Math.min(Number.isNaN(startIndex) ? 0 : startIndex, total - 1));
    const timer = setTimeout(() => virtuosoRef.current?.scrollToIndex({ index: safeIndex, align: 'start' }), 100);
    return () => clearTimeout(timer);
  }, [bookId, total, bookmarkParagraph, virtuosoRef]);

  const handleRangeChanged = useCallback(
    (range: VisibleRange) => {
      if (!bookId) return;
      setVisibleRange(range);
      if (total === 0) return;

      const currentIndex = range.startIndex;
      if (isPdf) setDisplayPageNumber(currentIndex + 1);

      const percentage = Math.round((currentIndex / total) * 100);
      setScrollProgress(percentage);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      const progress: ReadingProgress = {
        bookId,
        currentPage: currentIndex,
        totalPages: total,
        lastRead: Date.now(),
        scrollPercentage: percentage,
      };
      pending.current = progress;
      saveTimer.current = setTimeout(() => {
        saveReadingProgress(progress);
        pending.current = null;
      }, SAVE_DEBOUNCE_MS);
    },
    [bookId, total, isPdf],
  );

  return { visibleRange, scrollProgress, displayPageNumber, handleRangeChanged };
}
