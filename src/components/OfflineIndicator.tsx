import { Download, WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useOffline } from '@/hooks/useOffline';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Explain which features pause offline and offer installation when supported. */
export function OfflineIndicator() {
  const { t } = useTranslation();
  const { isOffline, isOnline } = useOffline();
  const [showOnlineNotification, setShowOnlineNotification] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (isOffline) setWasOffline(true);
    if (isOnline && wasOffline) {
      setShowOnlineNotification(true);
      const timer = setTimeout(() => {
        setShowOnlineNotification(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, isOnline, wasOffline]);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setInstallEvent(null);
  };

  if (!isOffline && !showOnlineNotification) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4">
      {isOffline ? (
        <Alert variant="destructive" className="shadow-lg border-2">
          <WifiOff className="h-4 w-4" />
          <AlertTitle className="font-semibold">{t('offlineTitle')}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="font-medium">{t('offlineDescription')}</p>
            {installEvent && (
              <button
                onClick={handleInstall}
                className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                <Download className="h-3.5 w-3.5" />
                {t('offlineInstallHint')}
              </button>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="shadow-lg border-2 border-green-500 bg-green-50 dark:bg-green-950">
          <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="font-medium text-green-600 dark:text-green-400">
            {t('backOnline')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
