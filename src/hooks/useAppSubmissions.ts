import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import type { NostrEvent, NostrFilter, NostrMetadata, NRelay, NPool } from '@nostrify/nostrify';
import { NSchema as n } from '@nostrify/nostrify';
import { useAppContext } from '@/hooks/useAppContext';
import { NostrURI } from '@/lib/NostrURI';

export interface AppSubmission extends NostrEvent {
  appName: string;
  websiteUrl: string;
  repositoryUrl: string;
  description: string;
  appIconUrl: string;
  bannerUrl: string;
  /** Author profile metadata, resolved in a separate query */
  authorMetadata?: NostrMetadata;
}

/**
 * Extract pubkeys from the `p` tags of a Nostr event.
 */
function extractPubkeys(event: NostrEvent): string[] {
  return event.tags
    .filter(([name]) => name === 'p')
    .map(([, pubkey]) => pubkey)
    .filter(Boolean);
}

/**
 * Resolve a NIP-19 identifier (note1, nevent1, or naddr1) to an event.
 */
async function resolveCuratorEvent(
  curatorIdentifier: string,
  nostr: NPool<NRelay>,
): Promise<NostrEvent | null> {
  try {
    const decoded = nip19.decode(curatorIdentifier);

    if (decoded.type === 'note') {
      const events = await nostr.query(
        [{ ids: [decoded.data], limit: 1 }],
        { signal: AbortSignal.timeout(3000) },
      );
      return events[0] ?? null;
    }

    if (decoded.type === 'nevent') {
      const filter: NostrFilter = { ids: [decoded.data.id], limit: 1 };
      if (decoded.data.author) filter.authors = [decoded.data.author];
      const events = await nostr.query([filter], { signal: AbortSignal.timeout(3000) });
      return events[0] ?? null;
    }

    if (decoded.type === 'naddr') {
      const { kind, pubkey, identifier } = decoded.data;
      const events = await nostr.query(
        [{ kinds: [kind], authors: [pubkey], '#d': [identifier], limit: 1 }],
        { signal: AbortSignal.timeout(3000) },
      );
      return events[0] ?? null;
    }
  } catch {
    // Invalid identifier or query failure — handled by caller
  }

  return null;
}

/**
 * Returns true if a kind 31990 event can render an "Edit with Shakespeare" button.
 * Requires an `a` tag referencing a kind 30617 git repository event.
 */
function hasGitRepository(event: NostrEvent): boolean {
  return event.tags.some(([name, value]) => name === 'a' && value?.startsWith('30617:'));
}

/**
 * Build a git clone URL from a kind 30617 `a` tag value (`30617:pubkey:d-tag`).
 * Returns a nostr:// URI usable with isomorphic-git / Shakespeare clone flow.
 */
function repositoryUrlFromATag(aTagValue: string): string {
  const parts = aTagValue.split(':');
  if (parts.length < 3) return '';
  const [, pubkey, identifier] = parts;
  return new NostrURI({ pubkey, identifier }).toString();
}

/** Parse a raw kind 31990 event into an AppSubmission (without authorMetadata). */
function parseAppEvent(event: NostrEvent): AppSubmission | null {
  try {
    let appName = '';
    let appIconUrl = '';
    let bannerUrl = '';
    let websiteUrl = '';
    let description = '';

    if (event.content) {
      try {
        const meta = JSON.parse(event.content) as Record<string, unknown>;
        if (typeof meta.name === 'string') appName = meta.name;
        if (typeof meta.about === 'string') description = meta.about;
        if (typeof meta.picture === 'string') appIconUrl = meta.picture;
        if (typeof meta.banner === 'string') bannerUrl = meta.banner;
        if (typeof meta.website === 'string') websiteUrl = meta.website;
      } catch {
        // Non-JSON content — ignore
      }
    }

    // Fallback: title tag
    if (!appName) {
      appName = event.tags.find(([name]) => name === 'title')?.[1] ?? '';
    }

    // Build repository URL from the first 30617 `a` tag
    const repoATag = event.tags.find(([name, value]) => name === 'a' && value?.startsWith('30617:'));
    const repositoryUrl = repoATag ? repositoryUrlFromATag(repoATag[1]) : '';

    return { ...event, appName, websiteUrl, repositoryUrl, description, appIconUrl, bannerUrl };
  } catch {
    return null;
  }
}

