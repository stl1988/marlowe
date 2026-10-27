import { useCallback, useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { applySWUpdate, getPendingSWUpdate, onSWUpdate, type PendingSWUpdate } from '@/lib/registerSW';
import { checkForNewerVersion } from '@/lib/versionCheck';

/** Prompt for a downloaded app update; never replace a working app on a failed check. */
export function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [waitingUpdate, setWaitingUpdate] = useState<PendingSWUpdate | null>(getPendingSWUpdate());

  useEffect(() => onSWUpdate((update) => {
    setWaitingUpdate(update);
    setShowPrompt(true);
  }), []);

  const runVersionCheck = useCallback(async () => {
    const result = await checkForNewerVersion();
    if (result.updateAvailable && result.remote) {
      setRemoteVersion(result.remote.version);
      setShowPrompt(true);
    }
    return result.updateAvailable;
  }, []);

  useEffect(() => {
    void runVersionCheck();
    const intervalId = setInterval(() => void runVersionCheck(), 10 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [runVersionCheck]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    const knownWaiting = waitingUpdate?.waiting ?? getPendingSWUpdate()?.waiting ?? null;
    if (knownWaiting) {
      applySWUpdate(knownWaiting);
      return;
    }

    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      await registration?.update();
      const waiting = registration?.waiting ?? getPendingSWUpdate()?.waiting ?? null;
      if (waiting) {
        // Pass the worker explicitly to avoid the updatefound storage race.
        applySWUpdate(waiting);
        return;
      }
    } catch (error) {
      console.warn('[PWA] Update fetch failed, reloading anyway (cache fallback):', error);
    }

    // A version-only update does not change sw.js bytes. Network-first reload
    // gets the new HTML/bundles; offline, the cached app remains available.
    window.location.reload();
  };

  const handleUpdateClick = () => {
    void handleUpdate().catch((error) => {
      console.warn('[PWA] Update could not be applied; keeping the installed version:', error);
      setIsUpdating(false);
      setShowPrompt(false);
    });
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:bottom-auto md:left-auto md:translate-x-0 z-50 animate-in slide-in-from-bottom-4 md:slide-in-from-top-4 duration-500 max-w-full">
      <div className="relative group">
        <button
          onClick={handleUpdateClick}
          disabled={isUpdating}
          className={`relative flex items-center gap-2 px-4 py-2.5 ${!isUpdating ? 'pr-10' : ''} bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900 dark:to-yellow-900 border border-amber-300 dark:border-amber-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100 max-w-full truncate`}
        >
          <Sparkles className={`h-4 w-4 text-amber-600 dark:text-amber-400 ${isUpdating ? 'animate-spin' : 'group-hover:rotate-12 transition-transform duration-300'}`} />
          <span className="text-sm font-medium whitespace-nowrap max-w-full truncate text-amber-900 dark:text-amber-100">
            {isUpdating
              ? t('pwaUpdating')
              : remoteVersion
                ? t('pwaUpdateAvailableVersion', { version: remoteVersion })
                : t('pwaUpdateAvailable')}
          </span>
        </button>
        {!isUpdating && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowPrompt(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors duration-200"
            aria-label={t('pwaDismissUpdate')}
          >
            <X className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          </button>
        )}
      </div>
    </div>
  );
}
