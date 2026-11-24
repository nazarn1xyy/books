import { Suspense, lazy, useCallback, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { VirtuosoHandle } from 'react-virtuoso';
import { useAuth } from '@/features/auth';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { Toast } from '@/shared/ui/Toast';
import { useToast } from '@/shared/ui/useToast';
import { FONT_FAMILIES } from '../model/fontFamilies';
import { useBookContent } from '../model/useBookContent';
import { usePagination } from '../model/usePagination';
import { useQuoteSelection } from '../model/useQuoteSelection';
import { useReaderSettings } from '../model/useReaderSettings';
import { useReadingPosition } from '../model/useReadingPosition';
import { QuoteMenu } from './QuoteMenu';
import { ReaderFooter } from './ReaderFooter';
import { ReaderHeader } from './ReaderHeader';
import { ReaderPagedView } from './ReaderPagedView';
import { ReaderScrollView } from './ReaderScrollView';
import { ReaderStatus } from './ReaderStatus';
import { getBookMetadata } from '@/shared/storage/storage';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import { ReaderTocDrawer } from './ReaderTocDrawer';
import { useHotkey } from '@/shared/lib/hooks/useHotkey';

// Lazy-load PDF Viewer to prevent 500KB+ pdfjs bundle from loading for FB2 books
const ReaderPdfViewer = lazy(() => import('./ReaderPdfViewer'));

function ReaderSpinner() {
  return <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[var(--reader-text)]"></div>;
}

export function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast(2500);
  const goBack = useCallback(() => navigate(-1), [navigate]);

  const theme = useReaderSettings((s) => s.theme);
  const fontFamily = useReaderSettings((s) => s.fontFamily);
  const brightness = useReaderSettings((s) => s.brightness);
  const readerMode = useReaderSettings((s) => s.readerMode);

  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const { book, fullText, paragraphs, pdfData, chapters, loading, error, retry } = useBookContent(id);
  const isPdf = book?.format === 'pdf';
  const position = useReadingPosition({
    bookId: id,
    total: isPdf ? numPages : paragraphs.length,
    isPdf,
    bookmarkParagraph: searchParams.get('p'),
    virtuosoRef,
  });
  const pagination = usePagination({
    bookId: id,
    paragraphs,
    initialParagraph: position.initialIndex,
    // Sheets handle their own keys (Escape closes them); page keys must not also fire behind them.
    keyboardEnabled: readerMode === 'page' && !showSettings && !showToc,
    onEscape: goBack,
  });
  const quotes = useQuoteSelection(book, toast.show);
  // Scroll mode: Escape closes the quote menu first, otherwise leaves the reader
  // (page mode handles it in usePagination).
  useHotkey(
    'Escape',
    () => (quotes.menuVisible ? quotes.closeMenu() : goBack()),
    readerMode !== 'page' && !showSettings && !showToc,
  );

  if (loading || error || !book) {
    const known = book ?? (id ? getBookMetadata(id) : undefined);
    return <ReaderStatus book={known} onBack={goBack} error={loading ? null : (error ?? 'not found')} onRetry={retry} />;
  }

  return (
    <div
      className={`fixed inset-0 flex flex-col theme-${theme} transition-colors duration-300`}
      style={{ backgroundColor: 'var(--reader-bg)', color: 'var(--reader-text)', fontFamily: FONT_FAMILIES[fontFamily] }}
    >
      {/* GPU overlay for brightness (no CPU filter recalculation on scroll) */}
      {brightness < 100 && (
        <div
          className="pointer-events-none fixed inset-0 z-40 bg-black transition-opacity duration-150"
          style={{ opacity: (100 - brightness) / 100 }}
          aria-hidden="true"
        />
      )}

      <ReaderHeader
        book={book}
        numPages={numPages}
        displayPageNumber={position.displayPageNumber}
        user={user}
        chaptersLength={chapters.length}
        onBack={goBack}
        onAddBookmark={() => {
          const index = position.visibleRange.startIndex;
          void quotes.bookmarkParagraph(index, paragraphs[index]);
        }}
        onOpenToc={() => setShowToc(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="flex-1 relative overflow-hidden" style={{ backgroundColor: 'var(--reader-bg)' }}>
        {isPdf && pdfData ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-[var(--reader-text)]">
                <ReaderSpinner />
              </div>
            }
          >
            <ReaderPdfViewer
              pdfData={pdfData}
              numPages={numPages}
              setNumPages={setNumPages}
              virtuosoRef={virtuosoRef}
              onRangeChanged={position.handleRangeChanged}
            />
          </Suspense>
        ) : fullText && paragraphs.length > 0 ? (
          readerMode === 'page' ? (
            <ReaderPagedView
              pageParagraphs={pagination.currentPageParagraphs}
              pageIndex={pagination.currentPageIndex}
              totalPages={pagination.totalFlipPages}
              onPrev={pagination.goToPrevPage}
              onNext={pagination.goToNextPage}
            />
          ) : (
            <ReaderScrollView
              paragraphs={paragraphs}
              virtuosoRef={virtuosoRef}
              initialIndex={position.initialIndex}
              onRangeChanged={position.handleRangeChanged}
            />
          )
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 p-8 text-center">{t('errors.bookNotFound')}</div>
        )}
      </main>

      <ReaderFooter scrollProgress={position.scrollProgress} />

      <ReaderSettingsSheet
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isPdf={isPdf}
        onReaderModeChange={(mode) => {
          if (mode === 'page') pagination.showParagraph(position.visibleRange.startIndex);
        }}
      />

      <ReaderTocDrawer
        isOpen={showToc}
        onClose={() => setShowToc(false)}
        chapters={chapters}
        currentParagraphIndex={position.visibleRange.startIndex}
        onSelectChapter={(paragraphIndex) => virtuosoRef.current?.scrollToIndex({ index: paragraphIndex, align: 'start' })}
      />

      {user && (
        <QuoteMenu
          isVisible={quotes.menuVisible}
          position={quotes.menuPosition}
          selectedText={quotes.selectedText}
          onSave={quotes.saveQuote}
          onClose={quotes.closeMenu}
        />
      )}

      <Toast
        message={toast.message}
        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-[#2C2C2E] text-white text-sm font-medium rounded-xl shadow-xl border border-white/10 pointer-events-none w-max max-w-[calc(100vw-2rem)] text-center toast-enter"
      />
    </div>
  );
}
