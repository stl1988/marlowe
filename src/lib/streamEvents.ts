import type { NostrEvent, NostrFilter, NPool } from '@nostrify/nostrify';

export interface StreamEventsOptions {
  /** Hard cap for the whole query, in milliseconds. Defaults to 8000. */
  timeoutMs?: number;
  /**
   * Additional relays to query alongside the ones the pool's reqRouter picks.
   * Useful for outbox-style coverage, e.g. an author's own NIP-65 write relays.
   */
  extraRelays?: string[];
  /** Optional caller signal (e.g. a query's cancellation signal). */
  signal?: AbortSignal;
}

/**
 * Query relays and collect events as they stream in.
 *
 * Unlike `pool.query()`, this waits for **all** routed relays to answer (up to
 * `timeoutMs`): Nostrify's `query()` cancels every remaining relay one second
 * after the *fastest* one sends EOSE (its default `eoseTimeout`). A query
 * routed to fast general-purpose relays plus slower specialist relays — e.g.
 * git relays carrying NIP-34 repository announcements — would otherwise be cut
 * off before the specialists answered, silently returning an empty or partial
 * result.
 *
 * Events are deduplicated by id. Timeout and relay failures yield partial
 * results rather than throwing, matching `query()`'s behaviour.
 */
export async function streamEvents(
  nostr: NPool,
  filters: NostrFilter[],
  opts: StreamEventsOptions = {},
): Promise<NostrEvent[]> {
  const { timeoutMs = 8000, extraRelays = [] } = opts;

  const signals = [AbortSignal.timeout(timeoutMs)];
  if (opts.signal) signals.push(opts.signal);
  const signal = AbortSignal.any(signals);

  const events = new Map<string, NostrEvent>();

  const collect = async (relays?: string[]) => {
    try {
      for await (const msg of nostr.req(filters, { signal, ...(relays ? { relays } : {}) })) {
        if (msg[0] === 'EVENT') {
          const event = msg[2];
          if (!events.has(event.id)) {
            events.set(event.id, event);
          }
        } else if (msg[0] === 'EOSE' || msg[0] === 'CLOSED') {
          // All relays in this stream answered (or closed) — stop early.
          break;
        }
      }
    } catch {
      // A relay set that fails wholesale keeps whatever the others found.
    }
  };

  // The pool-routed stream and the extra-relay stream run in parallel and feed
  // the same deduplicated set.
  await Promise.all([
    collect(),
    extraRelays.length > 0 ? collect(extraRelays) : Promise.resolve(),
  ]);

  return [...events.values()];
}
