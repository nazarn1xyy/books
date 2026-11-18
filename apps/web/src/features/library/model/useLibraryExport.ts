import { useState } from 'react';
import { exportAllBooks } from '@/shared/lib/export';

export interface ExportProgressState {
  current: number;
  total: number;
  bookTitle: string;
}

const IDLE: ExportProgressState = { current: 0, total: 0, bookTitle: '' };

/** Exports the given books as one ZIP, tracking progress. */
export function useLibraryExport(onError: (message: string) => void) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgressState>(IDLE);

  const exportBooks = async (bookIds: string[], fallbackError: string) => {
    setIsExporting(true);
    try {
      await exportAllBooks(bookIds, setProgress);
    } catch (error) {
      onError(error instanceof Error ? error.message : fallbackError);
    } finally {
      setIsExporting(false);
      setProgress(IDLE);
    }
  };

  return { isExporting, progress, exportBooks };
}