export function useAppSubmissions() {
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const curatorIdentifier = config.showcaseCurator;

  // ── Query 1: fetch app events ────────────────────────────────────────────
  const appsQuery = useQuery({
    queryKey: ['nostr', 'app-submissions', curatorIdentifier],
    queryFn: async (): Promise<AppSubmission[]> => {
      if (!curatorIdentifier.trim()) return [];

      const curatorEvent = await resolveCuratorEvent(curatorIdentifier, nostr);
      if (!curatorEvent) return [];

      const authorPubkeys = extractPubkeys(curatorEvent);
      if (authorPubkeys.length === 0) return [];

      const appEvents = await nostr.query(
        [{
          kinds: [31990],
          authors: authorPubkeys,
          '#t': ['shakespeare'],
          limit: 200,
        }],
        { signal: AbortSignal.timeout(5000) },
      );

      // Client-side filter: only keep events with a git repo, icon, and banner
      const filteredEvents = appEvents.filter(event => {
        if (!hasGitRepository(event)) return false;
        try {
          const meta = JSON.parse(event.content) as Record<string, unknown>;
          return typeof meta.picture === 'string' && meta.picture &&
                 typeof meta.banner === 'string' && meta.banner;
        } catch {
          return false;
        }
      });

      // Deduplicate: for each pubkey+d-tag, keep only the latest event
      const latestMap = new Map<string, NostrEvent>();
      for (const event of filteredEvents) {
        const dTag = event.tags.find(([name]) => name === 'd')?.[1] ?? '';
        const key = `${event.pubkey}:${dTag}`;
        const existing = latestMap.get(key);
        if (!existing || event.created_at > existing.created_at) {
          latestMap.set(key, event);
        }
      }

      return [...latestMap.values()]
        .map(parseAppEvent)
        .filter((s): s is AppSubmission => s !== null);
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // ── Query 2: fetch author profiles separately ────────────────────────────
  // This runs as an independent query with its own timeout + retry so it
  // doesn't compete with the app-events fetch for relay bandwidth.
  const apps = appsQuery.data ?? [];
  const uniquePubkeys = [...new Set(apps.map(a => a.pubkey))];

  const profilesQuery = useQuery({
    queryKey: ['nostr', 'app-submission-profiles', uniquePubkeys.sort().join(',')],
    queryFn: async (): Promise<Map<string, NostrMetadata>> => {
      if (uniquePubkeys.length === 0) return new Map();

      const profileEvents = await nostr.query(
        [{ kinds: [0], authors: uniquePubkeys, limit: uniquePubkeys.length * 10 }],
        { signal: AbortSignal.timeout(8000) },
      );

      // Keep the most recent profile per pubkey
      const latestAt = new Map<string, number>();
      const metadataMap = new Map<string, NostrMetadata>();

      for (const profileEvent of profileEvents) {
        const existing = latestAt.get(profileEvent.pubkey) ?? -1;
        if (profileEvent.created_at <= existing) continue;
        try {
          const metadata = n.json().pipe(n.metadata()).parse(profileEvent.content);
          metadataMap.set(profileEvent.pubkey, metadata);
          latestAt.set(profileEvent.pubkey, profileEvent.created_at);
        } catch {
          // ignore unparseable profiles
        }
      }

      return metadataMap;
    },
    enabled: uniquePubkeys.length > 0,
    staleTime: 60000,
    retry: 3,
  });

  // ── Merge: attach authorMetadata to each app ─────────────────────────────
  const profileMap = profilesQuery.data ?? new Map<string, NostrMetadata>();
  const data = apps.map(app => ({
    ...app,
    authorMetadata: profileMap.get(app.pubkey),
  }));

  return {
    data,
    isLoading: appsQuery.isLoading,
    error: appsQuery.error,
  };
}

export function useUserAppSubmissions(userPubkey?: string) {
  const { data: allSubmissions, ...rest } = useAppSubmissions();

  const userSubmissions = allSubmissions?.filter(app => app.pubkey === userPubkey) || [];

  return {
    data: userSubmissions,
    ...rest,
  };
}
