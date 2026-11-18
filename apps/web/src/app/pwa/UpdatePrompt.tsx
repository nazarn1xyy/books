import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLanguage } from '@/shared/i18n/LanguageContext';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Offers to reload when a new service worker is waiting (registerType: 'prompt'). */
export function UpdatePrompt() {
  const { t } = useLanguage();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] lg:bottom-6 lg:left-auto lg:right-6 lg:w-96 z-50 rounded-2xl bg-[#1C1C1E] border border-white/10 p-4 shadow-2xl flex items-center gap-3"
    >
      <p className="flex-1 text-sm text-white">{t('pwa.updateAvailable')}</p>
      <button type="button" className="text-sm text-neutral-400 px-2 py-1" onClick={() => setNeedRefresh(false)}>
        {t('pwa.later')}
      </button>
      <button
        type="button"
        className="text-sm font-semibold bg-white text-black rounded-lg px-3 py-1.5"
        onClick={() => void updateServiceWorker(true)}
      >
        {t('pwa.reload')}
      </button>
    </div>
  );
}
