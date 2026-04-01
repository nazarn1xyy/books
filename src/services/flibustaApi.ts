import type { Book } from '../types';
import { getCachedBook, cacheBook } from '../utils/cache';
import { parseBookData } from '../utils/fb2Parser';

// Re-export parseBookData for backward compatibility
// (used by MyBooks.tsx via `import { parseBookData } from '../services/flibustaApi'`)
export { parseBookData } from '../utils/fb2Parser';

const PROXY_URL = '/flibusta';
const FLIBUSTA_BASE = 'http://flibustaongezhld6dibs2dps6vm4nvqg2kp7vgowbu76tzopgnhazqd.onion';

// Helper to fetch via proxy with retry logic
async function fetchViaProxy(
    url: string,
    responseType: 'text' | 'blob' | 'arraybuffer' = 'text',
    retries = 3,
    timeout = 15000
): Promise<string | Blob | ArrayBuffer> {
    const targetUrl = new URL(url);
    const pathAndQuery = targetUrl.pathname + targetUrl.search;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(`${PROXY_URL}${pathAndQuery}`, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                if (responseType === 'text') return response.text();
                if (responseType === 'blob') return response.blob();
                return response.arrayBuffer();
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            const isLastAttempt = attempt === retries;
            const errorMsg = error instanceof Error ? error.message : String(error);

            console.warn(`Attempt ${attempt}/${retries} failed for ${pathAndQuery}:`, errorMsg);

            if (isLastAttempt) {
                throw new Error(`Не удалось загрузить книгу после ${retries} попыток. ${errorMsg}`);
            }

            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }

    throw new Error('Не удалось загрузить книгу');
}

export async function fetchBooks(query: string = ''): Promise<Book[]> {
    if (!query) {
        return [];
    }

    try {
        const url = `${FLIBUSTA_BASE}/opds/search?searchType=books&searchTerm=${encodeURIComponent(query)}`;
        const xmlText = await fetchViaProxy(url) as string;

        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');

        const books: Book[] = [];
        const entries = doc.querySelectorAll('entry');

        entries.forEach((entry) => {
            const title = entry.querySelector('title')?.textContent || 'Unknown Title';

            // Author: <author><name>...</name></author>
            const authorName = entry.querySelector('author name')?.textContent || 'Unknown Author';

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
            // or thumbnail
            let cover = '';
            const imageLink = Array.from(entry.querySelectorAll('link')).find(l =>
                l.getAttribute('rel') === 'http://opds-spec.org/image' ||
                l.getAttribute('rel') === 'http://opds-spec.org/thumbnail'
            );

            if (imageLink) {
                const href = imageLink.getAttribute('href');
                if (href) {
                    // Handle relative URLs
                    const coverUrl = href.startsWith('http') ? href : `${FLIBUSTA_BASE}${href}`;
                    // Route cover through proxy too if it's from flibusta
                    if (coverUrl.includes('flibusta') || coverUrl.includes('onion')) {
                        const u = new URL(coverUrl);
                        cover = `${PROXY_URL}${u.pathname}${u.search}`;
                    } else {
                        // External covers (rare)
                        cover = coverUrl;
                    }
                }
            }

            if (!books.find(b => b.id === id)) {
                books.push({
                    id,
                    title,
                    author: authorName,
                    cover: cover || 'https://placehold.co/300x450?text=No+Cover',
                    description: entry.querySelector('content')?.textContent || '',
                    genre: '',
                    contentUrl: `${FLIBUSTA_BASE}/b/${id}/fb2`
                });
            }
        });

        return books;
    } catch (error) {
        console.error('Flibusta search failed:', error);
        return [];
    }
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
        const url = `${FLIBUSTA_BASE}/b/${bookId}/fb2`;

        // Fetch as ArrayBuffer to handle ZIP (with retry logic)
        const data = await fetchViaProxy(url, 'arraybuffer') as ArrayBuffer;

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

        // Provide user-friendly error message
        const errorMessage = error instanceof Error
            ? error.message
            : 'Неизвестная ошибка при загрузке книги';

        throw new Error(errorMessage);
    }
}
