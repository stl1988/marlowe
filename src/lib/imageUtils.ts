export interface ResizeOptions {
  /** Maximum width or height in pixels (default: 2048) */
  maxDimension?: number;
  /** Maximum file size in bytes (default: 5MB) */
  maxFileSize?: number;
  /** JPEG quality 0-1 (default: 0.92) */
  quality?: number;
}

/** Image types accepted by the OpenAI-compatible vision APIs we support. */
const API_IMAGE_TYPES = ['image/png', 'image/jpeg'];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Load an image for inspection/conversion, always releasing its object URL. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/** Return the pixel dimensions of an image file. */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const img = await loadImage(file);
  return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

/** Resize an image without enlarging it, optionally changing its MIME type. */
async function resizeImage(
  file: File,
  maxDimension: number,
  quality: number,
  type = file.type || 'image/jpeg',
): Promise<File> {
  const img = await loadImage(file);
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = (height / width) * maxDimension;
      width = maxDimension;
    } else {
      width = (width / height) * maxDimension;
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to get canvas context');

  // A white background keeps transparent PNG/WebP artwork readable when an API
  // requires JPEG. It does not alter the original file in the VFS.
  if (type === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('Failed to create image blob');
  return new File([blob], file.name, { type: blob.type, lastModified: Date.now() });
}

/** Resize an image only when its file size or dimensions require it. */
export async function resizeImageIfNeeded(file: File, opts: ResizeOptions = {}): Promise<File> {
  const {
    maxDimension = 2048,
    maxFileSize = 5 * 1024 * 1024,
    quality = 0.92,
  } = opts;

  if (!file.type.startsWith('image/')) return file;

  if (file.size <= maxFileSize) {
    const dimensions = await getImageDimensions(file);
    if (dimensions.width <= maxDimension && dimensions.height <= maxDimension) return file;
  }
  return resizeImage(file, maxDimension, quality);
}

/**
 * Convert WebP, GIF, BMP and other image types to PNG for the vision API.
 * The source file on disk is never rewritten; this only prepares the view sent
 * to the model.
 */
export async function toApiImage(file: File): Promise<File> {
  if (API_IMAGE_TYPES.includes(file.type)) return file;
  const { width, height } = await getImageDimensions(file);
  return resizeImage(file, Math.max(width, height), 1, 'image/png');
}

export interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Crop a region and enlarge it with sharp nearest-neighbor pixels. */
export async function cropImage(
  file: File,
  region: ImageRegion,
  minSize = 1024,
  maxScale = 8,
): Promise<{ file: File; region: ImageRegion; scale: number }> {
  const img = await loadImage(file);
  const x = Math.max(0, Math.min(Math.floor(region.x), img.width - 1));
  const y = Math.max(0, Math.min(Math.floor(region.y), img.height - 1));
  const width = Math.max(1, Math.min(Math.ceil(region.width), img.width - x));
  const height = Math.max(1, Math.min(Math.ceil(region.height), img.height - y));
  const scale = Math.max(1, Math.min(maxScale, Math.floor(minSize / Math.max(width, height))));

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to get canvas context');
  context.imageSmoothingEnabled = false;
  context.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to create image crop');
  return {
    file: new File([blob], `${file.name.replace(/\.[^.]*$/, '')}-crop.png`, { type: 'image/png' }),
    region: { x, y, width, height },
    scale,
  };
}

/** Convert a File to a base64 data URL for the vision API or the chat UI. */
export async function fileToUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => reject(new Error(getErrorMessage(reader.error)));
    reader.readAsDataURL(file);
  });
}
