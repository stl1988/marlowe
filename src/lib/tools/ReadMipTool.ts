import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import { NIPsClient } from "../NIPsClient";
import { HTTPError } from "../HTTPError";

interface ReadMipParams {
  mip: number;
}

/**
 * Read a Marmot MIP (Marmot Implementation Proposal) specification.
 * Marmot is a protocol for E2E encrypted group messaging using MLS + Nostr.
 * MIPs are at https://github.com/marmot-protocol/marmot
 * Raw URL: https://raw.githubusercontent.com/marmot-protocol/marmot/master/{NN}.md
 */
export class ReadMipTool implements Tool<ReadMipParams> {
  private client: NIPsClient;

  readonly description = "Read a Marmot MIP (Marmot Implementation Proposal) specification for E2E encrypted group messaging over Nostr";

  readonly inputSchema = z.object({
    mip: z
      .number()
      .int()
      .min(0)
      .max(99)
      .describe("MIP number to retrieve, e.g. 1 for MIP-01"),
  });

  constructor() {
    this.client = new NIPsClient({
      urlTemplate: "https://raw.githubusercontent.com/marmot-protocol/marmot/master/{nip}.md",
    });
  }

  async execute(args: ReadMipParams): Promise<ToolResult> {
    const slug = String(args.mip).padStart(2, "0");
    try {
      const text = await this.client.readNip(slug);
      return { content: text };
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        throw new Error(`MIP-${slug} does not exist in the Marmot repository.`);
      }
      throw new Error(`Error reading MIP-${slug}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}
