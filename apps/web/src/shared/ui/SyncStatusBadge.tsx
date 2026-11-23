import { useSyncExternalStore } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { services } from '@/shared/services';
import { useLanguage } from '@/shared/i18n/LanguageContext';

const subscribe = (onChange: () => void) => services().sync.onStatusChange(onChange);
const getStatus = () => services().sync.getStatus();

/** Small "offline / syncing" indicator; renders nothing while sync is idle. */
export function SyncStatusBadge({ className = '' }: { className?: string }) {
  const { t } = useLanguage();
  const status = useSyncExternalStore(subscribe, getStatus);
  if (status === 'idle') return null;
  const offline = status === 'offline' || status === 'error';
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`}>
      {offline ? (
        <CloudOff size={14} aria-hidden="true" />
      ) : (
        <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
      )}
      {offline ? t('sync.offline') : t('sync.syncing')}
    </span>
  );
}
