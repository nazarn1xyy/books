import { useState } from 'react';
import { removeFromMyBooks } from '@/shared/storage/storage';
import { deleteBookmark, deleteQuote, removeFavorite } from '@/shared/storage/collections';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useConfirm } from '@/shared/ui/useConfirm';
import { useBookImport } from '../model/useBookImport';
import { useCollections } from '../model/useCollections';
import { useLibrary } from '../model/useLibrary';
import { useLibraryExport } from '../model/useLibraryExport';
import { useLibraryGrouping, type LibrarySort } from '../model/useLibraryGrouping';
import { BookmarksTab } from './BookmarksTab';
import { ExportProgress } from './ExportProgress';
import { FavoritesTab } from './FavoritesTab';
import { LibraryTab } from './LibraryTab';
import { MyBooksHeader, type MyBooksTab } from './MyBooksHeader';
import { QuotesTab } from './QuotesTab';
import { UploadButton } from './UploadButton';

export function MyBooksPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<MyBooksTab>('books');
  const [sortBy, setSortBy] = useState<LibrarySort>('date');
  const [notice, setNotice] = useState<string | null>(null);

  const library = useLibrary();
  const entries = useLibraryGrouping(library, sortBy);
  const { favorites, quotes, bookmarks, loading } = useCollections();
  const upload = useBookImport(setNotice, t('errors.networkError'));
  const exporter = useLibraryExport(setNotice);
  const { confirm, dialogProps } = useConfirm();

  /** Asks first; failures are ignored (the replica keeps the item, the list stays truthful). */
  const confirmThen = async (question: string, action: () => unknown) => {
    if (!(await confirm(question))) return;
    try {
      await action();
    } catch {
      // Ignore: nothing was removed.
    }
  };

  const handleExport = () => {
    if (library.length === 0) {
      setNotice(t('myBooks.noBooks'));
      return;
    }
    void exporter.exportBooks(
      library.map((i) => i.book.id),
      t('common.error'),
    );
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-app pt-[env(safe-area-inset-top)] overflow-hidden relative">
      <MyBooksHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{ books: library.length, favorites: favorites.length, quotes: quotes.length }}
        entryCount={entries.length}
        sortBy={sortBy}
        onSortChange={setSortBy}
        isExporting={exporter.isExporting}
        onExport={handleExport}
      />

      <div className="flex-1 px-5 pt-4 pb-28 overflow-y-auto overflow-x-hidden touch-pan-y desktop-container" style={{ WebkitOverflowScrolling: 'touch' }}>
        {exporter.isExporting && <ExportProgress progress={exporter.progress} />}

        <div id={`panel-${activeTab}`} role="tabpanel">
          {activeTab === 'books' && (
            <LibraryTab entries={entries} onRemove={(id) => void confirmThen(t('common.delete') + '?', () => removeFromMyBooks(id))} />
          )}
          {activeTab === 'favorites' && (
            <FavoritesTab
              favorites={favorites}
              loading={loading}
              onRemove={(bookId) => void confirmThen(t('aria.removeFavorite') + '?', () => removeFavorite(bookId))}
            />
          )}
          {activeTab === 'quotes' && (
            <QuotesTab quotes={quotes} loading={loading} onDelete={(id) => void confirmThen(t('aria.deleteQuote') + '?', () => deleteQuote(id))} />
          )}
          {activeTab === 'bookmarks' && (
            <BookmarksTab
              bookmarks={bookmarks}
              loading={loading}
              onDelete={(id) => void confirmThen(t('aria.deleteBookmark') + '?', () => deleteBookmark(id))}
            />
          )}
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />

      {notice && (
        <div
          onClick={() => setNotice(null)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+8rem)] left-4 right-4 z-30 bg-red-500/90 text-white text-sm font-medium rounded-xl px-4 py-3 shadow-xl cursor-pointer text-center"
        >
          {notice}
        </div>
      )}

      <UploadButton
        isUploading={upload.isUploading}
        fileInputRef={upload.fileInputRef}
        onFileChange={upload.handleFileChange}
        onOpenPicker={upload.openPicker}
      />
    </div>
  );
}
