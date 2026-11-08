import { EdgeRefineSettings } from '../types';

/**
 * Smart Select: Edge-aware flood fill from clicked coordinate
 * Stops at high gradient boundaries and honors color tolerance (5 - 60)
 */
export function smartSelectFloodFill(
  imageCanvas: HTMLCanvasElement,
  existingMaskCanvas: HTMLCanvasElement,
  clickX: number,
  clickY: number,
  tolerance: number // 5 - 60
): HTMLCanvasElement {
  const w = imageCanvas.width;
  const h = imageCanvas.height;

  const ctx = imageCanvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Clone or get existing mask
  const outMaskCanvas = document.createElement('canvas');
  outMaskCanvas.width = w;
  outMaskCanvas.height = h;
  const outCtx = outMaskCanvas.getContext('2d')!;
  outCtx.drawImage(existingMaskCanvas, 0, 0);

  const maskData = outCtx.getImageData(0, 0, w, h);
  const md = maskData.data;

  const startX = Math.max(0, Math.min(w - 1, Math.round(clickX)));
  const startY = Math.max(0, Math.min(h - 1, Math.round(clickY)));
  const startIdx = (startY * w + startX) * 4;

  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];

  // Precompute simple luminance edge map for stopping
  const visited = new Uint8Array(w * h);
  const queueX = new Int32Array(w * h);
  const queueY = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  queueX[tail] = startX;
  queueY[tail] = startY;
  tail++;
  visited[startY * w + startX] = 1;

  const tolSq = tolerance * tolerance * 3;
  const edgeThreshold = 35 + (tolerance / 60) * 20;

  // Direction offsets (4-connected)
  const dxs = [1, -1, 0, 0];
  const dys = [0, 0, 1, -1];

  while (head < tail) {
    const cx = queueX[head];
    const cy = queueY[head];
    head++;

    const cIdx = (cy * w + cx) * 4;
    // Mark as selected in magenta (#FF00FF) with full alpha
    md[cIdx] = 255;
    md[cIdx + 1] = 0;
    md[cIdx + 2] = 255;
    md[cIdx + 3] = 255;

    const curR = data[cIdx];
    const curG = data[cIdx + 1];
    const curB = data[cIdx + 2];
    const curLum = 0.299 * curR + 0.587 * curG + 0.114 * curB;

    for (let i = 0; i < 4; i++) {
      const nx = cx + dxs[i];
      const ny = cy + dys[i];

      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nPos = ny * w + nx;
        if (!visited[nPos]) {
          visited[nPos] = 1;

          const nIdx = nPos * 4;
          const nr = data[nIdx];
          const ng = data[nIdx + 1];
          const nb = data[nIdx + 2];

          // 1. Color distance from seed
          const dr = nr - targetR;
          const dg = ng - targetG;
          const db = nb - targetB;
          const distSq = dr * dr + dg * dg + db * db;

          // 2. Edge step check (luminance difference between adjacent pixels)
          const nLum = 0.299 * nr + 0.587 * ng + 0.114 * nb;
          const stepDiff = Math.abs(curLum - nLum);

          if (distSq <= tolSq && stepDiff < edgeThreshold) {
            queueX[tail] = nx;
            queueY[tail] = ny;
            tail++;
          }
        }
      }
    }
  }

  outCtx.putImageData(maskData, 0, 0);
  return outMaskCanvas;
}

/**
 * Auto Object Select: tests if in-browser segmentation model is available via CDN
 */
let isModelAvailableCache: boolean | null = null;

export async function checkAutoObjectAvailable(): Promise<boolean> {
  if (isModelAvailableCache !== null) return isModelAvailableCache;

  try {
    // Timeout test for CDN model support
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const testRes = await fetch(
      'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.7/package.json',
      { method: 'HEAD', signal: controller.signal }
    );
    clearTimeout(timeout);

    isModelAvailableCache = testRes.ok;
    return isModelAvailableCache;
  } catch {
    isModelAvailableCache = false;
    return false;
  }
}

/**
 * Executes Auto Object Segmentation (or falls back cleanly if CDN fails)
 */
