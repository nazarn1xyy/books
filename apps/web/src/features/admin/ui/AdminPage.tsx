import { Activity, BarChart2, BookOpen, Trophy, UserCheck, Users } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useAdminStats } from '../model/useAdminStats';
import { RegistrationsChart } from './RegistrationsChart';
import { StatCard } from './StatCard';

export function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const stats = useAdminStats(isAdmin);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center flex-col gap-3">
        <p className="text-muted text-lg">403 — Доступ запрещён</p>
        <a href="/" className="text-fg underline text-sm">
          На главную
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app text-fg pb-24 pt-[env(safe-area-inset-top)] overflow-x-hidden">
      <header className="px-5 py-6 sticky top-0 bg-app z-30">
        <h1 className="text-3xl font-bold">Панель</h1>
      </header>

      <main className="px-5 space-y-8">
        {stats.isPending ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-fg"></div>
          </div>
        ) : stats.isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <p className="text-muted">Не удалось загрузить статистику</p>
            <button
              onClick={() => void stats.refetch()}
              className="px-4 py-2 bg-fg/10 rounded-full text-fg text-sm hover:bg-fg/20 transition-colors"
            >
              Повторить
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<Users size={20} className="text-blue-400" />} label="Пользователи" value={String(stats.data.totalUsers)} />
              <StatCard icon={<Activity size={20} className="text-green-400" />} label="Активны за 24 ч" value={String(stats.data.activeUsers24h)} />
              <StatCard icon={<UserCheck size={20} className="text-orange-400" />} label="Активны за 7 дней" value={String(stats.data.activeUsers7d)} />
              <StatCard icon={<BookOpen size={20} className="text-purple-400" />} label="Книг в библиотеках" value={String(stats.data.totalLibraryBooks)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={20} className="text-muted" />
                  <h2 className="text-lg font-bold">Регистрации по дням</h2>
                </div>
                <div className="bg-surface rounded-3xl p-4 h-64 border border-fg/5">
                  <RegistrationsChart data={stats.data.registrationsByDay} />
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy size={20} className="text-muted" />
                  <h2 className="text-lg font-bold">Топ-10 книг</h2>
                </div>
                <div className="bg-surface rounded-3xl border border-fg/5 overflow-hidden">
                  {stats.data.topBooks.length === 0 ? (
                    <p className="p-4 text-sm text-subtle">Пока нет данных</p>
                  ) : (
                    <ol>
                      {stats.data.topBooks.slice(0, 10).map((book, i) => (
                        <li key={book.bookId} className="flex items-center gap-3 px-4 py-3 border-b border-fg/5 last:border-b-0">
                          <span className="w-6 text-right text-xs font-mono text-subtle">{i + 1}</span>
                          <span className="flex-1 min-w-0 truncate text-sm">{book.title}</span>
                          <span className="text-xs text-muted">{book.readers}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
