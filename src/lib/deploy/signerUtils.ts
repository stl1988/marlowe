import type { NostrSigner, NostrEvent } from '@nostrify/nostrify';

/**
 * NIP-07 browser extension signers (Alby, nos2x, Nostore, etc.) run as
 * Chrome extension service workers that may go idle between interactions.
 * When the first signing request wakes them up, the message port isn't
 * ready yet and Chrome throws:
 *   "Could not establish connection. Receiving end does not exist."
 *
 * Retrying after a short delay reliably succeeds once the SW is alive.
 */
const EXTENSION_NOT_READY_PATTERN = /receiving end does not exist/i;
const RETRY_DELAY_MS = 500;
const MAX_RETRIES = 3;

type EventTemplate = Parameters<NostrSigner['signEvent']>[0];

/**
 * Call signer.signEvent() with automatic retry on extension-not-ready errors.
 */
export async function signEventWithRetry(
  signer: NostrSigner,
  template: EventTemplate,
): Promise<NostrEvent> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await signer.signEvent(template);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (EXTENSION_NOT_READY_PATTERN.test(message)) {
        // Brief pause to let the extension service worker wake up
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      // Any other error is re-thrown immediately
      throw err;
    }
  }

  throw lastError;
}
