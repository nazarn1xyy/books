/**
 * FB2 Parser Utility
 * 
 * Handles parsing of FB2 book files (plain and zipped).
 * Extracts text content, metadata (title, author, description, series), and cover images.
 * Supports both Web Worker and synchronous (main-thread) parsing as fallback.
 */

export interface ParsedBookData {
    text: string;
    cover?: string;
    title?: string;
    author?: string;
    description?: string;
    series?: string;
    seriesNumber?: number;
    chapters?: { title: string; paragraphIndex: number }[];
}

/**
 * Detects the encoding of an XML file from its declaration header.
 * Falls back to UTF-8 if no encoding is found.
 */
function detectEncoding(buffer: Uint8Array): string {
    try {
        const header = new TextDecoder('ascii').decode(buffer.slice(0, 1024));
        const match = header.match(/encoding=["']([a-zA-Z0-9-_]+)["']/i);
        if (match && match[1]) {
            return match[1];
        }
    } catch (_e) {
        // Ignore
    }
    return 'utf-8';
}

/**
 * Decodes raw binary data to XML text.
 * Handles both ZIP-compressed and plain FB2 files.
 * Tries Web Worker first for non-blocking parsing, falls back to synchronous.
 */
async function decodeToXmlText(data: ArrayBuffer): Promise<string> {
    // 1. Try to use Web Worker for heavy lifting (Unzip & Decode)
    try {
        return await new Promise<string>((resolve, reject) => {
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

                // Don't use transferable to keep data available for fallback
                worker.postMessage({ arrayBuffer: data });
            } catch (workerError) {
                // Worker creation failed (iOS/Safari issue)
                console.error('Failed to create worker:', workerError);
                reject(new Error(`Worker not supported: ${workerError instanceof Error ? workerError.message : 'Unknown'}`));
            }
        });
    } catch (workerError) {
        // FALLBACK: Parse synchronously in main thread (iOS/Safari)
        console.warn('Worker not available, using synchronous parsing:', workerError);
        return await decodeSynchronous(data);
    }
}

/**
 * Synchronous fallback for decoding FB2 data on the main thread.
 * Used when Web Worker is unavailable (e.g., on iOS/Safari).
 */
async function decodeSynchronous(data: ArrayBuffer): Promise<string> {
    const JSZip = (await import('jszip')).default;

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
                return decoder.decode(fileData);
            } catch {
                const decoder = new TextDecoder('utf-8');
                return decoder.decode(fileData);
            }
        } else {
            throw new Error('No .fb2 file found in archive');
        }
    } else {
        const fileData = new Uint8Array(data);
        const encoding = detectEncoding(fileData);
        try {
            const decoder = new TextDecoder(encoding);
            return decoder.decode(fileData);
        } catch {
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(fileData);
        }
    }
}

/**
 * Extracts metadata and body text from a parsed FB2 XML document.
 */
function extractFb2Content(doc: Document): ParsedBookData {
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

    // Extract Body Text + Chapters
    const bodyElements = doc.getElementsByTagNameNS('*', 'body');
    const body = bodyElements.length > 0 ? bodyElements[0] : null;

    let extractedText = '';
    const chapters: { title: string; paragraphIndex: number }[] = [];

    if (body) {
        const allParagraphs = Array.from(body.getElementsByTagNameNS('*', 'p'));
        extractedText = allParagraphs.map(p => p.textContent || '').join('\n\n');

        // Extract chapter positions from sections
        const processSection = (section: Element, depth: number) => {
            if (depth > 3) return;
            const localName = (el: Element) => el.localName || el.tagName?.split(':').pop() || '';

            // Find a direct <title> child of this section
            const titleEl = Array.from(section.children).find(c => localName(c) === 'title');
            if (titleEl) {
                const rawTitle = titleEl.textContent?.trim().replace(/\s+/g, ' ') || '';
                if (rawTitle && rawTitle.length < 300) {
                    // First non-title <p> in this section gives chapter start position
                    const titlePs = new Set(Array.from(titleEl.getElementsByTagNameNS('*', 'p')));
                    const sectionPs = Array.from(section.getElementsByTagNameNS('*', 'p'));
                    const firstContentP = sectionPs.find(p => !titlePs.has(p)) || sectionPs[0];
                    if (firstContentP) {
                        const idx = allParagraphs.indexOf(firstContentP);
                        if (idx >= 0) chapters.push({ title: rawTitle, paragraphIndex: idx });
                    }
                }
            }

            // Recurse into child sections
            Array.from(section.children)
                .filter(c => localName(c) === 'section')
                .forEach(s => processSection(s as Element, depth + 1));
        };

        Array.from(body.children)
            .filter(c => (c.localName || c.tagName?.split(':').pop() || '') === 'section')
            .forEach(s => processSection(s as Element, 0));
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
        seriesNumber,
        chapters: chapters.length > 0 ? chapters : undefined
    };
}

/**
 * Main entry point: parses an FB2 book from raw binary data (ArrayBuffer).
 * Handles decompression, encoding detection, XML parsing, and metadata extraction.
 * 
 * @param data - Raw ArrayBuffer of the FB2 file (plain or ZIP-compressed)
 * @returns Parsed book data including text, metadata, and cover image
 */
export async function parseBookData(data: ArrayBuffer): Promise<ParsedBookData> {
    // Step 1: Decode binary data to XML text
    const text = await decodeToXmlText(data);

    // Step 2: Parse XML
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

    // Step 3: Extract content and metadata
    return extractFb2Content(doc);
}
