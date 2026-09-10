import type { AIProvider } from '@/contexts/AISettingsContext';
import { proxyUrl } from './proxyUrl';

/** Default main model path used when a fal.ai provider is configured. */
export const DEFAULT_FAL_MAIN_MODEL = 'openai/gpt-image-2.5/flare/text-to-image';

/** Default fallback model path used when the main fal.ai model fails. */
export const DEFAULT_FAL_FALLBACK_MODEL = 'fal-ai/bytedance/seedream/v4/text-to-image';

/**
 * Check whether a provider points to fal.ai. fal.ai is not an
 * OpenAI-compatible API and must be called through its own protocol.
 */
export function isFalProvider(provider: AIProvider): boolean {
  if (provider.id === 'fal') return true;
  try {
    const { hostname } = new URL(provider.baseURL);
    return hostname === 'fal.run' || hostname === 'queue.fal.run' || hostname.endsWith('.fal.run');
  } catch {
    return false;
  }
}

/** Synthetic model-list entry for a fal.ai model path (fal.ai has no OpenAI-style /models endpoint). */
export interface FalImageModelInfo {
  id: string;
  type: 'image';
  name: string;
  provider: string;
  fullId: string;
}

/**
 * Build model-list entries for a configured fal.ai provider, covering the
 * preset main/fallback paths plus any custom paths stored in settings.
 * This lets fal.ai models show up in model listings (e.g. the
 * view_available_models tool) even though they can't be fetched from an API.
 */
export function getFalImageModels(
  provider: AIProvider,
  ...configured: Array<string | undefined>
): FalImageModelInfo[] {
  const prefix = `${provider.id}/`;
  const paths = new Set<string>([DEFAULT_FAL_MAIN_MODEL, DEFAULT_FAL_FALLBACK_MODEL]);

  for (const value of configured) {
    if (value?.startsWith(prefix)) {
      paths.add(value.slice(prefix.length));
    }
  }

  const names: Record<string, string> = {
    [DEFAULT_FAL_MAIN_MODEL]: 'GPT Image 2.5 Flare',
    [DEFAULT_FAL_FALLBACK_MODEL]: 'Seedream 4.0',
  };

  return [...paths].map((path) => ({
    id: path,
    type: 'image' as const,
    name: names[path] ?? path,
    provider: provider.id,
    fullId: `${prefix}${path}`,
  }));
}

/** Effective image model configuration (main + fallback), in provider/model format. */
export interface ResolvedImageModel {
  main?: string;
  fallback?: string;
}

/**
 * Resolve the effective image model settings. When no image model is
 * configured but a fal.ai provider exists, the fal.ai preset main model is
 * used (fal.ai paths are preset in Settings > AI and may never have been
 * persisted). fal.ai mains also get the preset fallback when none is set.
 */
export function resolveImageModel(settings: {
  providers: AIProvider[];
  imageModel?: string;
  imageModelFallback?: string;
}): ResolvedImageModel {
  const falProvider = settings.providers.find(isFalProvider);
  const main = settings.imageModel ?? (falProvider ? `${falProvider.id}/${DEFAULT_FAL_MAIN_MODEL}` : undefined);

  let fallback = settings.imageModelFallback;
  if (!fallback && falProvider && main?.startsWith(`${falProvider.id}/`)) {
    const mainPath = main.slice(falProvider.id.length + 1);
    if (mainPath !== DEFAULT_FAL_FALLBACK_MODEL) {
      fallback = `${falProvider.id}/${DEFAULT_FAL_FALLBACK_MODEL}`;
    }
  }

  return { main, fallback };
}

export interface FalImageParams {
  prompt: string;
  output_format?: 'png' | 'jpeg' | 'webp';
  output_compression?: number;
  size?: string;
  background?: 'transparent' | 'opaque' | 'auto';
}

export interface FalImageResult {
  imageData: Uint8Array;
  extension: string;
}

interface FalQueueSubmit {
  request_id: string;
  status_url: string;
  response_url: string;
}

/** Sleep for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract a human-readable message from a fal.ai error response body. */
function falErrorMessage(status: number, body: string): string {
  try {
    const data = JSON.parse(body) as {
      detail?: string | Array<{ msg?: string }>;
      error?: string;
      message?: string;
    };
    if (typeof data.detail === 'string') return `fal.ai error ${status}: ${data.detail}`;
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const msgs = data.detail.map((d) => d.msg).filter(Boolean).join('; ');
      if (msgs) return `fal.ai error ${status}: ${msgs}`;
    }
    if (data.message) return `fal.ai error ${status}: ${data.message}`;
    if (data.error) return `fal.ai error ${status}: ${data.error}`;
  } catch {
    // Not JSON — fall through to raw body
  }
  return `fal.ai error ${status}: ${body.slice(0, 300) || 'Unknown error'}`;
}

