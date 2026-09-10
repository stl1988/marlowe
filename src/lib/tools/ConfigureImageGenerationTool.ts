import { z } from 'zod';
import type { Tool, ToolResult } from './Tool';
import type { AISettingsContextType } from '@/contexts/AISettingsContext';
import { DEFAULT_FAL_FALLBACK_MODEL, isFalProvider } from '@/lib/falai';

interface ConfigureImageGenerationParams {
  modelId: string;
}

interface ProviderModel {
  id: string;
  name?: string;
  provider: string;
  fullId: string;
  description?: string;
  contextLength?: number;
  modalities?: string[];
}

export class ConfigureImageGenerationTool implements Tool<ConfigureImageGenerationParams> {
  readonly description = 'Configure the AI model to use for image generation. The modelId must be a complete model identifier in the format "provider/model" (e.g., "openrouter/openai/gpt-image-1", "openai/dall-e-3", "shakespeare/gpt-image-1", or "fal/openai/gpt-image-2.5/flare/text-to-image" for fal.ai — fal.ai model paths contain multiple slashes). You can optionally call view_available_models first to see available image models, but any valid model ID from a configured provider will work. If a fal.ai provider is configured, prefer its fal.ai model paths. Otherwise prefer gpt-image-1 as the first choice, followed by gemini-3-pro-image, unless the user has specific requirements.';

  readonly inputSchema = z.object({
    modelId: z.string().describe('The complete model identifier in "provider/model" format (e.g., "openrouter/openai/gpt-image-1", "openai/dall-e-3").'),
  });

  constructor(
    private aiSettings: AISettingsContextType,
    private models: ProviderModel[],
  ) {}

  async execute(args: ConfigureImageGenerationParams): Promise<ToolResult> {
    const { modelId } = args;

    // Validate model ID format
    if (!modelId.includes('/')) {
      return { content: 'ERROR: Invalid model ID format. The modelId must be in "provider/model" format (e.g., "openrouter/openai/gpt-image-1" or "openai/dall-e-3").' };
    }

    // Check if model exists in available models (optional - provides helpful info if available)
    const model = this.models.find(m => m.fullId === modelId);

    // Update the settings
    this.aiSettings.updateSettings({ imageModel: modelId });

    // When configuring a fal.ai model, also preset the fallback model path
    // (fal.ai generation automatically falls back to it on failure)
    const providerId = modelId.slice(0, modelId.indexOf('/'));
    const provider = this.aiSettings.settings.providers.find(p => p.id === providerId);
    if (provider && isFalProvider(provider) && !this.aiSettings.settings.imageModelFallback) {
      this.aiSettings.updateSettings({ imageModelFallback: `${provider.id}/${DEFAULT_FAL_FALLBACK_MODEL}` });
    }

    let response = `✅ Successfully configured image generation!\n\n`;
    response += `**Image Model**: ${modelId}\n`;

    if (model?.name) {
      response += `**Name**: ${model.name}\n`;
    }

    if (model?.description) {
      response += `**Description**: ${model.description}\n`;
    }

    response += `\nThe generate_image tool is now available and ready to use. You can generate images by calling the generate_image tool with a detailed text prompt.`;

    return { content: response };
  }
}
