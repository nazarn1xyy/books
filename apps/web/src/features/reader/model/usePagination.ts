import { useCallback, useEffect, useMemo, useState } from 'react';
import { saveReadingProgress } from '@/shared/storage/storage';

export const PARAGRAPHS_PER_PAGE = 10;

interface Options {
  bookId: string | undefined;
  paragraphs: string[];
  /** Keyboard navigation is active (page mode and no sheet open). */
  keyboardEnabled: boolean;
  onEscape(): void;
}

/** Page-flip mode: current page, navigation (buttons and ←/→/space), progress saved on forward flips. */
export function usePagination({ bookId, paragraphs, keyboardEnabled, onEscape }: Options) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const totalFlipPages = Math.ceil(paragraphs.length / PARAGRAPHS_PER_PAGE);

  const goToNextPage = useCallback(() => {
    if (currentPageIndex >= totalFlipPages - 1) return;
    const newIndex = currentPageIndex + 1;
    setCurrentPageIndex(newIndex);
    if (bookId) {
      saveReadingProgress({
        bookId,
        currentPage: newIndex * PARAGRAPHS_PER_PAGE,
        totalPages: paragraphs.length,
        lastRead: Date.now(),
        scrollPercentage: Math.round((newIndex / totalFlipPages) * 100),
      });
    }
  }, [currentPageIndex, totalFlipPages, bookId, paragraphs.length]);

  const goToPrevPage = useCallback(() => {
    if (currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
  }, [currentPageIndex]);

  /** Opens the page that contains the given paragraph (when switching from scroll mode). */
  const showParagraph = useCallback((paragraphIndex: number) => {
    setCurrentPageIndex(Math.floor(paragraphIndex / PARAGRAPHS_PER_PAGE));
  }, []);

  useEffect(() => {
    if (!keyboardEnabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          goToNextPage();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevPage();
          break;
        case 'Escape':
          onEscape();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardEnabled, goToNextPage, goToPrevPage, onEscape]);

  const currentPageParagraphs = useMemo(() => {
    const start = currentPageIndex * PARAGRAPHS_PER_PAGE;
    return paragraphs.slice(start, start + PARAGRAPHS_PER_PAGE);
  }, [paragraphs, currentPageIndex]);

  return { currentPageIndex, totalFlipPages, currentPageParagraphs, goToNextPage, goToPrevPage, showParagraph };
}
