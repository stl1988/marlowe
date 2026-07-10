import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import { HTTPError } from "../HTTPError";

interface ReadMipParams {
  path: string;
}

/**
 * Known documents in the Marmot spec repo, grouped by section.
 * Used in descriptions so the AI knows what to ask for.
 *
 * Repo: https://github.com/marmot-protocol/marmot (master branch)
 * Raw base: https://raw.githubusercontent.com/marmot-protocol/marmot/master/
 *
 * The MIP era (numbered NN.md files) is deprecated. The current spec is
 * organised into directories:
 *
 *   foundation/        - stable Marmot invariants (identity, encodings, etc.)
 *   protocol-core/     - required group flows and state transitions
 *   app-components/    - versioned MLS app_data_dictionary component bytes
 *   transports/        - how Marmot bytes move over a network (Nostr, QUIC)
 *   features/          - optional or user-visible flows spanning surfaces
 *
 * Top-level convenience docs: README.md, layout.md, principles.md,
 * mip-coverage.md, implementation-model.md
 */

const KNOWN_DOCS = [
  // top-level
  "README.md",
  "layout.md",
  "principles.md",
  "mip-coverage.md",
  "implementation-model.md",
  // foundation
  "foundation/README.md",
  "foundation/identity.md",
  "foundation/account-identity-proof-v1.md",
  "foundation/key-packages.md",
  "foundation/canonical-encoding.md",
  "foundation/application-messages.md",
  "foundation/wire-envelopes.md",
  "foundation/mls-protocol.md",
  "foundation/errors.md",
  "foundation/registries.md",
  // protocol-core
  "protocol-core/README.md",
  "protocol-core/group-setup.md",
  "protocol-core/joining.md",
  "protocol-core/group-messaging.md",
  "protocol-core/member-departure.md",
  "protocol-core/group-state.md",
  "protocol-core/publish-lifecycle.md",
  "protocol-core/inbound-processing.md",
  "protocol-core/convergence.md",
  "protocol-core/retained-history.md",
  // app-components
  "app-components/README.md",
  "app-components/group-profile-v1.md",
  "app-components/group-blossom-image-v1.md",
  "app-components/admin-policy-v1.md",
  "app-components/nostr-routing-v1.md",
  "app-components/message-retention-v1.md",
  "app-components/agent-text-stream-quic-v1.md",
  "app-components/group-avatar-url-v1.md",
  "app-components/group-encrypted-media-v1.md",
  // transports
  "transports/README.md",
  "transports/nostr.md",
  "transports/quic.md",
  // features
  "features/README.md",
  "features/encrypted-media.md",
  "features/push-notifications.md",
  "features/multi-device.md",
  "features/agent-text-streams-quic.md",
];

const RAW_BASE = "https://raw.githubusercontent.com/marmot-protocol/marmot/master/";

/**
 * Read a Marmot protocol specification document from GitHub.
 *
 * The Marmot repo reorganised from numbered MIP files to a directory-based
 * layout. Provide the relative path from the repo root, e.g.:
 *   "foundation/identity.md"
 *   "protocol-core/group-setup.md"
 *   "layout.md"
 */
export class ReadMipTool implements Tool<ReadMipParams> {
  readonly description =
    "Read a Marmot protocol specification document (E2E encrypted group messaging over Nostr + MLS). " +
    "The Marmot repo uses a directory-based layout — there are no longer numbered MIP files. " +
    "Pass the relative path from the repo root, e.g. \"foundation/identity.md\", " +
    "\"protocol-core/group-setup.md\", or \"layout.md\". " +
    "Known sections: foundation/, protocol-core/, app-components/, transports/, features/. " +
    "Read \"layout.md\" first for a full file list.";

  readonly inputSchema = z.object({
    path: z
      .string()
      .describe(
        "Relative path to a Marmot spec document from the repo root, e.g. " +
        "\"foundation/identity.md\", \"protocol-core/group-setup.md\", \"layout.md\". " +
        `Known documents: ${KNOWN_DOCS.join(", ")}`
      ),
  });

  async execute(args: ReadMipParams): Promise<ToolResult> {
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
            `Marmot spec document "${safePath}" not found. ` +
            `Read "layout.md" for the full list of available documents.`
          );
        }
        throw new HTTPError(response, new Request(url));
      }
      const text = await response.text();
      return { content: text };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Marmot spec")) {
        throw error;
      }
      throw new Error(
        `Error reading Marmot spec "${safePath}": ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
