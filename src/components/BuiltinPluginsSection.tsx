import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAISettings } from '@/hooks/useAISettings';
import { Wrench } from 'lucide-react';

/**
 * Metadata for each built-in tool the AI can use.
 * Category helps group them in the UI.
 */
export const BUILTIN_TOOL_DEFINITIONS: Array<{
  name: string;
  label: string;
  description: string;
  category: 'files' | 'git' | 'build' | 'nostr' | 'web' | 'misc';
  dangerous?: boolean;
}> = [
  // File operations
  { name: 'read', label: 'Read', description: 'Read file contents and directory listings', category: 'files' },
  { name: 'write', label: 'Write', description: 'Create or overwrite files with new content', category: 'files', dangerous: true },
  { name: 'edit', label: 'Edit', description: 'Make targeted string replacements in files', category: 'files', dangerous: true },
  { name: 'glob', label: 'Glob', description: 'Find files matching glob patterns', category: 'files' },
  { name: 'grep', label: 'Grep', description: 'Search file contents with regex patterns', category: 'files' },
  { name: 'shell', label: 'Shell', description: 'Execute shell commands in the project environment', category: 'misc', dangerous: true },
  // Git
  { name: 'git_commit', label: 'Git Commit', description: 'Commit staged changes to the project\'s Git repository', category: 'git' },
  // Build
  { name: 'build_project', label: 'Build Project', description: 'Compile and build the project with esbuild', category: 'build' },
  { name: 'npm_add_package', label: 'Add npm Package', description: 'Install npm packages into the project', category: 'build' },
  { name: 'npm_remove_package', label: 'Remove npm Package', description: 'Uninstall npm packages from the project', category: 'build' },
  // Nostr
  { name: 'nostr_read_nip', label: 'Read NIP', description: 'Read Nostr Improvement Proposal documents', category: 'nostr' },
  { name: 'nostr_fetch_event', label: 'Fetch Event', description: 'Fetch Nostr events by NIP-19 identifier', category: 'nostr' },
  { name: 'nostr_read_kind', label: 'Read Kind Docs', description: 'Read documentation for a Nostr event kind', category: 'nostr' },
  { name: 'nostr_read_tag', label: 'Read Tag Docs', description: 'Read documentation for a Nostr event tag', category: 'nostr' },
  { name: 'nostr_read_protocol', label: 'Read Protocol Docs', description: 'Read Nostr protocol basics documentation', category: 'nostr' },
  { name: 'nostr_read_nips_index', label: 'Read NIPs Index', description: 'List all Nostr NIPs, kinds, and tags', category: 'nostr' },
  { name: 'nostr_generate_kind', label: 'Generate Kind', description: 'Generate an unused Nostr event kind number', category: 'nostr' },
  { name: 'nostr_publish_events', label: 'Publish Events', description: 'Publish Nostr events using an ephemeral keypair', category: 'nostr', dangerous: true },
  { name: 'nostr_encode', label: 'Encode NIP-19', description: 'Encode hex values into NIP-19 bech32 entities', category: 'nostr' },
  { name: 'nostr_decode', label: 'Decode NIP-19', description: 'Decode NIP-19 bech32 entities to hex', category: 'nostr' },
  // Web
  { name: 'webfetch', label: 'Web Fetch', description: 'Fetch and read content from web URLs', category: 'web' },
  { name: 'websearch', label: 'Web Search', description: 'Search the web using Exa AI', category: 'web' },
  { name: 'blossom_upload', label: 'Blossom Upload', description: 'Upload files from the project to Blossom media hosting', category: 'web' },
  { name: 'read_console_messages', label: 'Console Messages', description: 'Read console messages from the project preview', category: 'misc' },
  // App management
  { name: 'app', label: 'App (NIP-89)', description: 'View and update the project\'s Nostr NIP-89 app listing', category: 'nostr' },
  // Misc
  { name: 'skill', label: 'Skill Loader', description: 'Load skill documents for specific tasks', category: 'misc' },
  { name: 'todowrite', label: 'Todo Write', description: 'Create and manage a task list for the current session', category: 'misc' },
  { name: 'todoread', label: 'Todo Read', description: 'Read the current session task list', category: 'misc' },
];

const CATEGORY_LABELS: Record<string, string> = {
  files: 'File Operations',
  git: 'Git',
  build: 'Build & Packages',
  nostr: 'Nostr Protocol',
  web: 'Web & Media',
  misc: 'Miscellaneous',
};

const CATEGORY_ORDER = ['files', 'git', 'build', 'nostr', 'web', 'misc'];

export function BuiltinPluginsSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAISettings();
  const disabledTools = new Set(settings.disabledBuiltinTools ?? []);

  const toggleTool = (toolName: string) => {
    const current = new Set(settings.disabledBuiltinTools ?? []);
    if (current.has(toolName)) {
      current.delete(toolName);
    } else {
      current.add(toolName);
    }
    updateSettings({ disabledBuiltinTools: [...current] });
  };

  const enabledCount = BUILTIN_TOOL_DEFINITIONS.length - disabledTools.size;

  // Group by category
  const byCategory = CATEGORY_ORDER.reduce<Record<string, typeof BUILTIN_TOOL_DEFINITIONS>>((acc, cat) => {
    acc[cat] = BUILTIN_TOOL_DEFINITIONS.filter(t => t.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('builtinTools', 'Built-in Tools')}</h3>
          <Badge variant="secondary" className="ml-auto text-xs">
            {enabledCount} / {BUILTIN_TOOL_DEFINITIONS.length} enabled
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('builtinToolsDescription', 'Control which built-in tools are available to the AI during a chat session.')}
        </p>
      </div>

      {/* Tool groups */}
      <div className="space-y-5">
        {CATEGORY_ORDER.map(cat => {
          const tools = byCategory[cat];
          if (!tools?.length) return null;
          return (
            <div key={cat} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="space-y-1">
                {tools.map(tool => {
                  const enabled = !disabledTools.has(tool.name);
                  return (
                    <div
                      key={tool.name}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Switch
                        id={`tool-${tool.name}`}
                        checked={enabled}
                        onCheckedChange={() => toggleTool(tool.name)}
                      />
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={`tool-${tool.name}`}
                          className="text-sm font-medium cursor-pointer flex items-center gap-2"
                        >
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{tool.name}</span>
                          {tool.label}
                          {tool.dangerous && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/50 text-amber-600 dark:text-amber-400">
                              writes
                            </Badge>
                          )}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
