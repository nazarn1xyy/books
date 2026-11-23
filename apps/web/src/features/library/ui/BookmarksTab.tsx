import { Bookmark as BookmarkIcon, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Bookmark } from '@/entities/book/model/types';
import { EmptyState } from '@/shared/ui/EmptyState';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { TabSpinner } from './TabSpinner';

export function BookmarksTab({ bookmarks, loading, onDelete }: { bookmarks: Bookmark[]; loading: boolean; onDelete: (id: string) => void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (loading) return <TabSpinner />;
  if (bookmarks.length === 0) {
    return (
      <EmptyState icon={BookmarkIcon} text={t('myBooks.noBookmarks')} />
    );
  }

  return (
    <div className="space-y-4">
      {bookmarks.map((bm) => (
        <div key={bm.id} className="bg-surface border border-fg/5 rounded-2xl p-4">
          <div className="cursor-pointer" onClick={() => navigate(`/reader/${bm.book_id}?p=${bm.paragraph_index}`)}>
            <h2 className="text-fg font-medium text-sm mb-1">{bm.book_title || t('myBooks.books')}</h2>
            <p className="text-muted text-xs line-clamp-2 italic">"{bm.preview_text || '...'}"</p>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-subtle text-xs">{t('myBooks.paragraph', { index: bm.paragraph_index + 1 })}</span>
            <button
              onClick={() => onDelete(bm.id)}
              className="p-2 text-subtle hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
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
