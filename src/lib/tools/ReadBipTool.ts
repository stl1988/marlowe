import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import { HTTPError } from "../HTTPError";

interface ReadBipParams {
  bip: number;
}

/**
 * Read a Bitcoin BIP (Bitcoin Improvement Proposal) specification.
 * BIPs are at https://github.com/bitcoin/bips
 * Raw URL: https://raw.githubusercontent.com/bitcoin/bips/master/bip-{NNNN}.mediawiki
 * Files use 4-digit zero-padded numbers and .mediawiki extension.
 * Some newer BIPs use .md extension — we try mediawiki first, then md.
 */
export class ReadBipTool implements Tool<ReadBipParams> {
  readonly description = "Read a Bitcoin BIP (Bitcoin Improvement Proposal) specification";

  readonly inputSchema = z.object({
    bip: z
      .number()
      .int()
      .min(1)
      .describe("BIP number to retrieve, e.g. 340 for BIP-340 (Schnorr Signatures)"),
  });

  async execute(args: ReadBipParams): Promise<ToolResult> {
    const slug = String(args.bip).padStart(4, "0");
    const base = `https://raw.githubusercontent.com/bitcoin/bips/master/bip-${slug}`;

    // Try .mediawiki first (most BIPs), then .md
    for (const ext of [".mediawiki", ".md"]) {
      const url = `${base}${ext}`;
      try {
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          return { content: text };
        }
        if (response.status !== 404) {
          throw new Error(`HTTP ${response.status} fetching BIP-${slug}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("HTTP")) {
          throw error;
        }
        // network error — rethrow
        throw new Error(`Error reading BIP-${slug}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    throw new Error(`BIP-${slug} does not exist in the Bitcoin BIPs repository.`);
  }
}
