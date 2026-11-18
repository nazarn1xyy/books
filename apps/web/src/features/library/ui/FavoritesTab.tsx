import { Heart, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Favorite } from '@/entities/book/model/types';
import { ImageWithLoader } from '@/entities/book/ui/ImageWithLoader';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { TabSpinner } from './TabSpinner';

export function FavoritesTab({ favorites, loading, onRemove }: { favorites: Favorite[]; loading: boolean; onRemove: (bookId: string) => void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (loading) return <TabSpinner />;
  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Heart size={48} className="text-gray-600 mb-4" />
        <p className="text-gray-500 text-center">{t('myBooks.noBooks')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-all"
          onClick={() => navigate(`/reader/${fav.book_id}`)}
        >
          <div className="flex items-center gap-4 min-w-0">
            <ImageWithLoader
              src={fav.book_cover}
              alt={fav.book_title}
              fallbackTitle={fav.book_title}
              fallbackAuthor={fav.book_author}
              size="sm"
              className="w-12 h-16 rounded-lg object-cover flex-shrink-0"
              wrapperClassName="w-12 h-16 rounded-lg flex-shrink-0 bg-[#2C2C2E]"
            />
            <div className="min-w-0">
              <h3 className="text-white font-semibold text-sm truncate">{fav.book_title}</h3>
              <p className="text-gray-400 text-xs truncate mt-0.5">{fav.book_author}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(fav.book_id);
            }}
            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            aria-label={t('aria.removeFavorite')}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
