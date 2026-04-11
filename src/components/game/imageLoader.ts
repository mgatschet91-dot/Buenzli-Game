// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering
// and WebP optimization for faster loading on slow connections.

// Background color to filter from sprite sheets
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 155; // Adjust this value to be more/less aggressive

// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

// Track WebP support (detected once on first use)
let webpSupported: boolean | null = null;

// Event emitter for image loading progress (to trigger re-renders)
type ImageLoadCallback = () => void;
const imageLoadCallbacks = new Set<ImageLoadCallback>();

/**
 * Check if the browser supports WebP format
 * Uses a small test image to detect support
 */
async function checkWebPSupport(): Promise<boolean> {
  if (webpSupported !== null) {
    return webpSupported;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      webpSupported = img.width > 0 && img.height > 0;
      resolve(webpSupported);
    };
    img.onerror = () => {
      webpSupported = false;
      resolve(false);
    };
    // Tiny 1x1 WebP image
    img.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
}

/**
 * Get the WebP path for a PNG image
 */
function getWebPPath(src: string): string | null {
  if (src.endsWith('.png')) {
    return src.replace(/\.png$/, '.webp');
  }
  return null;
}

/**
 * Register a callback to be notified when images are loaded
 * @returns Cleanup function to unregister the callback
 */
export function onImageLoaded(callback: ImageLoadCallback): () => void {
  imageLoadCallbacks.add(callback);
  return () => { imageLoadCallbacks.delete(callback); };
}

/**
 * Notify all registered callbacks that an image has loaded
 */
export function notifyImageLoaded() {
  imageLoadCallbacks.forEach(cb => cb());
}

/**
 * Load an image directly without WebP optimization
 * @param src The image source path
 * @returns Promise resolving to the loaded image
 */
export function loadImageDirect(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      notifyImageLoaded();
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Load an image from a source URL, preferring WebP if available
 * @param src The image source path (PNG)
 * @returns Promise resolving to the loaded image
 */
export async function loadImage(src: string, skipWebP: boolean = false): Promise<HTMLImageElement> {
  // Return cached image if available
  if (imageCache.has(src)) {
    return imageCache.get(src)!;
  }
  
  // Check if we should try WebP
  const webpPath = !skipWebP ? getWebPPath(src) : null;
  if (webpPath) {
    const supportsWebP = await checkWebPSupport();
    
    if (supportsWebP) {
      // Try loading WebP first
      try {
        const img = await loadImageDirect(webpPath);
        // Also cache under the PNG path for future lookups
        imageCache.set(src, img);
        return img;
      } catch {
        // WebP failed (file might not exist), fall back to PNG
        console.debug(`WebP not available for ${src}, using PNG`);
      }
    }
  }
  
  // Load PNG directly
  return loadImageDirect(src);
}

/**
 * Filters colors close to the background color from an image, making them transparent
 * @param img The source image to process
 * @param threshold Maximum color distance to consider as background (default: COLOR_THRESHOLD)
 * @returns A new HTMLImageElement with filtered colors made transparent
 */
export function filterBackgroundColor(img: HTMLImageElement, threshold: number = COLOR_THRESHOLD): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting background color filtering...', { 
        imageSize: `${img.naturalWidth || img.width}x${img.naturalHeight || img.height}`,
        threshold,
        backgroundColor: BACKGROUND_COLOR
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Draw the original image to the canvas
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      console.log(`Processing ${data.length / 4} pixels...`);
      
      // Process each pixel
      let filteredCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate color distance using Euclidean distance in RGB space
        const distance = Math.sqrt(
          Math.pow(r - BACKGROUND_COLOR.r, 2) +
          Math.pow(g - BACKGROUND_COLOR.g, 2) +
          Math.pow(b - BACKGROUND_COLOR.b, 2)
        );
        
        // If the color is close to the background color, make it transparent
        if (distance <= threshold) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
          filteredCount++;
        }
      }
      
      // Debug: log filtering results
      const totalPixels = data.length / 4;
      const percentage = filteredCount > 0 ? ((filteredCount / totalPixels) * 100).toFixed(2) : '0.00';
      console.log(`Filtered ${filteredCount} pixels (${percentage}%) from sprite sheet`);
      
      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Create a new image from the processed canvas
      const filteredImg = new Image();
      filteredImg.onload = () => {
        console.log('Filtered image created successfully');
        resolve(filteredImg);
      };
      filteredImg.onerror = (error) => {
        console.error('Failed to create filtered image:', error);
        reject(new Error('Failed to create filtered image'));
      };
      filteredImg.src = canvas.toDataURL();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Loads an image and applies background color filtering if it's a sprite sheet
 * @param src The image source path
 * @param applyFilter Whether to apply background color filtering (default: true for sprite sheets)
 * @returns Promise resolving to the loaded (and optionally filtered) image
 */
