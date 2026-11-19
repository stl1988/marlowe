import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import { buildProject } from "../build";
import { getViewportInfo, isPreviewFrameMounted, projectIdFromPath } from "../viewport";

export class BuildProjectTool implements Tool<void> {
  private fs: JSRuntimeFS;
  private cwd: string;
  private esmUrl: string;

  readonly description = "Build the project using esbuild-wasm. Creates optimized production files in the dist directory, making the site preview visible to the user (or updating the existing preview) and ready for deployment. This tool also helps verify that your changes are correct. ALWAYS call this tool when you have finished making changes.";

  constructor(fs: JSRuntimeFS, cwd: string, esmUrl: string) {
    this.fs = fs;
    this.cwd = cwd;
    this.esmUrl = esmUrl;
  }

  async execute(): Promise<ToolResult> {
    try {
      // Build and write the project files
      const result = await buildProject({
        esmUrl: this.esmUrl,
        fs: this.fs,
        projectPath: this.cwd,
        domParser: new DOMParser(),
        versionInfo: {
          version: import.meta.env.VERSION ?? '0.0.0',
          buildDate: new Date().toISOString(),
        },
      });

      const fileCount = Object.keys(result.files).length;
      const fileList = Object.keys(result.files).map(file => `  📄 ${file}`).join('\n');

      return {
        content: `✅ Successfully built project!\n\n📁 Output: ${result.outputPath}\n📦 Files generated: ${fileCount}\n\n${fileList}\n\n🚀 Your project is ready for deployment!${this.buildVisibilityNote()}`
      };
    } catch (error) {
      throw new Error(`❌ Build failed: ${String(error)}`);
    }
  }

  /**
   * Tell the AI whether the freshly built preview is actually visible.
   *
   * On small screens the preview lives in its own tab, so a successful build
   * does not mean the user is looking at it. This prevents pointless console
   * reads right after a build ("the preview shows nothing!").
   */
  private buildVisibilityNote(): string {
    const viewport = getViewportInfo();
    const projectId = projectIdFromPath(this.cwd);

    if (isPreviewFrameMounted(projectId)) return '';

    if (viewport.isSmallScreen) {
      return `\n\nℹ️ The preview is NOT mounted (small screen: Chat/Preview/Code are separate tabs), so the user cannot see the result until they switch to the Preview tab. Do not read the console now — the build output above is the authoritative result. Mention the Preview tab at most once.`;
    }

    return `\n\nℹ️ The preview is not mounted right now; the user needs the Preview tab open to see the result. Do not read the console until it is mounted.`;
  }
}