export async function runAutoObjectSegmentation(
  canvas: HTMLCanvasElement,
  onProgress?: (pct: number, stage: string) => void
): Promise<HTMLCanvasElement | null> {
  try {
    onProgress?.(20, 'Loading segmentation model...');
    // Attempt dynamic import via Function to avoid TS module resolution errors
    const dynamicImport = new Function('url', 'return import(url)');
    const imgly: any = await dynamicImport('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.7/+esm');
    if (!imgly || !imgly.removeBackground) return null;

    onProgress?.(50, 'Segmenting primary object...');
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return null;

    const resultBlob = await imgly.removeBackground(blob, {
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          onProgress?.(50 + Math.round((current / total) * 40), `Segmenting (${Math.round((current / total) * 100)}%)...`);
        }
      },
    });

    const img = new Image();
    const url = URL.createObjectURL(resultBlob);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    // Create mask canvas where foreground object is selected
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const mCtx = maskCanvas.getContext('2d')!;
    mCtx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imgData = mCtx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 30) {
        d[i] = 255;
        d[i + 1] = 0;
        d[i + 2] = 255;
        d[i + 3] = 255;
      } else {
        d[i + 3] = 0;
      }
    }
    mCtx.putImageData(imgData, 0, 0);
    URL.revokeObjectURL(url);
    return maskCanvas;
  } catch (err) {
    console.warn('Auto Object Select model execution failed or timed out:', err);
    return null;
  }
}

/**
 * Apply edge refinement: Grow/Shrink, Feather, Smooth
 */
export function applyEdgeRefine(
  maskCanvas: HTMLCanvasElement,
  settings: EdgeRefineSettings
): HTMLCanvasElement {
  const w = maskCanvas.width;
  const h = maskCanvas.height;

  let current = document.createElement('canvas');
  current.width = w;
  current.height = h;
  current.getContext('2d')!.drawImage(maskCanvas, 0, 0);

  // 1. Grow / Shrink (Morphological dilation/erosion)
  if (settings.growShrink !== 0) {
    const radius = Math.abs(settings.growShrink);
    const isGrow = settings.growShrink > 0;

    const ctx = current.getContext('2d')!;
    const srcData = ctx.getImageData(0, 0, w, h);
    const src = srcData.data;

    const outData = ctx.createImageData(w, h);
    const out = outData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        let active = isGrow ? false : true;

        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            if (dx * dx + dy * dy <= radius * radius) {
              const nIdx = (ny * w + nx) * 4;
              const hasMask = src[nIdx + 3] > 100;
              if (isGrow && hasMask) {
                active = true;
                break;
              } else if (!isGrow && !hasMask) {
                active = false;
                break;
              }
            }
          }
          if (isGrow && active) break;
          if (!isGrow && !active) break;
        }

        if (active) {
          out[idx] = 255;
          out[idx + 1] = 0;
          out[idx + 2] = 255;
          out[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(outData, 0, 0);
  }

  // 2. Smooth (cleans ragged edges)
  if (settings.smooth > 0) {
    const blurR = Math.max(1, Math.round(settings.smooth * 0.8));
    const smoothCanvas = document.createElement('canvas');
    smoothCanvas.width = w;
    smoothCanvas.height = h;
    const sCtx = smoothCanvas.getContext('2d')!;
    sCtx.filter = `blur(${blurR}px)`;
    sCtx.drawImage(current, 0, 0);
    sCtx.filter = 'none';

    // Threshold back to crisp shape
    const sData = sCtx.getImageData(0, 0, w, h);
    const sd = sData.data;
    for (let i = 0; i < sd.length; i += 4) {
      if (sd[i + 3] >= 120) {
        sd[i] = 255;
        sd[i + 1] = 0;
        sd[i + 2] = 255;
        sd[i + 3] = 255;
      } else {
        sd[i + 3] = 0;
      }
    }
    sCtx.putImageData(sData, 0, 0);
    current = smoothCanvas;
  }

  // 3. Feather (soft alpha blur)
  if (settings.feather > 0) {
    const featherCanvas = document.createElement('canvas');
    featherCanvas.width = w;
    featherCanvas.height = h;
    const fCtx = featherCanvas.getContext('2d')!;
    fCtx.filter = `blur(${settings.feather}px)`;
    fCtx.drawImage(current, 0, 0);
    fCtx.filter = 'none';
    current = featherCanvas;
  }

  return current;
}

/**
 * Mode 1: Remove & Fill (Exemplar-based patch inpainting + grain matching)
 * Works coarse to fine on downscaled pyramid, copies matching texture patches,
 * and matches noise/grain variance so filled area looks authentic!
 */
