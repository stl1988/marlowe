import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Tool } from './Tool';

/**
 * Convert a custom Tool to OpenAI's ChatCompletionTool format
 */
export function toolToOpenAI<TParams>(name: string, tool: Tool<TParams>): OpenAI.Chat.Completions.ChatCompletionTool {
  const functionDef: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  } = {
    name,
    description: tool.description,
  };

  if (tool.inputSchema) {
    functionDef.parameters = zodToJsonSchema(tool.inputSchema) as Record<string, unknown>;
  } else {
    functionDef.parameters = { type: "object", properties: {} };
  }

  return {
    type: 'function',
    function: functionDef
  };
}
