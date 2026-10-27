export const UNKNOWN_VERSION = '0.0.0';

export interface AppVersionInfo {
  version: string;
  buildDate?: string;
  commitSha?: string;
  commitTag?: string;
}

export interface VersionCheckResult {
  current: AppVersionInfo;
  remote: AppVersionInfo | null;
  updateAvailable: boolean;
}

export function getCurrentVersion(): AppVersionInfo {
  const env = import.meta.env;
  return {
    version: env.VERSION ?? UNKNOWN_VERSION,
    buildDate: env.BUILD_DATE,
    commitSha: env.COMMIT_SHA,
    commitTag: env.COMMIT_TAG,
  };
}

/** Compare dotted release versions without treating an older remote as an update. */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => value.split('-')[0].split('.').map((part) => parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

type FetchVersion = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Check the deployed version without ever putting the app into an error state.
 * Offline, server errors, invalid payloads and unknown local versions all mean
 * "stay on the installed version".
 */
export async function checkForNewerVersion(fetchFn: FetchVersion = fetch): Promise<VersionCheckResult> {
  const current = getCurrentVersion();

  try {
    const base = typeof location !== 'undefined' ? `${location.origin}/` : '/';
    const response = await fetchFn(new URL('version.json', base), {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    });

    if (!response.ok) return { current, remote: null, updateAvailable: false };

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('version' in data) || typeof data.version !== 'string') {
      return { current, remote: null, updateAvailable: false };
    }

    const candidate = data as Record<string, unknown>;
    const remote: AppVersionInfo = {
      version: candidate.version as string,
      buildDate: typeof candidate.buildDate === 'string' ? candidate.buildDate : undefined,
      commitSha: typeof candidate.commitSha === 'string' ? candidate.commitSha : undefined,
      commitTag: typeof candidate.commitTag === 'string' ? candidate.commitTag : undefined,
    };

    return {
      current,
      remote,
      updateAvailable: current.version !== UNKNOWN_VERSION && compareVersions(remote.version, current.version) > 0,
    };
  } catch {
    return { current, remote: null, updateAvailable: false };
  }
}
