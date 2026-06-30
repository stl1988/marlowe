import { z } from "zod";
import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import type { Tool, ToolResult } from "./Tool";

interface NostrReadCustomNipParams {
  identifier: string;
}

const DEFAULT_RELAYS = [
  'wss://relay.ditto.pub',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://purplepag.es',
];

/**
 * Read a custom Nostr NIP published as a kind 30817 addressable event.
 * Custom NIPs are authored by individuals/projects and published on Nostr
 * rather than being merged into the official nostr-protocol/nips repository.
 *
 * The identifier can be:
 * - An naddr1... bech32 pointing directly at a kind 30817 event
 * - A pubkey (hex or npub) + d-tag in the format "pubkey:d-tag"
 */
export class NostrReadCustomNipTool implements Tool<NostrReadCustomNipParams> {
  readonly description =
    "Read a custom Nostr NIP published as a kind 30817 addressable event on Nostr relays. " +
    "Pass an naddr1 identifier, or a pubkey:d-tag pair.";

  readonly inputSchema = z.object({
    identifier: z
      .string()
      .describe(
        "Either an naddr1... bech32 identifier for the kind 30817 event, " +
        "or a \"pubkey:d-tag\" pair where pubkey is hex or npub (e.g. \"npub1abc...:my-nip\")"
      ),
  });

  async execute(args: NostrReadCustomNipParams): Promise<ToolResult> {
    const { identifier } = args;

    const pool = new NPool({
      open(url) { return new NRelay1(url); },
      eventRouter() { return [...DEFAULT_RELAYS]; },
      reqRouter(filters) {
        return new Map(DEFAULT_RELAYS.map(url => [url, filters]));
      },
    });

    try {
      // Case 1: naddr bech32
      if (identifier.startsWith("naddr1")) {
        const decoded = nip19.decode(identifier);
        if (decoded.type !== "naddr") {
          throw new Error("Identifier must be an naddr1 bech32 pointing at a kind 30817 event.");
        }
        const { kind, pubkey, identifier: dTag, relays } = decoded.data;
        if (kind !== 30817) {
          throw new Error(`Expected kind 30817, got kind ${kind}.`);
        }
        const queryRelays = relays?.length ? relays : DEFAULT_RELAYS;
        const [event] = await pool.group(queryRelays).query(
          [{ kinds: [30817], authors: [pubkey], '#d': [dTag] }],
          { signal: AbortSignal.timeout(8_000) },
        );
        if (!event) throw new Error("Custom NIP event not found.");
        return { content: event.content };
      }

      // Case 2: "pubkey:d-tag" or "npub:d-tag"
      const colonIdx = identifier.indexOf(":");
      if (colonIdx === -1) {
        throw new Error(
          "Invalid identifier. Use an naddr1 bech32, or \"pubkey:d-tag\" format."
        );
      }
      let pubkeyHex = identifier.slice(0, colonIdx);
      const dTag = identifier.slice(colonIdx + 1);

      // Decode npub if needed
      if (pubkeyHex.startsWith("npub1")) {
        const decoded = nip19.decode(pubkeyHex);
        if (decoded.type !== "npub") throw new Error("Invalid npub identifier.");
        pubkeyHex = decoded.data;
      }

      const [event] = await pool.query(
        [{ kinds: [30817], authors: [pubkeyHex], '#d': [dTag] }],
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!event) throw new Error(`Custom NIP "${dTag}" by ${pubkeyHex.slice(0, 8)}... not found.`);
      return { content: event.content };

    } finally {
      await pool.close();
    }
  }
}
