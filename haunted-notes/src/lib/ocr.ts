// tesseract.js is heavy: it is loaded with a dynamic import() the first time the
// Photo tab is used, never in the initial bundle.
let tesseractModule: Promise<typeof import('tesseract.js')> | null = null;

/** Start (or reuse) the dynamic import of the OCR engine. Safe to call repeatedly. */
export function loadOcrEngine(): Promise<typeof import('tesseract.js')> {
  if (!tesseractModule) {
    tesseractModule = import('tesseract.js').catch((err) => {
      tesseractModule = null; // allow a retry after a failed fetch
      throw err;
    });
  }
  return tesseractModule;
}

const MAX_WIDTH = 2500;
const SCALE   = 2;
// Contrast threshold: pixels brighter than this become white, darker become black.
// 0–255; 128 is neutral. Higher values push more mid-tones to black.
const THRESHOLD = 140;

/**
 * Preprocess an image file on a canvas for better OCR accuracy:
 *   1. Decode to an ImageBitmap (works in both browser and worker contexts)
 *   2. Upscale ×2, capping at MAX_WIDTH
 *   3. Convert to greyscale
 *   4. Apply a hard-threshold for contrast (each pixel → pure black or white)
 *
 * Returns a Blob (PNG) ready to hand to Tesseract.
 */
async function preprocessImage(file: File): Promise<Blob> {
  // Decode the image
  const bitmap = await createImageBitmap(file);

  const srcW = bitmap.width;
  const srcH = bitmap.height;

  // Scale up by 2×, but never exceed MAX_WIDTH
  const factor = Math.min(SCALE, MAX_WIDTH / srcW);
  const dstW = Math.round(srcW * factor);
  const dstH = Math.round(srcH * factor);

  const canvas = document.createElement('canvas');
  canvas.width  = dstW;
  canvas.height = dstH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context for image preprocessing.');

  // Draw scaled image
  ctx.drawImage(bitmap, 0, 0, dstW, dstH);
  bitmap.close();

  // Get pixel data and apply greyscale + threshold in one pass
  const imageData = ctx.getImageData(0, 0, dstW, dstH);
  const data = imageData.data; // Uint8ClampedArray: [R,G,B,A, R,G,B,A, …]

  for (let i = 0; i < data.length; i += 4) {
    // Luminance-weighted greyscale (ITU-R BT.601)
    const grey = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Hard threshold → binary black/white
    const binary = grey >= THRESHOLD ? 255 : 0;
    data[i]     = binary; // R
    data[i + 1] = binary; // G
    data[i + 2] = binary; // B
    // data[i + 3] = alpha — leave untouched
  }

  ctx.putImageData(imageData, 0, 0);

  // Export as PNG blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}

/**
 * Run OCR on an image file and return the extracted text.
 * The image is preprocessed (greyscale + upscale + threshold) before recognition.
 * Progress is reported via the optional callback (0–100).
 */
export async function extractTextFromImage(
  imageFile: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  let input: Blob;
  try {
    input = await preprocessImage(imageFile);
  } catch {
    // If preprocessing fails (e.g. unsupported format), fall back to raw file
    input = imageFile;
  }

  // CommonJS interop: the module may arrive as the namespace itself or under `default`
  const mod = await loadOcrEngine();
  const Tesseract = (mod as { default?: typeof mod }).default ?? mod;
  const result = await Tesseract.recognize(input, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  return result.data.text.trim();
}
