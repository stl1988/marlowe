/**
 * Canonical list of every command registered in the virtual shell, sorted
 * alphabetically.
 *
 * This is the single source of truth used by the default AI system prompt
 * (see `src/lib/system.ts`) so that agents know up front which commands exist
 * and never attempt non-existent ones (e.g. `npm`, `node`, `python`).
 *
 * It must stay in sync with the command registry built in
 * `src/lib/tools/ShellTool.ts` — when you add or remove a command there,
 * update this list. `ShellTool.getCommandNames()` returns the live registry
 * names for comparison. (The executor's "command not found" error message is
 * generated dynamically from the same registry, so it always agrees.)
 *
 * Shell built-ins handled directly by the executor (`true`, `false`, `:`,
 * `export`, `unset`, `exit`, `test` / `[`) are intentionally not listed here.
 */
export const AVAILABLE_SHELL_COMMAND_NAMES: readonly string[] = [
  'cat',
  'cd',
  'clear',
  'cp',
  'curl',
  'cut',
  'date',
  'diff',
  'echo',
  'env',
  'find',
  'git',
  'grep',
  'head',
  'hexdump',
  'ls',
  'mkdir',
  'mv',
  'pwd',
  'rm',
  'sed',
  'shakespeare',
  'sort',
  'tail',
  'touch',
  'tr',
  'uniq',
  'unzip',
  'wc',
  'which',
  'whoami',
];
