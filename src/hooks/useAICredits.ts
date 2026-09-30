import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { createAIClient } from '@/lib/ai-client';
import { fetchPPQBalance, isPPQProvider } from '@/lib/ppq';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { AIProvider } from '@/contexts/AISettingsContext';

const creditsResponseSchema = z.object({
  object: z.literal('credits'),
  amount: z.number(),
});

// Normalized response type (always in V1 format)
export interface CreditsResponse {
  object: 'credits';
  amount: number;
}

/**
 * Canonical query key for AI credits. Use this everywhere (fetching AND
 * invalidating) so cache updates propagate to all consumers.
 *
 * The scope segment identifies the account: the Nostr pubkey for
 * Nostr-authenticated providers, the API key tail for PayPerQ (different
 * keys on the same provider id can have different balances).
 */
export function aiCreditsQueryKey(provider: AIProvider, pubkey?: string): readonly [string, string, string] {
  const scope = provider.nostr
    ? pubkey ?? ''
    : isPPQProvider(provider) && provider.apiKey
      ? `key:${provider.apiKey.slice(-6)}`
      : '';
  return ['ai-credits', scope, provider.id] as const;
}

/** Whether this provider has a way to query a credit balance right now. */
function canQueryCredits(provider: AIProvider, userPubkey: string | undefined): boolean {
  if (provider.nostr) return !!userPubkey;
  if (isPPQProvider(provider)) return !!provider.apiKey;
  return false;
}

/** Custom hook to fetch AI provider credits */
export function useAICredits(provider: AIProvider | undefined) {
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  return useQuery({
    queryKey: provider
      ? [...aiCreditsQueryKey(provider, user?.pubkey)]
      : ['ai-credits', 'none', 'none'],
    queryFn: async (): Promise<CreditsResponse> => {
      if (!provider) throw new Error('No provider');

      try {
        // PayPerQ has its own balance endpoint (POST /credits/balance)
        if (isPPQProvider(provider)) {
          const amount = await fetchPPQBalance(provider);
          return { object: 'credits', amount };
        }

        const ai = createAIClient(provider, user, config.corsProxy);
        const data = await ai.get('/credits');
        return creditsResponseSchema.parse(data);
      } catch (error) {
        if (error instanceof Error && !error.message.includes('Connection error')) {
          console.error('Error fetching AI credits:', error);
        }
        throw error;
      }
    },
    retry: false, // Don't retry as not all providers support this endpoint
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!provider && canQueryCredits(provider, user?.pubkey),
  });
}