/**
 * Generate an image using the fal.ai queue API.
 *
 * fal.ai is not OpenAI-compatible: requests are submitted to a queue
 * endpoint and polled until completion. Authentication uses an
 * `Authorization: Key <apiKey>` header instead of a Bearer token.
 *
 * Flow: POST https://queue.fal.run/{model} → poll status_url → GET response_url.
 */
export async function generateImageWithFal(
  provider: AIProvider,
  model: string,
  params: FalImageParams,
  corsProxy?: string,
): Promise<FalImageResult> {
  if (!provider.apiKey) {
    throw new Error('fal.ai requires an API key. Add one in Settings > AI.');
  }

  const { prompt, output_format, output_compression, size, background } = params;

  // Build the request body. `prompt` is required by all fal.ai image models;
  // optional parameters are only included when provided, since support varies
  // by model (e.g. Seedream does not accept background/output_format).
  const fullBody: Record<string, unknown> = { prompt };
  if (size && size !== 'auto') {
    const match = size.match(/^(\d+)x(\d+)$/);
    if (match) {
      fullBody.image_size = { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
    }
  }
  if (background && background !== 'auto') {
    fullBody.background = background;
  }
  if (output_format) {
    fullBody.output_format = output_format;
  }
  if (typeof output_compression === 'number' && (output_format === 'jpeg' || output_format === 'webp')) {
    fullBody.output_compression = output_compression;
  }

  // Derive the queue base URL from the provider base URL
  // (https://fal.run → https://queue.fal.run).
  let queueBase: string;
  try {
    const url = new URL(provider.baseURL);
    url.hostname = url.hostname === 'fal.run' ? 'queue.fal.run' : url.hostname;
    queueBase = url.origin;
  } catch {
    queueBase = 'https://queue.fal.run';
  }

  const wrap = (url: string) =>
    provider.proxy && corsProxy ? proxyUrl({ template: corsProxy, url }) : url;

  const headers: Record<string, string> = {
    'Authorization': `Key ${provider.apiKey}`,
    'Content-Type': 'application/json',
  };

  // Submit the request to the queue. If the model rejects the request with a
  // validation error (HTTP 400/422), retry once with only the required prompt
  // field — parameter support varies across fal.ai models.
  const submit = async (body: Record<string, unknown>): Promise<Response> =>
    fetch(wrap(`${queueBase}/${model}`), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

  let submitResponse = await submit(fullBody);

  if ((submitResponse.status === 400 || submitResponse.status === 422) && Object.keys(fullBody).length > 1) {
    submitResponse = await submit({ prompt });
  }

  if (!submitResponse.ok) {
    throw new Error(falErrorMessage(submitResponse.status, await submitResponse.text()));
  }

  const queue = (await submitResponse.json()) as Partial<FalQueueSubmit>;
  if (!queue.status_url || !queue.response_url) {
    throw new Error('Invalid response from fal.ai queue: missing status or response URL');
  }

  // Poll the status URL until the request completes (max ~3 minutes).
  const maxAttempts = 120;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(1500);

    const statusResponse = await fetch(wrap(queue.status_url), { headers });
    if (!statusResponse.ok) {
      throw new Error(falErrorMessage(statusResponse.status, await statusResponse.text()));
    }

    const status = (await statusResponse.json()) as { status?: string; error?: string };
    if (status.status === 'COMPLETED') break;
    if (status.status === 'FAILED' || status.status === 'CANCELLED') {
      throw new Error(`fal.ai generation ${status.status.toLowerCase()}${status.error ? `: ${status.error}` : ''}`);
    }
    if (attempt === maxAttempts - 1) {
      throw new Error('fal.ai generation timed out after 3 minutes');
    }
  }

  // Fetch the generation result.
  const resultResponse = await fetch(wrap(queue.response_url), { headers });
  if (!resultResponse.ok) {
    throw new Error(falErrorMessage(resultResponse.status, await resultResponse.text()));
  }

  const result = (await resultResponse.json()) as {
    images?: Array<{ url?: string; content_type?: string }>;
    image?: { url?: string; content_type?: string };
  };

  const image = result.images?.[0] ?? result.image;
  if (!image?.url) {
    throw new Error('No image returned from fal.ai');
  }

  // Download the generated image bytes.
  const imageResponse = await fetch(wrap(image.url));
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image from fal.ai: ${imageResponse.status} ${imageResponse.statusText}`);
  }

  const imageData = new Uint8Array(await imageResponse.arrayBuffer());

  // Determine the file extension from the content type.
  let extension = output_format ?? 'png';
  const contentType = image.content_type ?? imageResponse.headers.get('content-type') ?? '';
  const match = contentType.match(/image\/([^;]+)/);
  if (match && (match[1] === 'png' || match[1] === 'jpeg' || match[1] === 'webp')) {
    extension = match[1];
  }

  return { imageData, extension };
}
