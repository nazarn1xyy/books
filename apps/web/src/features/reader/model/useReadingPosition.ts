import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ReadingProgress } from '@/entities/book/model/types';
import type { VirtuosoHandle } from 'react-virtuoso';
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

  const flush = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (pending.current) saveReadingProgress(pending.current);
    pending.current = null;
  }, []);

  // Flush on leave. iOS kills a backgrounded PWA without unmounting anything, so hiding the page
  // (app switcher, lock screen, another tab) must save too, not only navigating away.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

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

  /** How far into the initial paragraph to scroll (bookmarks open at the paragraph start). */
  const initialOffset = useMemo(() => {
    if (!bookId || bookmarkParagraph !== null) return 0;
    const progress = getReadingProgress(bookId);
    return progress && progress.currentPage === initialIndex ? (progress.paragraphOffset ?? 0) : 0;
  }, [bookId, bookmarkParagraph, initialIndex]);

  const scheduleSave = useCallback(
    (index: number, offset: number) => {
      if (!bookId || total === 0) return;
      const percentage = Math.round((index / total) * 100);
      setScrollProgress(percentage);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pending.current = {
        bookId,
        currentPage: index,
        totalPages: total,
        lastRead: Date.now(),
        scrollPercentage: percentage,
        paragraphOffset: offset,
      };
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [bookId, total, flush],
  );

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

      // Text in scroll mode reports the exact line through handleLinePosition instead.
      if (isPdf) scheduleSave(currentIndex, 0);
    },
    [bookId, total, isPdf, initialIndex, scheduleSave],
  );

  /** Scroll mode: the paragraph at the top of the screen and how far into it (0..1) the reader is. */
  const handleLinePosition = useCallback(
    (index: number, offset: number) => {
      if (!restored.current) return;
      scheduleSave(index, offset);
    },
    [scheduleSave],
  );

  return { initialIndex, initialOffset, visibleRange, scrollProgress, displayPageNumber, handleRangeChanged, handleLinePosition };
}
