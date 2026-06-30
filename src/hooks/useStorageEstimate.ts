import { useState, useEffect } from 'react';

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  /** 0–1 fraction */
  fraction: number;
  /** Whether the browser granted persistent storage */
  isPersisted: boolean | null;
}

/**
 * Polls navigator.storage.estimate() periodically so the UI can show
 * how much IndexedDB / VFS storage is currently consumed.
 */
export function useStorageEstimate(pollMs = 10_000): StorageEstimate | null {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    if (!('storage' in navigator) || typeof navigator.storage.estimate !== 'function') {
      return;
    }

    async function refresh() {
      try {
        const [est, persisted] = await Promise.all([
          navigator.storage.estimate(),
          navigator.storage.persisted?.() ?? Promise.resolve(null),
        ]);
        const usage = est.usage ?? 0;
        const quota = est.quota ?? 0;
        setEstimate({
          usageBytes: usage,
          quotaBytes: quota,
          fraction: quota > 0 ? Math.min(usage / quota, 1) : 0,
          isPersisted: persisted,
        });
      } catch {
        // ignore — not critical
      }
    }

    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  return estimate;
}
