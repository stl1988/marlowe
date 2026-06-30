import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";

interface ReadBoltParams {
  bolt: number;
}

/**
 * BOLT filenames in https://github.com/lightning/bolts (master branch).
 * Files are named {NN}-{name}.md at the repo root.
 */
const BOLT_FILES: Record<number, string> = {
  0: "00-introduction.md",
  1: "01-messaging.md",
  2: "02-peer-protocol.md",
  3: "03-transactions.md",
  4: "04-onion-routing.md",
  5: "05-onchain.md",
  7: "07-routing-gossip.md",
  8: "08-transport.md",
  9: "09-features.md",
  10: "10-dns-bootstrap.md",
  11: "11-payment-encoding.md",
  12: "12-offer-encoding.md",
};

const VALID_BOLTS = Object.keys(BOLT_FILES).map(Number);

/**
 * Read a Lightning BOLT (Basis of Lightning Technology) specification.
 * BOLTs are at https://github.com/lightning/bolts
 * Raw URL: https://raw.githubusercontent.com/lightning/bolts/master/{filename}
 */
export class ReadBoltTool implements Tool<ReadBoltParams> {
  readonly description = "Read a Lightning Network BOLT (Basis of Lightning Technology) specification";

  readonly inputSchema = z.object({
    bolt: z
      .number()
      .int()
      .min(0)
      .describe(`BOLT number to retrieve. Available BOLTs: ${VALID_BOLTS.join(", ")}`),
  });

  async execute(args: ReadBoltParams): Promise<ToolResult> {
    const filename = BOLT_FILES[args.bolt];
    if (!filename) {
      throw new Error(
        `BOLT-${args.bolt} does not exist. Available BOLTs: ${VALID_BOLTS.join(", ")}.`
      );
    }

    const url = `https://raw.githubusercontent.com/lightning/bolts/master/${filename}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching BOLT-${args.bolt}`);
      }
      const text = await response.text();
      return { content: text };
    } catch (error) {
      throw new Error(`Error reading BOLT-${args.bolt}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}
