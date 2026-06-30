import { type NostrEvent, type NostrMetadata } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      const events = await nostr.query(
        [{ kinds: [0], authors: [pubkey!], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );

      const event = events[0];

      if (!event) {
        throw new Error('No event found');
      }

      try {
        // Parse content directly — avoids NSchema.metadata() which may reject
        // non-standard fields (e.g. "sp_address", "displayName") under Zod v3.
        const metadata = JSON.parse(event.content) as NostrMetadata;
        return { metadata, event };
      } catch {
        return { event };
      }
    },
    retry: 3,
    retryDelay: 1000,
    staleTime: 60000,
  });
}
