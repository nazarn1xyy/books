import { Bookmark as BookmarkIcon, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Bookmark } from '@/entities/book/model/types';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { TabSpinner } from './TabSpinner';

export function BookmarksTab({ bookmarks, loading, onDelete }: { bookmarks: Bookmark[]; loading: boolean; onDelete: (id: string) => void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (loading) return <TabSpinner />;
  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BookmarkIcon size={48} className="text-gray-600 mb-4" />
        <p className="text-gray-500 text-center">{t('myBooks.noBookmarks')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookmarks.map((bm) => (
        <div key={bm.id} className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4">
          <div className="cursor-pointer" onClick={() => navigate(`/reader/${bm.book_id}?p=${bm.paragraph_index}`)}>
            <h3 className="text-white font-medium text-sm mb-1">{bm.book_title || t('myBooks.books')}</h3>
            <p className="text-gray-400 text-xs line-clamp-2 italic">"{bm.preview_text || '...'}"</p>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-gray-500 text-xs">{t('myBooks.paragraph', { index: bm.paragraph_index + 1 })}</span>
            <button
              onClick={() => onDelete(bm.id)}
              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              aria-label={t('aria.deleteBookmark')}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