export function loadSpriteImage(src: string, applyFilter: boolean = true, skipWebP: boolean = false): Promise<HTMLImageElement> {
  // Check if this is already cached (as filtered version)
  const cacheKey = applyFilter ? `${src}_filtered` : src;
  if (imageCache.has(cacheKey)) {
    return Promise.resolve(imageCache.get(cacheKey)!);
  }
  
  return loadImage(src, skipWebP).then((img) => {
    if (applyFilter) {
      return filterBackgroundColor(img).then((filteredImg: HTMLImageElement) => {
        imageCache.set(cacheKey, filteredImg);
        return filteredImg;
      });
    }
    return img;
  });
}

/**
 * Check if an image is cached
 * @param src The image source path
 * @param filtered Whether to check for the filtered version
 */
export function isImageCached(src: string, filtered: boolean = false): boolean {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.has(cacheKey);
}

/**
 * Get a cached image if available
 * @param src The image source path
 * @param filtered Whether to get the filtered version
 */
export function getCachedImage(src: string, filtered: boolean = false): HTMLImageElement | undefined {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.get(cacheKey);
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}

// In-memory cache: image src → bottom empty fraction (0..1)
const bottomOffsetCache = new Map<string, number>();

/**
 * Fetch all previously computed offsets from the server and populate
 * the in-memory cache. Call this once on app startup.
 */
export async function loadStandaloneOffsetsFromServer(): Promise<void> {
  try {
    const res = await fetch('/api/sprite-meta');
    if (!res.ok) return;
    const data: Record<string, number> = await res.json();
    for (const [key, val] of Object.entries(data)) {
      bottomOffsetCache.set(key, val);
    }
  } catch { /* network not available — will scan live */ }
}

/**
 * Scans a standalone PNG image from the bottom up and returns the fraction
 * of empty (fully-transparent) rows at the bottom of the image.
 *
 * Priority:
 *   1. In-memory cache (same session — zero cost)
 *   2. Server file  (loaded once via loadStandaloneOffsetsFromServer)
 *   3. Live pixel scan — result is saved to server so it never runs again
 *
 * @param img The already-loaded image element
 * @returns A number 0..1, e.g. 0.08 = bottom 8 % of image is transparent.
 */
export function getStandaloneBottomEmptyFraction(img: HTMLImageElement): number {
  // Use only the pathname (e.g. "/assets/buildings/fcbasel.png") as key so the
  // value works identically in dev (localhost:3000) and production.
  const src = (() => { try { return new URL(img.src).pathname; } catch { return img.src; } })();

  // 1. In-memory cache
  if (bottomOffsetCache.has(src)) {
    return bottomOffsetCache.get(src)!;
  }

  // 2. Live pixel scan (first time for this image)
  let result = 0;
  try {
    const width  = img.naturalWidth  || img.width;
    const height = img.naturalHeight || img.height;

    if (width > 0 && height > 0) {
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, width, height);

        outer: for (let y = height - 1; y >= 0; y--) {
          const rowStart = y * width * 4;
          for (let x = 0; x < width; x++) {
            // Threshold 64 (25% opacity): filters out drop-shadows / glows that are
            // barely visible but would make the building appear to float above the grid.
            if (data[rowStart + x * 4 + 3] > 64) {
              result = (height - 1 - y) / height;
              break outer;
            }
          }
        }
      }
    }
  } catch { /* canvas error — keep result = 0 */ }

  // Store in memory immediately (used for rest of this session)
  bottomOffsetCache.set(src, result);

  // Persist to server in the background (fire-and-forget)
  fetch('/api/sprite-meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: src, value: result }),
  }).catch(() => { /* ignore — next load will just scan again */ });

  return result;
}

