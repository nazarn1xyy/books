import type { RefObject } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { VisibleRange } from '../model/useReadingPosition';
import { useReaderSettings } from '../model/useReaderSettings';

interface ReaderScrollViewProps {
  paragraphs: string[];
  textOf(index: number, original: string): string;
  activeParagraph: number | null;
  virtuosoRef: RefObject<VirtuosoHandle | null>;
  onRangeChanged(range: VisibleRange): void;
}

const ScrollFooter = () => <div className="h-48" />;

/** Continuous (virtualized) reading mode. */
export function ReaderScrollView({ paragraphs, textOf, activeParagraph, virtuosoRef, onRangeChanged }: ReaderScrollViewProps) {
  const fontSize = useReaderSettings((s) => s.fontSize);
  return (
    <Virtuoso
      ref={virtuosoRef}
      style={{ height: '100%' }}
      data={paragraphs}
      rangeChanged={onRangeChanged}
      itemContent={(index, para) => (
        <div
          className={`px-5 sm:px-8 py-2 leading-relaxed font-serif max-w-[68ch] mx-auto transition-colors duration-200 ${
            index === activeParagraph ? 'bg-yellow-500/20 dark:bg-yellow-500/10 -mx-2 px-7 sm:px-10 rounded-lg' : ''
          }`}
          style={{ fontSize: `${fontSize}px`, color: 'var(--reader-text)' }}
        >
          <p>{textOf(index, para)}</p>
        </div>
      )}
      components={{ Footer: ScrollFooter }}
    />
  );
}
