import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { useInstallPrompt } from '@/shared/lib/hooks/useInstallPrompt';
import { useLanguage } from '@/shared/i18n/LanguageContext';

/** "Install the app" banner, shown while the browser offers PWA installation. */
export function InstallBanner() {
  const { t } = useLanguage();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  if (!canInstall || dismissed) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl bg-surface p-4 banner-enter">
      <Download className="text-fg flex-shrink-0 mt-0.5" size={24} aria-hidden="true" />
      <div className="flex-1">
        <h3 className="text-fg font-semibold mb-1">{t('home.installTitle')}</h3>
        <p className="text-muted text-sm mb-3">{t('home.installDesc')}</p>
        <button
          onClick={async () => {
            if (await promptInstall()) setDismissed(true);
          }}
          className="px-4 py-2 bg-accent text-on-accent hover:opacity-90 active:scale-[0.97] rounded-full text-sm font-medium transition"
        >
          {t('home.install')}
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted hover:text-fg transition-colors p-1 active:scale-95"
        aria-label={t('common.cancel')}
      >
        <X size={20} />
      </button>
    </div>
  );
}
