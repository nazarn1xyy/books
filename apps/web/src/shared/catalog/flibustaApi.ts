import type { Book } from '@/entities/book/model/types';
import { getCachedBook, cacheBook } from './bookCache';
import { parseBookData } from './fb2Parser';
import { decodeEntities } from './decodeEntities';
import { CATALOG_ORIGIN, catalogImageUrl } from '@/shared/api/CatalogApi';
import { ApiError } from '@/shared/api/ApiError';
import { services } from '@/shared/services';

// Re-export parseBookData for backward compatibility
// (used by MyBooks.tsx via `import { parseBookData } from './flibustaApi'`)
export { parseBookData } from './fb2Parser';

export async function fetchBooks(query: string = ''): Promise<Book[]> {
    if (!query) {
        return [];
    }

    // Errors propagate: callers (TanStack Query) show an error state instead of caching an empty result.
    const xmlText = await services().catalog.searchOpds(query);

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const books: Book[] = [];
    const entries = doc.querySelectorAll('entry');

    entries.forEach((entry) => {
        const title = decodeEntities(entry.querySelector('title')?.textContent || 'Unknown Title');

        // Author: <author><name>...</name></author>
        const authorName = decodeEntities(entry.querySelector('author name')?.textContent || 'Unknown Author');

        // ID: <id>tag:book:123</id> or extract from link
        // OPDS often uses URNs. Flibusta uses tag:book:{id}
        const idText = entry.querySelector('id')?.textContent || '';
        // Extract the number at the end
        const idMatch = idText.match(/:(\d+)$/);
        // Alternatively try finding a link with /b/{id}
        let id = idMatch ? idMatch[1] : '';

        if (!id) {
            // Fallback: look for <link href="/b/123/fb2">
            const fb2Link = Array.from(entry.querySelectorAll('link')).find(l => l.getAttribute('type')?.includes('fb2'));
            if (fb2Link) {
                const href = fb2Link.getAttribute('href') || '';
                const match = href.match(/\/b\/(\d+)/);
                if (match) id = match[1];
            }
        }

        if (!id) return;

        // Cover: <link rel="http://opds-spec.org/image" href="...">
        // or thumbnail or image MIME
        let cover = '';
        const imageLink = Array.from(entry.querySelectorAll('link')).find(l => {
            const rel = (l.getAttribute('rel') || '').toLowerCase();
            const type = (l.getAttribute('type') || '').toLowerCase();
            return (
                rel.includes('image') ||
                rel.includes('thumbnail') ||
                rel.includes('cover') ||
                type.startsWith('image/')
            );
        });

        if (imageLink) {
            const href = imageLink.getAttribute('href');
            if (href) cover = catalogImageUrl(href);
        }

        if (!books.find(b => b.id === id)) {
            books.push({
                id,
                title,
                author: authorName,
                cover: cover || '',
                description: entry.querySelector('content')?.textContent || '',
                genre: '',
                contentUrl: `${CATALOG_ORIGIN}/b/${id}/fb2`
            });
        }
    });

    return books;
}

export async function fetchBookContent(bookId: string): Promise<{ text: string; cover?: string; pdfData?: ArrayBuffer; title?: string; author?: string; series?: string; seriesNumber?: number; chapters?: { title: string; paragraphIndex: number }[] }> {
    // 1. Check Cache first — only use if it actually has content
    const cached = await getCachedBook(bookId);
    if (cached && (cached.text?.trim() || cached.pdfData)) {
        return {
            text: cached.text,
            cover: cached.cover,
            pdfData: cached.pdfData,
            title: cached.title,
            author: cached.author,
            series: cached.series,
            seriesNumber: cached.seriesNumber,
            chapters: cached.chapters,
        };
    }

    try {
        // Fetch as ArrayBuffer to handle ZIP
        const data = await services().catalog.downloadBook(bookId, 'fb2');

        // Check if we got an empty response
        if (!data || data.byteLength === 0) {
            throw new Error('Книга не найдена на Флибусте. Попробуйте другую книгу.');
        }

        // Check if it's HTML (error page) instead of FB2/ZIP
        const firstBytes = new Uint8Array(data.slice(0, 200));
        const headerText = new TextDecoder('utf-8', { fatal: false }).decode(firstBytes);

        if (headerText.includes('<!DOCTYPE') || headerText.includes('<html') || headerText.includes('<HTML')) {
            console.error('Received HTML instead of FB2. First 200 chars:', headerText);

            // Check if it's specifically a 404 or access error
            if (headerText.includes('404') || headerText.toLowerCase().includes('not found')) {
                throw new Error('Книга не найдена на сервере. Возможно, она была удалена.');
            }

            throw new Error('Сервер Флибусты временно недоступен. Попробуйте позже.');
        }

        // Use shared parsing logic from fb2Parser utility
        const parsedData = await parseBookData(data);

        if (!parsedData.text || parsedData.text.trim().length === 0) {
            throw new Error('Не удалось извлечь текст из книги. Формат файла может быть повреждён.');
        }

        // 2. Cache the result
        if (parsedData.text) {
            await cacheBook(bookId, parsedData.text, parsedData.cover || '', undefined, {
                title: parsedData.title,
                author: parsedData.author,
                series: parsedData.series,
                seriesNumber: parsedData.seriesNumber,
                chapters: parsedData.chapters,
            });
        }

        return {
            text: parsedData.text,
            cover: parsedData.cover,
            title: parsedData.title,
            author: parsedData.author,
            series: parsedData.series,
            seriesNumber: parsedData.seriesNumber,
            chapters: parsedData.chapters,
        };
    } catch (error) {
        console.error('Failed to fetch book:', error);

        throw new Error(bookDownloadErrorMessage(error));
    }
}

/** User-facing text for a failed book download; API/network errors never leak raw technical messages. */
function bookDownloadErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        switch (error.code) {
            case 'NETWORK':
                return 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.';
            case 'TIMEOUT':
                return 'Флибуста отвечает слишком долго. Попробуйте позже.';
            case 'NOT_FOUND':
                return 'Книга не найдена на Флибусте. Попробуйте другую книгу.';
            case 'RATE_LIMITED':
                return 'Слишком много запросов. Подождите минуту и попробуйте снова.';
            default:
                return 'Сервер Флибусты временно недоступен. Попробуйте позже.';
        }
    }
    // Our own messages thrown above are already user-facing.
    return error instanceof Error ? error.message : 'Неизвестная ошибка при загрузке книги';
}
