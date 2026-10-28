import type z from "zod";

export interface ToolResult {
  content: string;
  /** Images (data URLs) shown to the model alongside this tool's text result. */
  images?: string[];
  cost?: number;
}

export interface Tool<TParams> {
  description: string;
  inputSchema?: z.ZodType<TParams>;
  execute(args: TParams): Promise<ToolResult>;
}
