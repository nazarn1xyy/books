import { useEffect, useMemo, useState } from 'react';
import type { Book, Chapter } from '@/entities/book/model/types';
import { fetchBookContent } from '@/shared/catalog/flibustaApi';
import { addToMyBooks, getBookMetadata } from '@/shared/storage/storage';

interface BookContent {
  book: Book | null;
  fullText: string;
  pdfData: ArrayBuffer | null;
  chapters: Chapter[];
  loading: boolean;
  /** Raw failure reason; the page adds the localized prefix. */
  error: string | null;
}

const INITIAL: BookContent = { book: null, fullText: '', pdfData: null, chapters: [], loading: true, error: null };

/** Loads a book (cache first, then the catalog), merges its metadata and adds it to My Books. */
export function useBookContent(id: string | undefined) {
  const [content, setContent] = useState<BookContent>(INITIAL);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { text, cover, pdfData, title, author, series, seriesNumber, chapters } = await fetchBookContent(id);
        if (!text && !pdfData) throw new Error('No text content available');

        const existing = getBookMetadata(id);
        const book: Book = existing
          ? {
              ...existing,
              cover: cover || (existing.cover?.includes('placehold.co') ? '' : existing.cover) || '',
              series: series || existing.series,
              seriesNumber: seriesNumber || existing.seriesNumber,
            }
          : {
              id,
              title: title || '',
              author: author || '',
              cover: cover || '',
              description: '',
              genre: '',
              contentUrl: '',
              format: pdfData ? 'pdf' : 'fb2',
              series,
              seriesNumber,
            };

        if (cancelled) return;
        addToMyBooks(book);
        setContent({ book, fullText: text, pdfData: pdfData ?? null, chapters: chapters ?? [], loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setContent({ ...INITIAL, loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const paragraphs = useMemo(() => content.fullText.split('\n\n'), [content.fullText]);
  return { ...content, paragraphs };
}
