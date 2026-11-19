import { z } from 'zod';
import { Tool, ToolResult } from './Tool';
import { getConsoleMessages } from '@/lib/consoleMessages';
import {
  getViewportInfo,
  isPreviewFrameMounted,
  projectIdFromPath,
} from '@/lib/viewport';

export interface ReadConsoleMessagesParams {
  filter?: 'error' | 'warn' | 'info' | 'debug' | 'log' | 'all';
  limit?: number;
}

export interface ReadConsoleMessagesOptions {
  /** Project directory (`/projects/<id>`); used to tell whether its preview is live. */
  cwd?: string;
}

/**
 * AI tool for reading console messages from the project preview.
 * This tool allows AI assistants to access console logs for debugging assistance.
 *
 * Console messages only exist while a preview iframe is mounted and the app
 * inside it runs. On small screens (phones, narrow windows) the preview pane is
 * a separate tab and is unmounted while the user chats, so the tool reports
 * that no live preview exists instead of letting the AI debug stale messages.
 */
export class ReadConsoleMessagesTool implements Tool<ReadConsoleMessagesParams> {
  readonly description = 'Read console messages from the project preview. Can filter by level and limit results. Returns no live data when the preview is not mounted (e.g. the user is on a small screen and has not switched to the preview tab).';

  readonly inputSchema = z.object({
    filter: z.enum(['error', 'warn', 'info', 'debug', 'log', 'all']).optional().describe(
      'Filter messages by level. Defaults to "all" to show all message types.'
    ),
    limit: z.number().min(1).max(200).optional().describe(
      'Maximum number of most recent messages to return. Defaults to 50. Use smaller values (10-20) for quick checks, larger values (100-200) for comprehensive debugging.'
    ),
  });

  private cwd?: string;

  constructor(options: ReadConsoleMessagesOptions = {}) {
    this.cwd = options.cwd;
  }

  async execute(params: ReadConsoleMessagesParams): Promise<ToolResult> {
    const { filter = 'all', limit = 50 } = params;

    const projectId = projectIdFromPath(this.cwd);
    const viewport = getViewportInfo();
    const previewLive = isPreviewFrameMounted(projectId);

    let messages = getConsoleMessages()
      .filter(msg => filter === 'all' || msg.level === filter);

    // Always apply a limit to prevent unbounded output
    messages = messages.slice(-limit);

    const noPreviewHint = !previewLive && projectId !== undefined
      ? this.buildNoPreviewHint(viewport.isSmallScreen, true)
      : '';

    if (messages.length === 0) {
      const levelSuffix = filter !== 'all' ? ` for level: ${filter}` : '';
      return {
        content: `No console messages found${levelSuffix}.${noPreviewHint}`,
      };
    }

    const formatted = messages
      .map(msg => `[${msg.level.toUpperCase()}] ${msg.message}`)
      .join('\n');

    const suffix = filter !== 'all' ? ` (level: ${filter})` : '';
    const totalAvailable = getConsoleMessages().filter(msg => filter === 'all' || msg.level === filter).length;
    const truncatedNote = totalAvailable > messages.length ? ` (showing last ${messages.length} of ${totalAvailable})` : '';

    return {
      content: `Found ${messages.length} console message${messages.length !== 1 ? 's' : ''}${suffix}${truncatedNote}:\n\n${formatted}${noPreviewHint}`
    };
  }

  /**
   * Explain why the returned messages may be stale, so the AI doesn't start an
   * endless fix/test loop against an unmounted preview.
   */
  private buildNoPreviewHint(isSmallScreen: boolean, hasProject: boolean): string {
    if (!hasProject) {
      return '\n\n⚠️ No live preview is mounted right now, so these entries may be from an earlier preview run.';
    }

    if (isSmallScreen) {
      return '\n\n⚠️ This preview is NOT currently running: the screen is too small for the side-by-side layout, so the preview opens in its own tab and is unmounted while the user chats. These messages may be stale. Ask the user once (do not repeat every turn) to switch to the Preview tab, then read the console again — or rely on `build_project` output instead.';
    }

    return '\n\n⚠️ No live preview is mounted right now, so these messages may be from an earlier preview run. Ask the user to open the Preview tab, then read the console again.';
  }
}
