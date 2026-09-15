import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent, NPool } from '@nostrify/nostrify';
import { streamEvents } from '@/lib/streamEvents';

// Kind 30617 for repository announcements (NIP-34)
const REPOSITORY_KIND = 30617;

/**
 * The author's NIP-65 write relays, where their repository announcements are
 * expected to live (NIP-34). The pool's default routing covers the configured
 * read relays plus the git relays, but an announcement published only to the
 * author's own relays is missed without this.
 */
async function fetchWriteRelayUrls(nostr: NPool, pubkey: string, signal?: AbortSignal): Promise<string[]> {
  const events = await streamEvents(
    nostr,
    [{ kinds: [10002], authors: [pubkey], limit: 1 }],
    { timeoutMs: 4000, signal },
  );

  const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
  if (!latest) return [];

  return latest.tags
    .filter(([name, , marker]) => name === 'r' && marker !== 'read')
    .map(([, url]) => url)
    .filter((url): url is string => Boolean(url));
}

export interface Repository extends NostrEvent {
  repoId: string;
  name: string;
  description: string;
  webUrls: string[];
  cloneUrls: string[];
  relays: string[];
  maintainers: string[];
  repoTags: string[];
  earliestUniqueCommit?: string;
  isPersonalFork: boolean;
}

export function useUserRepositories(userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr', 'user-repositories', userPubkey],
    queryFn: async (c): Promise<Repository[]> => {
      if (!userPubkey) {
        return [];
      }

      // Get all repository announcements for this user. Streamed rather than
      // pool.query(): that cancels every relay a second after the fastest one
      // answers, which is long before a git relay has connected and replied.
      const extraRelays = await fetchWriteRelayUrls(nostr, userPubkey, c.signal);
      const events = await streamEvents(
        nostr,
        [{ kinds: [REPOSITORY_KIND], authors: [userPubkey], limit: 100 }],
        { timeoutMs: 8000, extraRelays, signal: c.signal },
      );

      // Process repository events
      const repositories: Repository[] = [];
      const repoMap = new Map<string, NostrEvent>();

      // Group by d-tag (repo-id) to get latest version
      for (const event of events) {
        const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
        if (!dTag) continue;

        const existing = repoMap.get(dTag);
        if (!existing || event.created_at > existing.created_at) {
          repoMap.set(dTag, event);
        }
      }

      // Convert to Repository objects
      for (const [dTag, event] of repoMap) {
        try {
          const name = event.tags.find(tag => tag[0] === 'name')?.[1] || dTag;
          const description = event.tags.find(tag => tag[0] === 'description')?.[1] || '';
          const webUrls = event.tags.filter(tag => tag[0] === 'web').map(tag => tag[1]).filter(Boolean);
          const cloneUrls = event.tags.filter(tag => tag[0] === 'clone').map(tag => tag[1]).filter(Boolean);
          const relays = event.tags.filter(tag => tag[0] === 'relays').map(tag => tag[1]).filter(Boolean);
          const maintainers = event.tags.filter(tag => tag[0] === 'maintainers').map(tag => tag[1]).filter(Boolean);
          const repoTags = event.tags.filter(tag => tag[0] === 't' && tag[1] !== 'personal-fork').map(tag => tag[1]);
          const earliestUniqueCommit = event.tags.find(tag => tag[0] === 'r' && tag[2] === 'euc')?.[1];
          const isPersonalFork = event.tags.some(tag => tag[0] === 't' && tag[1] === 'personal-fork');

          // Filter out invalid repositories without clone URLs
          if (cloneUrls.length === 0) {
            console.warn('Skipping repository without clone URLs:', dTag);
            continue;
          }

          repositories.push({
            ...event,
            repoId: dTag,
            name,
            description,
            webUrls,
            cloneUrls,
            relays,
            maintainers,
            repoTags,
            earliestUniqueCommit,
            isPersonalFork,
          });
        } catch (error) {
          console.warn('Failed to parse repository:', error);
        }
      }

      return repositories;
    },
    enabled: !!userPubkey,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}
