import { Download } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import type { ExportProgressState } from '../model/useLibraryExport';

/** Blocking progress panel while the library ZIP is built. */
export function ExportProgress({ progress }: { progress: ExportProgressState }) {
  const { t } = useLanguage();
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div role="status" className="bg-[#1C1C1E] rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <Download className="text-blue-400 animate-bounce" size={24} />
          <h2 className="text-lg font-semibold text-white">{t('myBooks.exportTitle')}</h2>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-xs mb-2">{t('myBooks.exportPacking')}</p>
            <ProgressBar percentage={percentage} height={6} />
          </div>
          <p className="text-gray-500 text-xs truncate">
            {progress.current} / {progress.total}: {progress.bookTitle}
          </p>
        </div>
      </div>
    </div>
  );
}
