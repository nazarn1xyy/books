import { Heart, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Favorite } from '@/entities/book/model/types';
import { BookCover } from '@/entities/book/ui/BookCover';
import { EmptyState } from '@/shared/ui/EmptyState';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { TabSpinner } from './TabSpinner';

export function FavoritesTab({ favorites, loading, onRemove }: { favorites: Favorite[]; loading: boolean; onRemove: (bookId: string) => void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (loading) return <TabSpinner />;
  if (favorites.length === 0) {
    return (
      <EmptyState icon={Heart} text={t('myBooks.noBooks')} action={{ label: t('empty.findBook'), to: '/search' }} />
    );
  }

  return (
    <div className="space-y-4">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="bg-surface border border-fg/5 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-all"
          onClick={() => navigate(`/reader/${fav.book_id}`)}
        >
          <div className="flex items-center gap-4 min-w-0">
            <BookCover
              book={{ id: fav.book_id, title: fav.book_title ?? '', author: fav.book_author ?? '', cover: fav.book_cover ?? '' }}
              size="sm"
              lift={false}
              className="w-12 flex-shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-fg font-semibold text-sm truncate">{fav.book_title}</h2>
              <p className="text-muted text-xs truncate mt-0.5">{fav.book_author}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(fav.book_id);
            }}
            className="p-2 text-subtle hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            aria-label={t('aria.removeFavorite')}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
