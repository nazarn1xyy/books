import type { Book } from '../types';
import { getCachedBook, cacheBook } from '../utils/cache';

const PROXY_URL = '/flibusta';
const FLIBUSTA_BASE = 'http://flibustaongezhld6dibs2dps6vm4nvqg2kp7vgowbu76tzopgnhazqd.onion';

// Helper to fetch via proxy
async function fetchViaProxy(url: string, responseType: 'text' | 'blob' | 'arraybuffer' = 'text'): Promise<string | Blob | ArrayBuffer> {
    // Extract the path from the full URL to append to our proxy
    const targetUrl = new URL(url);
    const pathAndQuery = targetUrl.pathname + targetUrl.search;


    try {
        const response = await fetch(`${PROXY_URL}${pathAndQuery}`);

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

// Shared parsing logic for both remote and local books
export async function parseBookData(data: ArrayBuffer): Promise<{ text: string; cover?: string; title?: string; author?: string; description?: string; series?: string; seriesNumber?: number }> {
    let text = '';

    // 1. Try to use Web Worker for heavy lifting (Unzip & Decode)
    try {
        text = await new Promise<string>((resolve, reject) => {
            try {
                const worker = new Worker(new URL('../workers/bookParser.worker.ts', import.meta.url), { type: 'module' });

                const timeout = setTimeout(() => {
                    worker.terminate();
                    reject(new Error('Worker timeout'));
                }, 10000); // 10 second timeout

                worker.onmessage = (e) => {
                    clearTimeout(timeout);
                    if (e.data.type === 'SUCCESS') {
                        resolve(e.data.text);
                    } else {
                        reject(new Error(`Worker error: ${e.data.error || 'Unknown'}`));
                    }
                    worker.terminate();
                };

                worker.onerror = (err) => {
                    clearTimeout(timeout);
                    console.error('Worker initialization error:', err);
                    reject(new Error(`Worker failed: ${err.message || 'Cannot start worker'}`));
                    worker.terminate();
                };

                // Transfer buffer to worker
                worker.postMessage({ arrayBuffer: data }, [data]);
            } catch (workerError) {
                // Worker creation failed (iOS/Safari issue)
                console.error('Failed to create worker:', workerError);
                reject(new Error(`Worker not supported: ${workerError instanceof Error ? workerError.message : 'Unknown'}`));
            }
        });
    } catch (workerError) {
        // FALLBACK: Parse synchronously in main thread (iOS/Safari)
        console.warn('Worker not available, using synchronous parsing:', workerError);
        const JSZip = (await import('jszip')).default;

        // Helper function for encoding detection
        const detectEncoding = (buffer: Uint8Array): string => {
            try {
                const header = new TextDecoder('ascii').decode(buffer.slice(0, 1024));
                const match = header.match(/encoding=["']([a-zA-Z0-9-_]+)["']/i);
                if (match && match[1]) {
                    return match[1];
                }
            } catch (e) {
                // Ignore
            }
            return 'utf-8';
        };

        // Check if ZIP
        const arr = new Uint8Array(data.slice(0, 4));
        const isZip = arr[0] === 0x50 && arr[1] === 0x4B && arr[2] === 0x03 && arr[3] === 0x04;

        if (isZip) {
            const zip = await JSZip.loadAsync(data);
            const fb2File = Object.values(zip.files).find(file => file.name.endsWith('.fb2'));

            if (fb2File) {
                const fileData = await fb2File.async('uint8array');
                const encoding = detectEncoding(fileData);
                try {
                    const decoder = new TextDecoder(encoding);
                    text = decoder.decode(fileData);
                } catch {
                    const decoder = new TextDecoder('utf-8');
                    text = decoder.decode(fileData);
                }
            } else {
                throw new Error('No .fb2 file found in archive');
            }
        } else {
            const fileData = new Uint8Array(data);
            const encoding = detectEncoding(fileData);
            try {
                const decoder = new TextDecoder(encoding);
                text = decoder.decode(fileData);
            } catch {
                const decoder = new TextDecoder('utf-8');
                text = decoder.decode(fileData);
            }
        }
    }

    // 2. Parse XML for metadata and body
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    // Check for parser errors with detailed diagnostics
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        const errorText = parserError.textContent || 'Unknown XML error';
        console.error('XML Parse Error:', errorText);
        console.error('Text preview (first 500 chars):', text.substring(0, 500));
        throw new Error(`Failed to parse FB2 XML: ${errorText.substring(0, 200)}`);
    }

    // Validate that it's actually an FB2 document
    const fb2Root = doc.querySelector('FictionBook') || doc.getElementsByTagName('FictionBook')[0];
    if (!fb2Root) {
        console.error('Not a valid FB2 document. Root element:', doc.documentElement?.tagName);
        console.error('Text preview:', text.substring(0, 300));
        throw new Error('Not a valid FB2 document - missing FictionBook root element');
    }

    // Extract Metadata (Title, Author, Description)
    // Use getElementsByTagNameNS('*', tag) to ignore namespace prefixes (e.g., <fb:book-title>)

    // Helper to find first element by local name, ignoring namespace
    const getFirstText = (tagName: string, root: Document | Element = doc): string | null => {
        const elements = root.getElementsByTagNameNS('*', tagName);
        return elements.length > 0 ? elements[0].textContent : null;
    };

    let title = 'Без названия';
    let author = 'Неизвестный автор';
    let description = '';

    // 1. Title
    // Priority: <book-title> -> <title>
    const bookTitleText = getFirstText('book-title');
    if (bookTitleText) {
        title = bookTitleText;
    } else {
        const titleText = getFirstText('title');
        if (titleText) title = titleText;
    }

    // 2. Author
    // Search for <author> tag globally. If multiple, take first.
    // Logic: extract first-name, middle-name, last-name
    const authors = doc.getElementsByTagNameNS('*', 'author');
    if (authors.length > 0) {
        // Use the first author found
        const authorNode = authors[0];

        const fName = getFirstText('first-name', authorNode) || '';
        const lName = getFirstText('last-name', authorNode) || '';
        const mName = getFirstText('middle-name', authorNode) || '';

        const fullName = [fName, mName, lName].filter(Boolean).join(' ');
        if (fullName) author = fullName;
    }

    // 3. Description
    const descText = getFirstText('annotation') || getFirstText('description');
    if (descText) {
        description = descText;
    }

    // Extract Cover
    let cover = '';
    // Global search for binary with id containing 'cover' OR content-type image
    const binaries = Array.from(doc.getElementsByTagNameNS('*', 'binary'));
    const coverBinary = binaries.find(b => {
        const id = b.getAttribute('id') || '';
        const type = b.getAttribute('content-type') || '';
        return id.toLowerCase().includes('cover') || type.startsWith('image/');
    });

    if (coverBinary) {
        const contentType = coverBinary.getAttribute('content-type') || 'image/jpeg';
        const base64 = coverBinary.textContent;
        cover = `data:${contentType};base64,${base64}`;
    }

    // Extract Body Text
    // Note: getElementsByTagNameNS matches whatever namespace.
    const bodyElements = doc.getElementsByTagNameNS('*', 'body');
    const body = bodyElements.length > 0 ? bodyElements[0] : null;

    let extractedText = '';

    if (body) {
        const paragraphs = body.getElementsByTagNameNS('*', 'p');
        extractedText = Array.from(paragraphs).map(p => p.textContent).join('\n\n');
    }

    // 4. Series (Sequence)
    let series = undefined;
    let seriesNumber = undefined;

    // Look for <sequence>
    // Example: <sequence name="Harry Potter" number="1"/>
    const sequences = doc.getElementsByTagNameNS('*', 'sequence');
    if (sequences.length > 0) {
        // Often there might be publish-info sequence too, so we try to find one with a name
        const validSeq = Array.from(sequences).find(s => s.getAttribute('name'));
        if (validSeq) {
            series = validSeq.getAttribute('name') || undefined;
            const num = validSeq.getAttribute('number');
            if (num) seriesNumber = parseInt(num, 10);
        }
    }

    return {
        text: extractedText,
        cover,
        title,
        author,
        description,
        series,
        seriesNumber
    };
}

export async function fetchBookContent(bookId: string): Promise<{ text: string; cover?: string; pdfData?: ArrayBuffer; title?: string; author?: string; series?: string; seriesNumber?: number }> {
    // 1. Check Cache first
    const cached = await getCachedBook(bookId);
    if (cached) {

        return { text: cached.text, cover: cached.cover, pdfData: cached.pdfData };
    }

    try {
        const url = `${FLIBUSTA_BASE}/b/${bookId}/fb2`;


        // Fetch as ArrayBuffer to handle ZIP
        const data = await fetchViaProxy(url, 'arraybuffer') as ArrayBuffer;

        // Use shared parsing logic
        const parsedData = await parseBookData(data);

        // 2. Cache the result
        if (parsedData.text) {

            // Note: For remote books, we might want to prioritize the cover from OPDS if available,
            // but inner FB2 cover is often better quality.
            await cacheBook(bookId, parsedData.text, parsedData.cover || '');
        }

        return {
            text: parsedData.text,
            cover: parsedData.cover,
            title: parsedData.title,
            author: parsedData.author
        };
    } catch (error) {
        console.error('Failed to fetch FB2:', error);
        throw error;
    }
}
