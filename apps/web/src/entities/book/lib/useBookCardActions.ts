import { useEffect, useState, type MouseEvent } from 'react';
import { cacheBook, getCachedBookIds, markBookCached } from '@/shared/catalog/bookCache';
import { fetchBookContent } from '@/shared/catalog/flibustaApi';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { addFavorite, isBookFavorite, removeFavorite } from '@/shared/storage/collections';
import { useToast } from '@/shared/ui/useToast';
import type { Book } from '../model/types';

interface Options {
    book: Book;
    coverSrc: string | undefined;
    showActions: boolean;
    initialFavorite?: boolean;
}

/** Card quick actions: favorite toggle, share, save for offline; feedback via a short toast. */
export function useBookCardActions({ book, coverSrc, showActions, initialFavorite }: Options) {
    const { t } = useLanguage();
    const [isFavorite, setIsFavorite] = useState(initialFavorite ?? false);
    const [isLoading, setIsLoading] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const { message: cardToast, show: showCardToast } = useToast(2000);

    // Cards render only on signed-in pages; with actions shown, check the favorite status on mount
    useEffect(() => {
        if (showActions && initialFavorite === undefined) {
            isBookFavorite(book.id).then(setIsFavorite).catch(() => {});
        }
    }, [book.id, showActions, initialFavorite]);

    // Check if book is cached (offline) using shared Set
    useEffect(() => {
        let isMounted = true;
        getCachedBookIds()
            .then(ids => {
                if (isMounted) setIsOffline(ids.has(book.id));
            })
            .catch(() => {
                if (isMounted) setIsOffline(false);
            });
        return () => {
            isMounted = false;
        };
    }, [book.id]);

    const handleFavoriteClick = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoading) return;

        setIsLoading(true);
        try {
            if (isFavorite) {
                await removeFavorite(book.id);
                setIsFavorite(false);
            } else {
                await addFavorite({
                    id: book.id,
                    title: book.title,
                    author: book.author,
                    cover: coverSrc || ''
                });
                setIsFavorite(true);
            }
        } catch {
            showCardToast(t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareClick = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const shareData = {
            title: book.title,
            text: `${book.title} - ${book.author}`,
            url: `https://libify.store/reader/${book.id}`
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                showCardToast(t('reader.quoteSaved'));
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                showCardToast(t('common.error'));
            }
        }
    };

    const handleDownloadClick = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDownloading || isOffline) return;

        setIsDownloading(true);
        try {
            const bookData = await fetchBookContent(book.id);
            if (bookData) {
                await cacheBook(
                    book.id,
                    bookData.text || '',
                    coverSrc || '',
                    bookData.pdfData,
                    {
                        title: bookData.title,
                        author: bookData.author,
                        series: bookData.series,
                        seriesNumber: bookData.seriesNumber,
                        chapters: bookData.chapters
                    }
                );
                markBookCached(book.id);
                setIsOffline(true);
                showCardToast(t('common.save'));
            }
        } catch {
            showCardToast(t('errors.networkError'));
        } finally {
            setIsDownloading(false);
        }
    };

    return {
        isFavorite,
        isLoading,
        isOffline,
        isDownloading,
        toast: cardToast,
        handleFavoriteClick,
        handleShareClick,
        handleDownloadClick,
    };
}
