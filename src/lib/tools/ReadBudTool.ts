import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import { NIPsClient } from "../NIPsClient";
import { HTTPError } from "../HTTPError";

interface ReadBudParams {
  bud: number;
}

/**
 * Read a Blossom BUD (Blossom Upgrade Document) specification.
 * BUDs are at https://github.com/hzrd149/blossom/tree/master/buds
 * Raw URL: https://raw.githubusercontent.com/hzrd149/blossom/master/buds/{NN}.md
 */
export class ReadBudTool implements Tool<ReadBudParams> {
  private client: NIPsClient;

  readonly description = "Read a Blossom BUD (Blossom Upgrade Document) specification";

  readonly inputSchema = z.object({
    bud: z
      .number()
      .int()
      .min(0)
      .max(99)
      .describe("BUD number to retrieve, e.g. 1 for BUD-01"),
  });

  constructor() {
    this.client = new NIPsClient({
      urlTemplate: "https://raw.githubusercontent.com/hzrd149/blossom/master/buds/{nip}.md",
    });
  }

  async execute(args: ReadBudParams): Promise<ToolResult> {
    const slug = String(args.bud).padStart(2, "0");
    try {
      const text = await this.client.readNip(slug);
      return { content: text };
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        throw new Error(`BUD-${slug} does not exist in the Blossom repository.`);
      }
      throw new Error(`Error reading BUD-${slug}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}
