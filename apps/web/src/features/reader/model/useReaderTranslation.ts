import { useState } from 'react';
import type { TranslationLanguage } from '@/shared/lib/translationService';
import type { VisibleRange } from './useReadingPosition';

/** Paragraphs around the visible range that get translated (the whole book would be too slow). */
const TRANSLATE_BUFFER = 100;

/** Translates the paragraphs around the visible range; `translated[i]` is '' where not translated. */
export function useReaderTranslation(paragraphs: string[]) {
  const [translatedParagraphs, setTranslatedParagraphs] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationLang, setTranslationLang] = useState<TranslationLanguage | null>(null);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });

  /** Resolves false when translation failed (the language is reset). */
  const translate = async (code: TranslationLanguage, range: VisibleRange): Promise<boolean> => {
    setIsTranslating(true);
    setTranslationLang(code);
    try {
      const winStart = Math.max(0, range.startIndex - TRANSLATE_BUFFER);
      const winEnd = Math.min(paragraphs.length, range.endIndex + TRANSLATE_BUFFER);
      const { translateParagraphs } = await import('@/shared/lib/translationService');
      const translated = await translateParagraphs(paragraphs.slice(winStart, winEnd), code, (current, total) =>
        setTranslationProgress({ current, total }),
      );
      const full = new Array<string>(paragraphs.length).fill('');
      translated.forEach((text, i) => {
        full[winStart + i] = text;
      });
      setTranslatedParagraphs(full);
      return true;
    } catch {
      setTranslationLang(null);
      return false;
    } finally {
      setIsTranslating(false);
    }
  };

  const disable = () => {
    setTranslationLang(null);
    setTranslatedParagraphs([]);
  };

  /** Translated text of a paragraph, or the original. */
  const textOf = (index: number, original: string) => translatedParagraphs[index] || original;

  return { translatedParagraphs, isTranslating, translationLang, translationProgress, translate, disable, textOf };
}
