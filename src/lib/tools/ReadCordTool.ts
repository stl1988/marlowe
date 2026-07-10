import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import { NIPsClient } from "../NIPsClient";
import { HTTPError } from "../HTTPError";

interface ReadCordParams {
  cord: number;
}

/**
 * Read a Concord Protocol CORD (Concord Protocol Document) specification.
 * Concord is a protocol for end-to-end encrypted communities and channels on Nostr.
 * CORDs are at https://github.com/concord-protocol/concord (main branch)
 * Raw URL: https://raw.githubusercontent.com/concord-protocol/concord/main/{NN}.md
 *
 * Current CORDs:
 *   01 - Private Streams
 *   02 - Communities
 *   03 - Channels
 *   04 - Roles
 *   05 - Invites
 *   06 - Rekeys & Refoundings
 *   07 - Audio/Video
 */
export class ReadCordTool implements Tool<ReadCordParams> {
  private client: NIPsClient;

  readonly description =
    "Read a Concord Protocol CORD (Concord Protocol Document) specification. " +
    "Concord is a protocol for end-to-end encrypted Discord-style communities and channels built on Nostr. " +
    "Available CORDs: 1 (Private Streams), 2 (Communities), 3 (Channels), 4 (Roles), " +
    "5 (Invites), 6 (Rekeys & Refoundings), 7 (Audio/Video).";

  readonly inputSchema = z.object({
    cord: z
      .number()
      .int()
      .min(1)
      .max(99)
      .describe("CORD number to retrieve, e.g. 1 for CORD-01 (Private Streams)"),
  });

  constructor() {
    this.client = new NIPsClient({
      urlTemplate: "https://raw.githubusercontent.com/concord-protocol/concord/main/{nip}.md",
    });
  }

  async execute(args: ReadCordParams): Promise<ToolResult> {
    const slug = String(args.cord).padStart(2, "0");
    try {
      const text = await this.client.readNip(slug);
      return { content: text };
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        throw new Error(
          `CORD-${slug} does not exist in the Concord repository. ` +
          `Currently available CORDs: 01–07.`
        );
      }
      throw new Error(
        `Error reading CORD-${slug}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
