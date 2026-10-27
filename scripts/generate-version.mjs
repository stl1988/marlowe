import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

function git(command, fallback = '') {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

const versionInfo = {
  version: pkg.version,
  buildDate: new Date().toISOString(),
  commitSha: process.env.CI_COMMIT_SHORT_SHA || process.env.GITHUB_SHA?.slice(0, 8) || git('git rev-parse --short HEAD'),
  commitTag: process.env.CI_COMMIT_TAG || git('git describe --exact-match --tags HEAD'),
};

await writeFile(
  new URL('../public/version.json', import.meta.url),
  `${JSON.stringify(versionInfo, null, 2)}\n`,
  'utf8',
);

console.log(`Generated public/version.json for v${pkg.version}`);
