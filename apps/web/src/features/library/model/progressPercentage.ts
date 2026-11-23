import type { ReadingProgress } from '@/entities/book/model/types';

export function progressPercentage(progress: ReadingProgress | null): number {
  if (!progress) return 0;
  if (progress.scrollPercentage !== undefined) return progress.scrollPercentage;
  return progress.totalPages > 0 ? Math.round(((progress.currentPage + 1) / progress.totalPages) * 100) : 0;
}
