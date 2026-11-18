import { useCallback, useEffect, useState } from 'react';
import type { Book } from '@/entities/book/model/types';
import { addBookmark, addQuote } from '@/shared/storage/collections';
import { useLanguage } from '@/shared/i18n/LanguageContext';

const MIN_QUOTE_LENGTH = 10;

/** Text selection → quote menu (save as quote), plus bookmarking the current paragraph. */
export function useQuoteSelection(book: Book | null, onToast: (message: string) => void) {
  const { t } = useLanguage();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';
    if (text.length < MIN_QUOTE_LENGTH) {
      setMenuVisible(false);
      return;
    }
    if (!selection || selection.rangeCount === 0) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setSelectedText(text);
    setMenuPosition({ x: Math.max(10, Math.min(rect.left, window.innerWidth - 200)), y: rect.bottom + 10 });
    setMenuVisible(true);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('touchend', handleTextSelection);
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
      document.removeEventListener('touchend', handleTextSelection);
    };
  }, [handleTextSelection]);

  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  const saveQuote = async () => {
    if (!book || !selectedText.trim()) return;
    try {
      await addQuote({ book_id: book.id, book_title: book.title, book_author: book.author, text: selectedText.trim() });
      closeMenu();
      onToast(t('reader.quoteSaved'));
    } catch {
      onToast(t('reader.quoteFailed'));
    }
  };

  const bookmarkParagraph = async (paragraphIndex: number, paragraphText: string | undefined) => {
    if (!book || book.format === 'pdf') return;
    try {
      await addBookmark({
        book_id: book.id,
        book_title: book.title,
        paragraph_index: paragraphIndex,
        preview_text: paragraphText?.slice(0, 100) || '',
      });
      onToast(t('reader.bookmarkAdded'));
    } catch {
      onToast(t('reader.bookmarkFailed'));
    }
  };

  return { menuVisible, menuPosition, selectedText, saveQuote, closeMenu, bookmarkParagraph };
}
