/**
 * Viewport and preview-visibility helpers.
 *
 * These are used in two places:
 *
 * 1. `makeSystemPrompt()` — so the AI knows whether it is running on a small
 *    screen (where the preview is a separate tab and is not mounted while the
 *    user is chatting) and whether a preview iframe is currently alive.
 * 2. `ReadConsoleMessagesTool` — so console output is not misinterpreted when
 *    no preview frame exists to produce fresh messages.
 *
 * Everything here is plain module state (no React) so it can be read from
 * non-component code such as the tool and the system prompt builder.
 */

/**
 * Width (in px) below which Marlowe switches to its small-screen layout.
 * Mirrored by `useIsMobile`, which imports this constant, so the UI and the
 * AI-facing helpers always agree on the threshold.
 */
export const SMALL_SCREEN_BREAKPOINT = 1080;

export interface ViewportInfo {
  /** Viewport width in CSS pixels (`0` when unavailable, e.g. during SSR/tests). */
  width: number;
  /** Viewport height in CSS pixels (`0` when unavailable). */
  height: number;
  /** True when the small-screen (single-pane) layout is active. */
  isSmallScreen: boolean;
}

/** Read the current viewport size in a safe, environment-agnostic way. */
export function getViewportInfo(): ViewportInfo {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, isSmallScreen: false };
  }

  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;

  return {
    width,
    height,
    isSmallScreen: width > 0 && width < SMALL_SCREEN_BREAKPOINT,
  };
}

/**
 * Projects whose preview iframe is currently mounted and rendering.
 *
 * On small screens the whole preview pane is unmounted while the user is in
 * the chat tab, so this set is empty most of the time. Without a mounted
 * iframe, no console messages can arrive — existing ones are leftovers from an
 * earlier preview run.
 */
const mountedPreviewFrames = new Set<string>();

/** Called by the preview pane when its iframe is mounted. */
export function registerPreviewFrame(projectId: string): void {
  mountedPreviewFrames.add(projectId);
}

/** Called by the preview pane when its iframe unmounts (or the project changes). */
export function unregisterPreviewFrame(projectId: string): void {
  mountedPreviewFrames.delete(projectId);
}

/** Whether a preview iframe is currently mounted (for a project, or at all). */
export function isPreviewFrameMounted(projectId?: string): boolean {
  if (projectId) return mountedPreviewFrames.has(projectId);
  return mountedPreviewFrames.size > 0;
}

/** Project id derived from a project directory path, e.g. `/projects/foo` → `foo`. */
export function projectIdFromPath(cwd: string | undefined): string | undefined {
  if (!cwd) return undefined;
  const parts = cwd.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}
