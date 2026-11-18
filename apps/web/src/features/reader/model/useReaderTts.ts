import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import { useTextToSpeech } from '@/shared/lib/hooks/useTextToSpeech';

interface Options {
  paragraphs: string[];
  /** First visible paragraph: where playback starts. */
  startIndex: number;
  virtuosoRef: RefObject<VirtuosoHandle | null>;
}

/** Read-aloud: speaks paragraph by paragraph, follows along in the scroll view, rate and prev/next. */
export function useReaderTts({ paragraphs, startIndex, virtuosoRef }: Options) {
  const { speak, pause, resume, cancel, isSpeaking, isPaused } = useTextToSpeech();
  const [activeParagraph, setActiveParagraph] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [showControls, setShowControls] = useState(false);

  /** Nearest paragraph with text from `from` in direction `step`; null past either end. */
  const findSpeakable = useCallback(
    (from: number, step: 1 | -1): number | null => {
      for (let i = from; i >= 0 && i < paragraphs.length; i += step) {
        if (paragraphs[i]?.trim()) return i;
      }
      return null;
    },
    [paragraphs],
  );

  const speakParagraph = useCallback(
    (index: number) => {
      const text = paragraphs[index];
      if (!text) return;
      speak(text, { rate }, () => {
        setActiveParagraph((prev) => (prev === index ? findSpeakable(index + 1, 1) : prev));
      });
    },
    [paragraphs, speak, rate, findSpeakable],
  );

  useEffect(() => {
    if (activeParagraph === null || isPaused || isSpeaking) return;
    speakParagraph(activeParagraph);
    virtuosoRef.current?.scrollIntoView({ index: activeParagraph, behavior: 'smooth', align: 'center' });
  }, [activeParagraph, speakParagraph, isPaused, isSpeaking, virtuosoRef]);

  const togglePlay = () => {
    if (isPaused) {
      resume();
    } else if (isSpeaking) {
      pause();
    } else {
      setActiveParagraph(findSpeakable(startIndex, 1));
      setShowControls(true);
    }
  };

  const next = () => {
    cancel();
    setActiveParagraph((prev) => (prev === null ? prev : (findSpeakable(prev + 1, 1) ?? prev)));
  };

  const prev = () => {
    cancel();
    setActiveParagraph((p) => (p === null ? p : (findSpeakable(p - 1, -1) ?? p)));
  };

  const cycleRate = () => setRate((r) => (r >= 2 ? 0.75 : r + 0.25));

  return {
    activeParagraph,
    rate,
    showControls,
    hideControls: () => setShowControls(false),
    isSpeaking,
    isPaused,
    togglePlay,
    next,
    prev,
    cycleRate,
  };
}