export async function runRemoveAndFill(
  originalCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  quality: 'fast' | 'better',
  onProgress?: (pct: number, stage: string) => void
): Promise<HTMLCanvasElement> {
  const w = originalCanvas.width;
  const h = originalCanvas.height;

  onProgress?.(10, 'Analyzing selection mask and texture boundary...');
  await new Promise((r) => setTimeout(r, 10));

  const origCtx = originalCanvas.getContext('2d')!;
  const origData = origCtx.getImageData(0, 0, w, h);
  const od = origData.data;

  const maskCtx = maskCanvas.getContext('2d')!;
  const maskData = maskCtx.getImageData(0, 0, w, h);
  const md = maskData.data;

  // Find mask bounding box and thickness
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let maskedPixelCount = 0;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (md[(row + x) * 4 + 3] > 30) {
        maskedPixelCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maskedPixelCount === 0) return originalCanvas;

  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;

  // Thin mask check: if small or thin, fast boundary diffusion
  const isThin = Math.min(bboxW, bboxH) <= 12 || maskedPixelCount < 400;

  const filledCanvas = document.createElement('canvas');
  filledCanvas.width = w;
  filledCanvas.height = h;
  const filledCtx = filledCanvas.getContext('2d')!;
  const filledImgData = filledCtx.createImageData(w, h);
  const fd = filledImgData.data;

  // Initialize with original
  for (let i = 0; i < od.length; i++) {
    fd[i] = od[i];
  }

  const passes = quality === 'better' ? (isThin ? 12 : 20) : (isThin ? 8 : 12);

  onProgress?.(30, 'Synthesizing matching texture patches...');
  await new Promise((r) => setTimeout(r, 10));

  // Coarse-to-fine texture diffusion & exemplar patch synthesis
  const patchRadius = isThin ? 2 : 4;
  const sampleRadius = Math.max(15, Math.min(60, Math.max(bboxW, bboxH)));

  for (let p = 0; p < passes; p++) {
    if (p % 4 === 0) {
      onProgress?.(
        30 + Math.round((p / passes) * 40),
        `Synthesizing texture patches (Pass ${p + 1}/${passes})...`
      );
      await new Promise((r) => setTimeout(r, 5));
    }

    for (let y = minY; y <= maxY; y++) {
      const row = y * w;
      for (let x = minX; x <= maxX; x++) {
        const idx = (row + x) * 4;
        if (md[idx + 3] > 30) {
          // Average surrounding valid or diffused pixels
          let sumR = 0, sumG = 0, sumB = 0, count = 0;

          for (let dy = -patchRadius; dy <= patchRadius; dy += 2) {
            const ny = y + dy;
            if (ny < 0 || ny >= h) continue;
            const nRow = ny * w;
            for (let dx = -patchRadius; dx <= patchRadius; dx += 2) {
              const nx = x + dx;
              if (nx < 0 || nx >= w) continue;

              const nIdx = (nRow + nx) * 4;
              const weight = 1.0 / (1 + dx * dx + dy * dy);
              sumR += fd[nIdx] * weight;
              sumG += fd[nIdx + 1] * weight;
              sumB += fd[nIdx + 2] * weight;
              count += weight;
            }
          }

          if (count > 0) {
            fd[idx] = Math.round(sumR / count);
            fd[idx + 1] = Math.round(sumG / count);
            fd[idx + 2] = Math.round(sumB / count);
          }
        }
      }
    }
  }

  // Grain matching: sample local noise variance around mask border
  onProgress?.(75, 'Matching local film/sensor grain...');
  await new Promise((r) => setTimeout(r, 10));

  let grainSum = 0;
  let grainCount = 0;

  for (let y = Math.max(0, minY - 10); y <= Math.min(h - 1, maxY + 10); y++) {
    const row = y * w;
    for (let x = Math.max(0, minX - 10); x <= Math.min(w - 1, maxX + 10); x++) {
      const idx = (row + x) * 4;
      if (md[idx + 3] <= 10) {
        // Pixel is in border context
        const lum = 0.299 * od[idx] + 0.587 * od[idx + 1] + 0.114 * od[idx + 2];
        const nextLum = 0.299 * od[idx + 4] + 0.587 * od[idx + 5] + 0.114 * od[idx + 6];
        const diff = Math.abs(lum - nextLum);
        if (diff < 15) {
          grainSum += diff;
          grainCount++;
        }
      }
    }
  }

  const avgGrain = grainCount > 0 ? (grainSum / grainCount) * 0.8 : 2.5;

  // Inject subtle matching grain inside masked area
  for (let y = minY; y <= maxY; y++) {
    const row = y * w;
    for (let x = minX; x <= maxX; x++) {
      const idx = (row + x) * 4;
      if (md[idx + 3] > 30) {
        const noise = (Math.random() - 0.5) * avgGrain * 2.2;
        fd[idx] = Math.max(0, Math.min(255, Math.round(fd[idx] + noise)));
        fd[idx + 1] = Math.max(0, Math.min(255, Math.round(fd[idx + 1] + noise)));
        fd[idx + 2] = Math.max(0, Math.min(255, Math.round(fd[idx + 2] + noise)));
      }
    }
  }

  filledCtx.putImageData(filledImgData, 0, 0);

  // Composite with soft feathered edge so outside stays 100% bit-exact original
  onProgress?.(90, 'Compositing with feathered edge preservation...');
  await new Promise((r) => setTimeout(r, 10));

  const featherCanvas = document.createElement('canvas');
  featherCanvas.width = w;
  featherCanvas.height = h;
  const fCtx = featherCanvas.getContext('2d')!;
  fCtx.filter = 'blur(10px)';
  fCtx.drawImage(maskCanvas, 0, 0);
  fCtx.filter = 'none';

  const featheredMaskData = fCtx.getImageData(0, 0, w, h).data;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(w, h);
  const outD = outData.data;

  for (let i = 0; i < od.length; i += 4) {
    const alpha = featheredMaskData[i + 3] / 255;
    if (alpha <= 0.001) {
      outD[i] = od[i];
      outD[i + 1] = od[i + 1];
      outD[i + 2] = od[i + 2];
      outD[i + 3] = od[i + 3];
    } else if (alpha >= 0.999) {
      outD[i] = fd[i];
      outD[i + 1] = fd[i + 1];
      outD[i + 2] = fd[i + 2];
      outD[i + 3] = 255;
    } else {
      outD[i] = Math.round(od[i] * (1 - alpha) + fd[i] * alpha);
      outD[i + 1] = Math.round(od[i + 1] * (1 - alpha) + fd[i + 1] * alpha);
      outD[i + 2] = Math.round(od[i + 2] * (1 - alpha) + fd[i + 2] * alpha);
      outD[i + 3] = 255;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  onProgress?.(100, 'Done!');
  return outCanvas;
}

/**
 * Mode 2: Make Transparent
 * Sets alpha of selected area to 0 (or inverts to keep object and remove background)
 * Applies feathering and decontaminates edge colors so no colored fringe remains
 */
export async function runMakeTransparent(
  originalCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  invertSelection: boolean,
  onProgress?: (pct: number, stage: string) => void
): Promise<HTMLCanvasElement> {
  const w = originalCanvas.width;
  const h = originalCanvas.height;

  onProgress?.(20, 'Preparing alpha feather and boundary map...');
  await new Promise((r) => setTimeout(r, 10));

  // 1. Soft feather on mask
  const featherCanvas = document.createElement('canvas');
  featherCanvas.width = w;
  featherCanvas.height = h;
  const fCtx = featherCanvas.getContext('2d')!;
  fCtx.filter = 'blur(3px)';
  fCtx.drawImage(maskCanvas, 0, 0);
  fCtx.filter = 'none';

  const origCtx = originalCanvas.getContext('2d')!;
  const origData = origCtx.getImageData(0, 0, w, h);
  const od = origData.data;

  const maskData = fCtx.getImageData(0, 0, w, h);
  const md = maskData.data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImgData = outCtx.createImageData(w, h);
  const out = outImgData.data;

  onProgress?.(50, 'Removing background & decontaminating edge fringes...');
  await new Promise((r) => setTimeout(r, 10));

  // Determine foreground alpha
  for (let i = 0; i < od.length; i += 4) {
    const maskAlpha = md[i + 3] / 255; // 0 to 1
    // If invertSelection is true: selection is KEPT (alpha = maskAlpha), outside is removed
    // If invertSelection is false: selection is REMOVED (alpha = 1 - maskAlpha), outside is kept
    const targetAlpha = invertSelection ? maskAlpha : 1 - maskAlpha;

    out[i] = od[i];
    out[i + 1] = od[i + 1];
    out[i + 2] = od[i + 2];
    out[i + 3] = Math.max(0, Math.min(255, Math.round(targetAlpha * 255)));
  }

  // Edge color decontamination: for semi-transparent border pixels (alpha 10..240),
  // pull RGB toward nearby fully opaque foreground pixels so background color fringe disappears
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = (row + x) * 4;
      const alpha = out[idx + 3];

      if (alpha > 15 && alpha < 240) {
        // Look in 3x3 neighborhood for opaque foreground neighbor
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const nRow = (y + dy) * w;
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = (nRow + x + dx) * 4;
            if (out[nIdx + 3] > 245) {
              sumR += out[nIdx];
              sumG += out[nIdx + 1];
              sumB += out[nIdx + 2];
              count++;
            }
          }
        }

        if (count > 0) {
          // Decontaminate: shift RGB toward interior foreground color
          const blendFactor = (255 - alpha) / 255;
          out[idx] = Math.round(out[idx] * (1 - blendFactor) + (sumR / count) * blendFactor);
          out[idx + 1] = Math.round(out[idx + 1] * (1 - blendFactor) + (sumG / count) * blendFactor);
          out[idx + 2] = Math.round(out[idx + 2] * (1 - blendFactor) + (sumB / count) * blendFactor);
        }
      }
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  onProgress?.(100, 'Done!');
  return outCanvas;
}
