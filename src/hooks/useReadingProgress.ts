import { useState, useCallback } from 'react';
import type { ReadingProgress } from '../types';
import { getReadingProgress, saveReadingProgress } from '../utils/storage';

export function useReadingProgress(bookId: string, totalPages: number) {
    const [progress, setProgress] = useState<ReadingProgress>(() => {
        const saved = getReadingProgress(bookId);
        return saved || {
            bookId,
            currentPage: 0,
            totalPages,
            lastRead: Date.now(),
        };
    });



    const updatePage = useCallback((page: number) => {
        const newProgress: ReadingProgress = {
            bookId,
            currentPage: Math.max(0, Math.min(page, totalPages - 1)),
            totalPages,
            lastRead: Date.now(),
        };
        setProgress(newProgress);
        saveReadingProgress(newProgress);
    }, [bookId, totalPages]);

    const nextPage = useCallback(() => {
        if (progress.currentPage < totalPages - 1) {
            updatePage(progress.currentPage + 1);
        }
    }, [progress.currentPage, totalPages, updatePage]);

    const prevPage = useCallback(() => {
        if (progress.currentPage > 0) {
            updatePage(progress.currentPage - 1);
        }
    }, [progress.currentPage, updatePage]);

    const percentage = Math.round(((progress.currentPage + 1) / totalPages) * 100);

    return {
        progress,
        currentPage: progress.currentPage,
        percentage,
        updatePage,
        nextPage,
        prevPage,
        hasNext: progress.currentPage < totalPages - 1,
        hasPrev: progress.currentPage > 0,
    };
}