// In-memory cache: image src → { leftEmptyFraction, rightEmptyFraction }
const horizontalBoundsCache = new Map<string, { leftEmptyFraction: number; rightEmptyFraction: number }>();

/**
 * Scans a standalone PNG image and returns the fractions of fully-transparent
 * columns on the left and right sides of the image.
 * Used to auto-center standalone buildings on their isometric footprint.
 *
 * @param img The already-loaded image element
 * @returns { leftEmptyFraction, rightEmptyFraction } in range 0..1
 */
export function getStandaloneHorizontalBounds(img: HTMLImageElement): { leftEmptyFraction: number; rightEmptyFraction: number } {
  const src = (() => { try { return new URL(img.src).pathname; } catch { return img.src; } })();

  if (horizontalBoundsCache.has(src)) return horizontalBoundsCache.get(src)!;

  const width  = img.naturalWidth  || img.width;
  const height = img.naturalHeight || img.height;
  const fallback = { leftEmptyFraction: 0, rightEmptyFraction: 0 };

  if (width <= 0 || height <= 0) return fallback;

  try {
    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;

    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, width, height);

    let leftCol = 0;
    outerLeft: for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (data[(y * width + x) * 4 + 3] > 64) { leftCol = x; break outerLeft; }
      }
    }

    let rightCol = width - 1;
    outerRight: for (let x = width - 1; x >= 0; x--) {
      for (let y = 0; y < height; y++) {
        if (data[(y * width + x) * 4 + 3] > 64) { rightCol = x; break outerRight; }
      }
    }

    const result = {
      leftEmptyFraction:  leftCol / width,
      rightEmptyFraction: (width - 1 - rightCol) / width,
    };
    horizontalBoundsCache.set(src, result);
    return result;
  } catch {
    return fallback;
  }
}

/**
 * Preload all game assets for a given sprite pack.
 * Loads all sprite sheets into the cache so they're instantly available when the game renders.
 * @param pack The sprite pack to preload
 * @param onProgress Callback with (loaded, total) for progress tracking
 */
export async function preloadGameAssets(
  pack: { src: string; constructionSrc?: string; abandonedSrc?: string; denseSrc?: string; modernSrc?: string; parksSrc?: string; parksConstructionSrc?: string; farmsSrc?: string; shopsSrc?: string; stationsSrc?: string; servicesSrc?: string; infrastructureSrc?: string; mansionsSrc?: string; treesSrc?: string; standaloneSrcs?: Record<string, { normal: string; construction?: string; abandoned?: string }> },
  waterPath: string,
  airplanePath: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const tasks: Array<() => Promise<unknown>> = [];

  tasks.push(() => loadSpriteImage(pack.src, true));
  tasks.push(() => loadImage(waterPath));

  const optionalSheets: (string | undefined)[] = [
    pack.constructionSrc, pack.abandonedSrc, pack.denseSrc, pack.modernSrc,
    pack.parksSrc, pack.parksConstructionSrc, pack.farmsSrc, pack.shopsSrc,
    pack.stationsSrc, pack.servicesSrc, pack.infrastructureSrc,
    pack.mansionsSrc, pack.treesSrc,
  ];
  for (const src of optionalSheets) {
    if (src) tasks.push(() => loadSpriteImage(src, true));
  }

  if (pack.standaloneSrcs) {
    for (const cfg of Object.values(pack.standaloneSrcs)) {
      tasks.push(() => loadSpriteImage(cfg.normal, false, true));
      const conSrc = cfg.construction;
      const abaSrc = cfg.abandoned;
      if (conSrc) tasks.push(() => loadSpriteImage(conSrc, false, true));
      if (abaSrc) tasks.push(() => loadSpriteImage(abaSrc, false, true));
    }
  }

  tasks.push(() => loadSpriteImage(airplanePath, false));

  const total = tasks.length;
  let loaded = 0;
  onProgress?.(0, total);

  await Promise.all(
    tasks.map(task =>
      task()
        .catch(err => console.warn('[Preload] Asset fehlgeschlagen:', err))
        .finally(() => { loaded++; onProgress?.(loaded, total); })
    )
  );
}
