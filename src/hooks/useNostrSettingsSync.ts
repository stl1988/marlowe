import { useState, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAISettings } from '@/hooks/useAISettings';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useDeploySettings } from '@/hooks/useDeploySettings';
import { useAppContext } from '@/hooks/useAppContext';
import type { AISettings } from '@/contexts/AISettingsContext';
import type { GitSettings } from '@/contexts/GitSettingsContext';
import type { DeploySettings } from '@/contexts/DeploySettingsContext';
import type { AppConfig } from '@/contexts/AppContext';

/**
 * NIP-78 d-tag identifiers for each settings bundle.
 * Kind 30078 (addressable) — one event per bundle per user.
 */
const D_TAGS = {
  ai:     'marlowe/settings/ai',
  git:    'marlowe/settings/git',
  deploy: 'marlowe/settings/deploy',
  app:    'marlowe/settings/app',
} as const;

type SettingsKey = keyof typeof D_TAGS;

/** All settings bundled into one object for upload/download */
interface SettingsBundle {
  ai?: AISettings;
  git?: GitSettings;
  deploy?: DeploySettings;
  /** Only a safe subset of AppConfig (no secrets, user-configurable fields only) */
  app?: Partial<AppConfig>;
}

/** Fields of AppConfig that are safe and useful to sync across devices */
const APP_SYNC_FIELDS: (keyof AppConfig)[] = [
  'theme',
  'relayMetadata',
  'graspMetadata',
  'templates',
  'language',
  'showcaseEnabled',
  'showcaseCurator',
  'esmUrl',
  'corsProxy',
  'gitProxyOrigins',
  'faviconUrl',
  'ngitWebUrl',
  'previewDomain',
  'sentryEnabled',
  'plausibleDomain',
  'plausibleEndpoint',
  'additionalInstructions',
  'systemPrompt',
];

export type SyncStatus = 'idle' | 'uploading' | 'downloading' | 'success' | 'error';

export interface NostrSettingsSyncResult {
  upload: () => Promise<void>;
  download: () => Promise<void>;
  status: SyncStatus;
  error: string | null;
  lastSyncedAt: Date | null;
  isLoggedIn: boolean;
  hasNip44: boolean;
}

/**
 * Hook for NIP-78 settings sync via Nostr.
 *
 * All settings are stored as NIP-78 kind 30078 addressable events.
 * The content is NIP-44 encrypted to the user's own pubkey (self-encryption),
 * so only the user holding the corresponding private key can read the data.
 *
 * This means API keys, Git passwords, and deploy tokens are encrypted at rest
 * on relays and cannot be read by relay operators or anyone else.
 *
 * Settings are split into four events by d-tag:
 *   - marlowe/settings/ai     — AI providers, API keys, model preferences
 *   - marlowe/settings/git    — Git credentials, author name/email
 *   - marlowe/settings/deploy — Deploy provider configurations and API keys
 *   - marlowe/settings/app    — App config (theme, relays, language, etc.)
 */
export function useNostrSettingsSync(): NostrSettingsSyncResult {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const aiSettings = useAISettings();
  const gitSettings = useGitSettings();
  const deploySettings = useDeploySettings();
  const { config, updateConfig } = useAppContext();

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const isLoggedIn = !!user;
  const hasNip44 = !!(user?.signer?.nip44);

  /** Encrypt a JSON-serialisable value to self using NIP-44 */
  const encrypt = useCallback(async (data: unknown): Promise<string> => {
    if (!user?.signer?.nip44) throw new Error('NIP-44 encryption not available');
    return user.signer.nip44.encrypt(user.pubkey, JSON.stringify(data));
  }, [user]);

  /** Decrypt a NIP-44 self-encrypted string */
  const decrypt = useCallback(async (ciphertext: string): Promise<unknown> => {
    if (!user?.signer?.nip44) throw new Error('NIP-44 decryption not available');
    const plain = await user.signer.nip44.decrypt(user.pubkey, ciphertext);
    return JSON.parse(plain);
  }, [user]);

  /**
   * Upload all settings to Nostr as four NIP-78 kind 30078 events.
   * Each event's content is NIP-44 encrypted to self.
   */
  const upload = useCallback(async () => {
    if (!user) throw new Error('Must be logged in to sync settings');
    if (!user.signer.nip44) throw new Error('Your signer must support NIP-44 encryption to sync settings');

    setStatus('uploading');
    setError(null);

    try {
      // Build the app subset (only safe-to-sync fields)
      const appSubset: Partial<AppConfig> = {};
      for (const key of APP_SYNC_FIELDS) {
        if (config[key] !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (appSubset as any)[key] = config[key];
        }
      }

      const bundles: Record<SettingsKey, unknown> = {
        ai:     aiSettings.settings,
        git:    gitSettings.settings,
        deploy: deploySettings.settings,
        app:    appSubset,
      };

      const now = Math.floor(Date.now() / 1000);

      await Promise.all(
        (Object.entries(bundles) as [SettingsKey, unknown][]).map(async ([key, data]) => {
          const encryptedContent = await encrypt(data);

          const event = await user.signer.signEvent({
            kind: 30078,
            content: encryptedContent,
            tags: [['d', D_TAGS[key]]],
            created_at: now,
          });

          await nostr.event(event, { signal: AbortSignal.timeout(8000) });
        })
      );

      setLastSyncedAt(new Date());
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStatus('error');
      throw err;
    }
  }, [user, nostr, encrypt, aiSettings.settings, gitSettings.settings, deploySettings.settings, config]);

  /**
   * Download all settings from Nostr and apply them locally.
   * Each event content is NIP-44 decrypted before being applied.
   */
  const download = useCallback(async () => {
    if (!user) throw new Error('Must be logged in to sync settings');
    if (!user.signer.nip44) throw new Error('Your signer must support NIP-44 encryption to sync settings');

    setStatus('downloading');
    setError(null);

    try {
      // Fetch all four events in one query
      const events = await nostr.query(
        [{
          kinds: [30078],
          authors: [user.pubkey],
          '#d': Object.values(D_TAGS),
          limit: 10,
        }],
        { signal: AbortSignal.timeout(8000) }
      );

      // Process each event by d-tag
      for (const event of events) {
        const dTag = event.tags.find(([name]) => name === 'd')?.[1];
        if (!dTag || !event.content) continue;

        let data: unknown;
        try {
          data = await decrypt(event.content);
        } catch {
          console.warn(`Failed to decrypt settings event with d="${dTag}"`, event.id);
          continue;
        }

        switch (dTag) {
          case D_TAGS.ai:
            aiSettings.updateSettings(data as Partial<AISettings>);
            break;
          case D_TAGS.git:
            gitSettings.updateSettings(data as Partial<GitSettings>);
            break;
          case D_TAGS.deploy:
            deploySettings.updateSettings(data as Partial<DeploySettings>);
            break;
          case D_TAGS.app:
            updateConfig(() => data as Partial<AppConfig>);
            break;
        }
      }

      setLastSyncedAt(new Date());
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStatus('error');
      throw err;
    }
  }, [user, nostr, decrypt, aiSettings, gitSettings, deploySettings, updateConfig]);

  return {
    upload,
    download,
    status,
    error,
    lastSyncedAt,
    isLoggedIn,
    hasNip44,
  };
}
