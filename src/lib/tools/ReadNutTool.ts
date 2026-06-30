import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import { NIPsClient } from "../NIPsClient";
import { HTTPError } from "../HTTPError";

interface ReadNutParams {
  nut: number;
}

/**
 * Read a Cashu NUT (Notation, Usage, and Terminology) specification.
 * NUTs are at https://github.com/cashubtc/nuts
 * Raw URL: https://raw.githubusercontent.com/cashubtc/nuts/main/{NN}.md
 */
export class ReadNutTool implements Tool<ReadNutParams> {
  private client: NIPsClient;

  readonly description = "Read a Cashu NUT (Notation, Usage, and Terminology) specification";

  readonly inputSchema = z.object({
    nut: z
      .number()
      .int()
      .min(0)
      .max(99)
      .describe("NUT number to retrieve, e.g. 1 for NUT-01"),
  });

  constructor() {
    this.client = new NIPsClient({
      urlTemplate: "https://raw.githubusercontent.com/cashubtc/nuts/main/{nip}.md",
    });
  }

  async execute(args: ReadNutParams): Promise<ToolResult> {
    const slug = String(args.nut).padStart(2, "0");
    try {
      const text = await this.client.readNip(slug);
      return { content: text };
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        throw new Error(`NUT-${slug} does not exist in the Cashu NUTs repository.`);
      }
      throw new Error(`Error reading NUT-${slug}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}
