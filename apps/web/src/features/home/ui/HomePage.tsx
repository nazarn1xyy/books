import { BookCard } from '@/entities/book/ui/BookCard';
import { useContinueReading } from '@/features/library';
import { useRecommendations } from '@/features/search';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { BookListSkeleton } from '@/shared/ui/Skeleton';
import { InstallBanner } from './InstallBanner';

const ROW = "flex gap-4 overflow-x-auto scrollbar-hide scroll-snap-x -mx-5 px-5 after:content-[''] after:w-4 after:flex-shrink-0 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:overflow-visible";

export function HomePage() {
  const { t } = useLanguage();
  const inProgress = useContinueReading(5);
  const recommendations = useRecommendations();
  const books = recommendations.data ?? [];

  const withCovers = books.filter((book) => book.cover && !book.cover.includes('placehold.co'));
  const recommendedBooks = withCovers.length >= 4 ? withCovers.slice(0, 4) : books.slice(0, 4);
  const recentBooks = books.slice(4, 10);
  // Only the first row on screen competes for bandwidth with high priority.
  const PRIORITY_CARDS = 4;
  const continueIsFirstRow = inProgress.length > 0;

  return (
    <div className="min-h-screen bg-app pb-28 lg:pb-8 pt-[env(safe-area-inset-top)]">
      <div className="sticky top-0 z-30 bg-app/95 backdrop-blur-xl border-b border-fg/5 pt-2 pb-3 px-5 mb-4">
        <div className="desktop-container">
          <h1 className="text-2xl font-bold text-fg lg:text-3xl">{t('home.title')}</h1>
        </div>
      </div>

      <div className="px-5 desktop-container">
        <InstallBanner />

        {inProgress.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-fg mb-4 lg:text-xl">{t('home.continueReading')}</h2>
            <div className={ROW}>
              {inProgress.map((item, index) => (
                <BookCard key={item.book.id} book={item.book} size="medium" showProgress priority={index < PRIORITY_CARDS} />
              ))}
            </div>
          </section>
        )}

        {recommendations.isPending ? (
          <section className="mb-8" aria-busy="true">
            <h2 className="text-lg font-semibold text-fg mb-4 lg:text-xl">{t('home.recommended')}</h2>
            <BookListSkeleton count={4} />
          </section>
        ) : recommendations.isError || books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted mb-4">{t('errors.networkError')}</p>
            <button
              onClick={() => void recommendations.refetch()}
              disabled={recommendations.isFetching}
              className="px-4 py-2 bg-fg/10 rounded-full text-fg text-sm hover:bg-fg/20 transition-colors disabled:opacity-50"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-fg mb-4 lg:text-xl">{t('home.recommended')}</h2>
              <div className={ROW}>
                {recommendedBooks.map((book, index) => (
                  <BookCard key={book.id} book={book} size="large" priority={!continueIsFirstRow && index < PRIORITY_CARDS} showActions />
                ))}
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-fg mb-4 lg:text-xl">{t('home.recentlyAdded')}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {recentBooks.map((book) => (
                  <BookCard key={book.id} book={book} size="small" showActions />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
