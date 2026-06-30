import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
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

      console.log(`[useAuthor] pubkey=${pubkey.slice(0, 8)} got ${events.length} events`);

      const event = events[0];

      if (!event) {
        throw new Error('No event found');
      }

      try {
        const metadata = n.json().pipe(n.metadata()).parse(event.content);
        console.log(`[useAuthor] resolved name=${metadata.name} for ${pubkey.slice(0, 8)}`);
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
