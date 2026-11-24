import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { VisibleRange } from '../model/useReadingPosition';
import { useReaderSettings } from '../model/useReaderSettings';

interface ReaderScrollViewProps {
  paragraphs: string[];
  virtuosoRef: RefObject<VirtuosoHandle | null>;
  /** Paragraph to open at (restored reading position). */
  initialIndex: number;
  /** How far into that paragraph (0..1) the screen top was: restores the exact line. */
  initialOffset: number;
  onRangeChanged(range: VisibleRange): void;
  /** The paragraph at the top of the screen and how far into it (0..1) the reader has scrolled. */
  onLinePosition(index: number, offset: number): void;
}

const ScrollFooter = () => <div className="h-48" />;

/** The rendered paragraph crossing the scroller's top edge, and the fraction of it above that edge. */
function topLine(scroller: HTMLElement): { index: number; offset: number; el: HTMLElement } | null {
  const top = scroller.getBoundingClientRect().top;
  for (const el of scroller.querySelectorAll<HTMLElement>('[data-index]')) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom > top + 1) {
      const offset = rect.height > 0 ? Math.min(1, Math.max(0, (top - rect.top) / rect.height)) : 0;
      return { index: Number(el.dataset.index), offset, el };
    }
  }
  return null;
}

/** Continuous (virtualized) reading mode. */
export function ReaderScrollView({ paragraphs, virtuosoRef, initialIndex, initialOffset, onRangeChanged, onLinePosition }: ReaderScrollViewProps) {
  const fontSize = useReaderSettings((s) => s.fontSize);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const restoring = useRef(initialOffset > 0);
  const frame = useRef(0);
  const reportRef = useRef(onLinePosition);
  useEffect(() => {
    reportRef.current = onLinePosition;
  }, [onLinePosition]);

  const report = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller || restoring.current) return;
      const line = topLine(scroller);
      if (line) reportRef.current(line.index, line.offset);
    });
  }, []);

  // Virtuoso opens at the start of the paragraph; then move into it by the saved fraction, measured
  // on the real rendered height, so the same line is on top even after a font size change.
  useEffect(() => {
    if (!restoring.current) return;
    let tries = 0;
    let timer = 0;
    const apply = () => {
      const scroller = scrollerRef.current;
      const el = scroller?.querySelector<HTMLElement>(`[data-index="${initialIndex}"]`);
      if (!scroller || !el) {
        if (++tries < 20) timer = window.setTimeout(apply, 50);
        else restoring.current = false;
        return;
      }
      const delta = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + initialOffset * el.offsetHeight;
      scroller.scrollTop += delta;
      restoring.current = false;
    };
    timer = window.setTimeout(apply, 0);
    return () => window.clearTimeout(timer);
  }, [initialIndex, initialOffset]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const setScroller = useCallback(
    (el: HTMLElement | Window | null) => {
      scrollerRef.current?.removeEventListener('scroll', report);
      scrollerRef.current = el instanceof HTMLElement ? el : null;
      scrollerRef.current?.addEventListener('scroll', report, { passive: true });
    },
    [report],
  );

  return (
    <Virtuoso
      ref={virtuosoRef}
      scrollerRef={setScroller}
      style={{ height: '100%' }}
      data={paragraphs}
      initialTopMostItemIndex={initialIndex}
      rangeChanged={onRangeChanged}
      itemContent={(_index, para) => (
        <div
          className="px-5 sm:px-8 py-2 leading-relaxed max-w-[68ch] mx-auto"
          style={{ fontSize: `${fontSize}px`, color: 'var(--reader-text)' }}
        >
          <p>{para}</p>
        </div>
      )}
      components={{ Footer: ScrollFooter }}
    />
  );
}
