import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import { HTTPError } from "../HTTPError";

interface ReadCyberspaceParams {
  path: string;
}

/**
 * Known documents in the Cyberspace protocol spec repo, used in the tool
 * description so the AI knows what to ask for.
 *
 * Repo: https://github.com/arkin0x/cyberspace (master branch)
 * Raw base: https://raw.githubusercontent.com/arkin0x/cyberspace/master/
 *
 * Layout:
 *
 *   CYBERSPACE_V2.md   - the mandatory base protocol specification (v2)
 *   RATIONALE.md       - design rationale and philosophy (non-normative)
 *   decks/             - DECKs: Design Extension and Compatibility Kits
 *                        (optional protocol extensions)
 *   docs/              - design records and game-layer analyses
 *   *.py               - stdlib-only, self-checking reference scripts
 *   archive/v1/        - deprecated v1 documents (do not implement)
 */

const KNOWN_DOCS = [
  // base protocol
  "CYBERSPACE_V2.md",
  "readme.md",
  "RATIONALE.md",
  // DECKs (optional extensions)
  "decks/README.md",
  "decks/DECK-0001-hyperspace.md",
  "decks/DECK-0002-virtual-spawn.md",
  // reference scripts (executable statements of spec sections)
  "sidestep-reference.py",
  "hint-reference.py",
  "decks/landfall-reference.py",
  // design records / analyses
  "docs/territory-conflict-game-layer.md",
  "docs/analysis/deck-derezz-d2-work-clock.md",
  "docs/analysis/deck-derezz-ground-up-analysis.md",
  "docs/analysis/deck-domains-ground-up-analysis.md",
  // visualization test vectors
  "visualization_vectors.json",
];

const RAW_BASE = "https://raw.githubusercontent.com/arkin0x/cyberspace/master/";

/**
 * Read a Cyberspace protocol specification document from GitHub.
 *
 * Cyberspace is a 256-bit coordinate system navigated by cryptographic
 * keypairs using structured proof-of-work (Cantor pairing trees for hops,
 * Merkle hash trees for sidesteps), with Nostr (kind 3333 movement chains,
 * kind 33330 encrypted "bags") as the transmission layer. Optional
 * extensions are specified as DECKs (e.g. DECK-0001 Hyperspace, which
 * threads a transit line through Bitcoin blocks).
 *
 * Pass the relative path from the repo root. The mandatory base spec is
 * "CYBERSPACE_V2.md"; read it first. Extensions live under "decks/".
 */
export class ReadCyberspaceTool implements Tool<ReadCyberspaceParams> {
  readonly description =
    "Read a Cyberspace protocol specification document (a 256-bit proof-of-work coordinate " +
    "space over Nostr: spawn/hop/sidestep movement chains on kind 3333, location-encrypted " +
    "'bag' content on kind 33330, GPS mapping into dataspace). " +
    "Pass the relative path from the repo root. " +
    "The mandatory base spec is \"CYBERSPACE_V2.md\" — read it first. " +
    "Optional extensions (DECKs) live under \"decks/\", e.g. \"decks/DECK-0001-hyperspace.md\" " +
    "(Bitcoin block transit) or \"decks/DECK-0002-virtual-spawn.md\"; see \"decks/README.md\" for the registry.";

  readonly inputSchema = z.object({
    path: z
      .string()
      .describe(
        "Relative path to a Cyberspace spec document from the repo root, e.g. " +
        "\"CYBERSPACE_V2.md\", \"decks/DECK-0001-hyperspace.md\", \"decks/README.md\". " +
        `Known documents: ${KNOWN_DOCS.join(", ")}`
      ),
  });

  async execute(args: ReadCyberspaceParams): Promise<ToolResult> {
    // Sanitise: strip leading slashes, reject path traversal
    const safePath = args.path.replace(/^\/+/, "");
    if (safePath.includes("..") || safePath.startsWith("/")) {
      throw new Error(`Invalid path: "${args.path}"`);
    }

    const url = `${RAW_BASE}${safePath}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Cyberspace spec document "${safePath}" not found. ` +
            `Read "decks/README.md" for the DECK registry, or start with "CYBERSPACE_V2.md".`
          );
        }
        throw new HTTPError(response, new Request(url));
      }
      const text = await response.text();
      return { content: text };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Cyberspace spec")) {
        throw error;
      }
      throw new Error(
        `Error reading Cyberspace spec "${safePath}": ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
