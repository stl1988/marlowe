/**
 * Thrown when a push would overwrite remote changes that aren't present locally
 * (i.e. the local branch is not a fast-forward descendant of the remote branch).
 *
 * This is used to prevent silently clobbering work done on another device,
 * especially for Nostr/ngit remotes where the underlying git server may not
 * enforce fast-forward-only pushes itself.
 */
export class GitDivergedError extends Error {
  readonly code = 'GitDivergedError';

  constructor(message: string) {
    super(message);
    this.name = 'GitDivergedError';
  }
}
