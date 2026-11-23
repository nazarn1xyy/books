import { Link, useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { BookCard } from '@/entities/book/ui/BookCard';
import { useContinueReading } from '@/features/library';
import { useRecommendations } from '@/features/search';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { useHotkey } from '@/shared/lib/hooks/useHotkey';
import { BookGrid } from '@/shared/ui/BookGrid';
import { BookListSkeleton } from '@/shared/ui/Skeleton';
import { ContinueHero } from './ContinueHero';
import { InstallBanner } from './InstallBanner';

const ROW = "flex gap-4 overflow-x-auto scrollbar-hide scroll-snap-x -mx-5 px-5 pt-1 pb-3 after:content-[''] after:w-4 after:flex-shrink-0";
const SECTION_TITLE = 'section-title mb-4';
const RECOMMENDED = 12;
/** Only the first covers on screen compete for bandwidth with high priority. */
const PRIORITY_CARDS = 6;

export function HomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  // "/" jumps to search, like on most catalogue sites.
  useHotkey('/', (e) => {
    e.preventDefault();
    void navigate('/search');
  });
  const inProgress = useContinueReading(8);
  const recommendations = useRecommendations();
  const books = recommendations.data ?? [];
  const [current, ...alsoReading] = inProgress;

  const withCovers = books.filter((book) => book.cover && !book.cover.includes('placehold.co'));
  const recommended = (withCovers.length >= 4 ? withCovers : books).slice(0, RECOMMENDED);

  return (
    <div className="min-h-screen bg-app pb-tabbar pt-statusbar">
      <div className="sticky top-0 z-30 bg-app/85 backdrop-blur-xl pt-3 pb-3 px-5">
        <div className="desktop-container">
          <h1 className="page-title">{t('home.title')}</h1>
        </div>
      </div>

      <div className="px-5 desktop-container space-y-10">
        <InstallBanner />

        {current ? (
          <ContinueHero book={current.book} progress={current.progress} />
        ) : (
          <div className="flex items-center gap-4 rounded-[28px] border border-dashed border-line px-5 py-6">
            <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-fg/10 text-fg">
              <BookOpen size={22} aria-hidden="true" />
            </div>
            <p className="flex-1 text-sm text-muted">{t('home.nothingStarted')}</p>
            <Link to="/search" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
              {t('home.findBook')}
            </Link>
          </div>
        )}

        {alsoReading.length > 0 && (
          <section aria-labelledby="also-reading">
            <h2 id="also-reading" className={SECTION_TITLE}>{t('home.alsoReading')}</h2>
            <div className={ROW}>
              {alsoReading.map((item) => (
                <BookCard key={item.book.id} book={item.book} size="medium" showProgress />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="recommended" aria-busy={recommendations.isPending}>
          <h2 id="recommended" className={SECTION_TITLE}>{t('home.recommended')}</h2>
          {recommendations.isPending ? (
            <BookListSkeleton count={6} />
          ) : recommendations.isError || books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
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
            <BookGrid>
              {recommended.map((book, index) => (
                <BookCard key={book.id} book={book} size="small" priority={!current && index < PRIORITY_CARDS} showActions />
              ))}
            </BookGrid>
          )}
        </section>
      </div>
    </div>
  );
}
