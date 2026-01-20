import type { Book } from '../types';
import { getCachedBook, cacheBook } from '../utils/cache';

const PROXY_URL = '/flibusta';
const FLIBUSTA_BASE = 'http://flibustaongezhld6dibs2dps6vm4nvqg2kp7vgowbu76tzopgnhazqd.onion';

// Helper to fetch via proxy
async function fetchViaProxy(url: string, responseType: 'text' | 'blob' | 'arraybuffer' = 'text'): Promise<string | Blob | ArrayBuffer> {
    // Extract the path from the full URL to append to our proxy
    const targetUrl = new URL(url);
    const pathAndQuery = targetUrl.pathname + targetUrl.search;

    console.log(`Fetching via local proxy: ${PROXY_URL}${pathAndQuery}`);
    try {
        const response = await fetch(`${PROXY_URL}${pathAndQuery}`, {
            redirect: 'manual' // Prevent browser from following automatically (which causes mixed content)
        });

        // Handle Redirects Manually
        if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
            const location = response.headers.get('Location');
            if (location) {
                console.log('Intercepted redirect to:', location);
                // Recursively fetch the new location
                // If it's absolute (http/https), strip domain and use proxy again
                let newUrl = location;
                if (location.startsWith('http')) {
                    const u = new URL(location);
                    newUrl = `${FLIBUSTA_BASE}${u.pathname}${u.search}`;
                }
                // Call self with new URL (which enters proxy logic again)
                return fetchViaProxy(newUrl, responseType);
            }
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        }
        if (responseType === 'text') return response.text();
        if (responseType === 'blob') return response.blob();
        return response.arrayBuffer();
    } catch (error) {
        console.error(`Proxy fetch error for ${url}:`, error);
        throw error;
    }
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

export async function fetchBookContent(bookId: string): Promise<{ text: string; cover?: string }> {
    // 1. Check Cache first
    const cached = await getCachedBook(bookId);
    if (cached) {
        console.log(`Cache hit for book ${bookId}`);
        return { text: cached.text, cover: cached.cover };
    }

    try {
        const url = `${FLIBUSTA_BASE}/b/${bookId}/fb2`;
        console.log('Downloading book from:', url);

        // Fetch as ArrayBuffer to handle ZIP
        const data = await fetchViaProxy(url, 'arraybuffer') as ArrayBuffer;

        // Use Web Worker for heavy lifting (Unzip & Decode)
        const text = await new Promise<string>((resolve, reject) => {
            const worker = new Worker(new URL('../workers/bookParser.worker.ts', import.meta.url), { type: 'module' });

            worker.onmessage = (e) => {
                if (e.data.type === 'SUCCESS') {
                    resolve(e.data.text);
                } else {
                    reject(new Error(e.data.error));
                }
                worker.terminate();
            };

            worker.onerror = (err) => {
                reject(err);
                worker.terminate();
            };

            // Transfer buffer to worker
            worker.postMessage({ arrayBuffer: data }, [data]);
        });

        // Main thread only parses the XML string now
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');

        // Parse cover
        // <binary id="cover.jpg" content-type="image/jpeg">BASE64...</binary>
        let cover = '';
        const binaryCover = doc.querySelector('binary[id*="cover"]');
        if (binaryCover) {
            const contentType = binaryCover.getAttribute('content-type') || 'image/jpeg';
            const base64 = binaryCover.textContent;
            cover = `data:${contentType};base64,${base64}`;
        }

        // Parse body
        // <body><section><p>...</p></section></body>
        const body = doc.querySelector('body');
        let extractedText = '';

        if (body) {
            const paragraphs = body.querySelectorAll('p');
            // Convert to simple text for now, joining with newlines
            // Better: keep structure? For now simple text string as reader expects
            extractedText = Array.from(paragraphs).map(p => p.textContent).join('\n\n');
        }

        if (!extractedText && doc.querySelector('parsererror')) {
            throw new Error('Failed to parse FB2 XML');
        }

        // 2. Cache the result
        if (extractedText) {
            console.log(`Caching book ${bookId}`);
            await cacheBook(bookId, extractedText, cover);
        }

        return { text: extractedText, cover };
    } catch (error) {
        console.error('Failed to fetch FB2:', error);
        throw error;
    }
}
