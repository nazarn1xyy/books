import type { Book } from '../types';

const API_URL = 'https://gutendex.com/books';

export interface GutendexBook {
    id: number;
    title: string;
    authors: { name: string; birth_year: number; death_year: number }[];
    translators: { name: string }[];
    subjects: string[];
    bookshelves: string[];
    languages: string[];
    copyright: boolean;
    media_type: string;
    formats: Record<string, string>;
    download_count: number;
}

interface GutendexResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: GutendexBook[];
}

export async function fetchBooks(query: string = '', page: number = 1): Promise<Book[]> {
    const params = new URLSearchParams({
        languages: 'ru',
        mime_type: 'image', // Ensure books have covers/images if possible, or just standard filter
        page: page.toString(),
    });

    if (query) {
        params.append('search', query);
    }

    try {
        const response = await fetch(`${API_URL}?${params.toString()}`);
        if (!response.ok) {
            throw new Error('Failed to fetch books');
        }

        const data: GutendexResponse = await response.json();

        return data.results.map(transformGutendexToBook);
    } catch (error) {
        console.error('Error fetching books:', error);
        return [];
    }
}

export async function fetchBookContent(url: string): Promise<string> {
    // Use a CORS proxy because Gutendex/Gutenberg might not support direct CORS for text files
    // or to bypass mixed content issues if running on HTTPS
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch book content');
        }
        return await response.text();
    } catch (error) {
        console.error('Error fetching book content:', error);
        return '';
    }
}

function transformGutendexToBook(gBook: GutendexBook): Book {
    // Find cover image (jpeg or png)
    const coverKey = Object.keys(gBook.formats).find(k => k.includes('image/jpeg') || k.includes('image/png'));
    const cover = coverKey ? gBook.formats[coverKey] : 'https://placehold.co/300x450?text=No+Cover';

    // Find plain text content URL
    const textKey = Object.keys(gBook.formats).find(k => k.includes('text/plain') && k.includes('charset=utf-8'));
    const contentUrl = textKey ? gBook.formats[textKey] : undefined;

    // Authors
    const author = gBook.authors.map(a => a.name.split(',').reverse().join(' ').trim()).join(', ') || 'Unknown Author';

    return {
        id: gBook.id.toString(),
        title: gBook.title,
        author: author,
        cover: cover,
        description: gBook.subjects.join(', '), // Use subjects as description
        genre: gBook.bookshelves[0] || 'Classic',
        contentUrl: contentUrl,
        content: [], // Loaded lazily
        pages: 0 // Calculated later
    };
}
