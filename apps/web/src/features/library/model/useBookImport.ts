import { useRef, useState, type ChangeEvent } from 'react';
import type { Book } from '@/entities/book/model/types';
import { cacheBook } from '@/shared/catalog/bookCache';
import { parseBookData } from '@/shared/catalog/flibustaApi';
import { addToMyBooks } from '@/shared/storage/storage';

const UNTITLED = ['Без назви', 'Без названия'];

/** Reads a local FB2/ZIP/PDF file, caches its content and adds it to My Books. */
async function importBookFile(file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  const id = `local-${Date.now()}`;
  const fileTitle = file.name.replace(/\.(fb2(\.zip)?|pdf)$/i, '');

  if (file.name.toLowerCase().endsWith('.pdf')) {
    await cacheBook(id, '', '', buffer);
    addToMyBooks({ id, title: fileTitle, author: 'Unknown Author', cover: '', description: '', genre: 'Local', contentUrl: 'local', format: 'pdf' });
    return;
  }

  const parsed = await parseBookData(buffer);
  const parsedTitle = parsed.title;
  const title =
    parsedTitle && parsedTitle.trim() !== '' && !UNTITLED.includes(parsedTitle) ? parsedTitle : fileTitle.replace(/_/g, ' ');
  await cacheBook(id, parsed.text, parsed.cover || '', undefined, {
    title: parsed.title,
    author: parsed.author,
    series: parsed.series,
    seriesNumber: parsed.seriesNumber,
    chapters: parsed.chapters,
  });
  const book: Book = {
    id,
    title,
    author: parsed.author || 'Unknown Author',
    cover: parsed.cover || '',
    description: parsed.description || '',
    genre: 'Local',
    contentUrl: 'local',
    format: 'fb2',
    series: parsed.series,
    seriesNumber: parsed.seriesNumber,
  };
  addToMyBooks(book);
}

/** File input wiring for "add a book from this device". */
export function useBookImport(onError: (message: string) => void, errorMessage: string) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await importBookFile(file);
    } catch {
      onError(errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return { isUploading, fileInputRef, handleFileChange, openPicker: () => fileInputRef.current?.click() };
}
