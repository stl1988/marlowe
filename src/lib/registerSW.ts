export interface PendingSWUpdate {
  registration: ServiceWorkerRegistration;
  waiting: ServiceWorker;
}

type UpdateListener = (update: PendingSWUpdate) => void;

const listeners = new Set<UpdateListener>();
let pendingUpdate: PendingSWUpdate | null = null;
let reloadOnControllerChange = false;

/** Subscribe to fully downloaded service-worker updates. */
export function onSWUpdate(listener: UpdateListener): () => void {
  listeners.add(listener);
  if (pendingUpdate) listener(pendingUpdate);
  return () => {
    listeners.delete(listener);
  };
}

export function getPendingSWUpdate(): PendingSWUpdate | null {
  return pendingUpdate;
}

/** Activate a downloaded update only after explicit user confirmation. */
export function applySWUpdate(worker?: ServiceWorker): void {
  const waiting = worker ?? pendingUpdate?.waiting;
  if (!waiting) return;
  reloadOnControllerChange = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

function notifyUpdate(registration: ServiceWorkerRegistration, waiting: ServiceWorker): void {
  pendingUpdate = { registration, waiting };
  for (const listener of listeners) listener(pendingUpdate);
}

/** Backfill resources loaded before the first worker controlled the page. */
async function sendLoadedResources(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const sw = registration.active;
    if (!sw) return;

    const urls = new Set<string>([registration.scope]);
    for (const entry of performance.getEntriesByType('resource')) {
      if (entry.name.startsWith(location.origin)) urls.add(entry.name);
    }
    sw.postMessage({ type: 'CACHE_RESOURCES', urls: [...urls] });
  } catch {
    // Offline caching is best effort and must never break the running app.
  }
}

/** Register the static worker shipped in public/sw.js (no Vite plugin required). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('sw.js');

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadOnControllerChange) window.location.reload();
    });

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          notifyUpdate(registration, installing);
        }
      });
    });

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyUpdate(registration, registration.waiting);
    }

    if (document.readyState === 'complete') {
      void sendLoadedResources();
    } else {
      window.addEventListener('load', () => void sendLoadedResources(), { once: true });
    }

    // Failure means "keep using this version", never an app-level error.
    setInterval(() => {
      registration.update().catch(() => {});
    }, 60 * 60 * 1000);

    console.log('[SW] registered:', registration.scope);
    return registration;
  } catch (error) {
    console.warn('[SW] registration failed (app continues without offline support):', error);
    return null;
  }
}
