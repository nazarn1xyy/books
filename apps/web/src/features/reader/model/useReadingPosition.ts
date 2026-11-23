import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
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

  /** Paragraph (or PDF page) to open at: bookmark `?p=` first, then saved progress. */
  const initialIndex = useMemo(() => {
    if (!bookId || total === 0) return 0;
    let index = 0;
    if (bookmarkParagraph !== null) {
      index = parseInt(bookmarkParagraph, 10);
    } else {
      const progress = getReadingProgress(bookId);
      if (progress) {
        if (progress.currentPage < total) index = progress.currentPage;
        else if (progress.scrollPercentage) index = Math.floor((progress.scrollPercentage / 100) * total);
      }
    }
    return Math.max(0, Math.min(Number.isNaN(index) ? 0 : index, total - 1));
  }, [bookId, total, bookmarkParagraph]);

  /**
   * Progress is saved only after the view has reached the restored position. Before that the list
   * reports index 0 while it mounts, and saving it would overwrite the reader's real place.
   */
  const restored = useRef(false);
  useEffect(() => {
    restored.current = initialIndex === 0;
  }, [initialIndex, bookId]);

  // PDFs have no initialTopMostItemIndex: scroll once the viewer's list exists.
  useEffect(() => {
    if (!isPdf || initialIndex === 0) return;
    const timer = setTimeout(() => virtuosoRef.current?.scrollToIndex({ index: initialIndex, align: 'start' }), 300);
    return () => clearTimeout(timer);
  }, [isPdf, initialIndex, virtuosoRef]);

  const handleRangeChanged = useCallback(
    (range: VisibleRange) => {
      if (!bookId) return;
      setVisibleRange(range);
      if (total === 0) return;

      const currentIndex = range.startIndex;
      if (isPdf) setDisplayPageNumber(currentIndex + 1);
      if (!restored.current) {
        if (Math.abs(currentIndex - initialIndex) > 2) return;
        restored.current = true;
      }

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
    [bookId, total, isPdf, initialIndex],
  );

  return { initialIndex, visibleRange, scrollProgress, displayPageNumber, handleRangeChanged };
}
