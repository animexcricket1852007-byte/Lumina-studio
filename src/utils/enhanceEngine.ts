import { EnhanceSettings, EnhancePreset } from '../types';

/**
 * Default preset parameters
 */
export const ENHANCE_PRESETS: Record<EnhancePreset, EnhanceSettings> = {
  light: {
    preset: 'light',
    sharpness: 60,
    clarity: 40,
    denoise: 30,
    color: 35,
    targetMaxEdge: 3840,
  },
  strong: {
    preset: 'strong',
    sharpness: 100,
    clarity: 70,
    denoise: 65,
    color: 60,
    targetMaxEdge: 3840,
  },
  extreme: {
    preset: 'extreme',
    sharpness: 160,
    clarity: 100,
    denoise: 90,
    color: 85,
    targetMaxEdge: 3840,
  },
};

/**
 * Safe canvas allocation test for mobile browsers
 */
export function testCanvasAllocation(width: number, height: number): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = width;
    testCanvas.height = height;
    const ctx = testCanvas.getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 2, 2);
    testCanvas.width = 1;
    testCanvas.height = 1;
    return true;
  } catch {
    return false;
  }
}

/**
 * Stepwise upscaling up to targetMaxEdge (default 3840px)
 * Scales in steps of at most 2x with high-quality smoothing. Never shrinks the image.
 */
export async function stepwiseUpscale(
  sourceCanvas: HTMLCanvasElement,
  targetMaxEdge: number,
  onProgress?: (pct: number, stage: string) => void
): Promise<{ canvas: HTMLCanvasElement; fellBack: boolean; finalEdge: number }> {
  let curW = sourceCanvas.width;
  let curH = sourceCanvas.height;
  const currentMaxEdge = Math.max(curW, curH);

  // If already at or larger than target, never shrink
  if (currentMaxEdge >= targetMaxEdge) {
    const copy = document.createElement('canvas');
    copy.width = curW;
    copy.height = curH;
    copy.getContext('2d')!.drawImage(sourceCanvas, 0, 0);
    return { canvas: copy, fellBack: false, finalEdge: currentMaxEdge };
  }

  // Calculate target dimensions
  let targetW: number;
  let targetH: number;
  let fellBack = false;

  const aspect = curW / curH;
  let effectiveMax = targetMaxEdge;

  if (curW >= curH) {
    targetW = effectiveMax;
    targetH = Math.round(effectiveMax / aspect);
  } else {
    targetH = effectiveMax;
    targetW = Math.round(effectiveMax * aspect);
  }

  // Mobile safety check: if 3840 fails, fallback to 2560px
  if (!testCanvasAllocation(targetW, targetH)) {
    effectiveMax = 2560;
    fellBack = true;
    if (curW >= curH) {
      targetW = effectiveMax;
      targetH = Math.round(effectiveMax / aspect);
    } else {
      targetH = effectiveMax;
      targetW = Math.round(effectiveMax * aspect);
    }
  }

  let current = document.createElement('canvas');
  current.width = curW;
  current.height = curH;
  current.getContext('2d')!.drawImage(sourceCanvas, 0, 0);

  // Progressive steps of <= 2x
  while (curW < targetW || curH < targetH) {
    const nextW = Math.min(curW * 2, targetW);
    const nextH = Math.min(curH * 2, targetH);

    onProgress?.(
      Math.round((nextW / targetW) * 20),
      `Upscaling to ${nextW}×${nextH} (${Math.round((nextW / targetW) * 100)}%)...`
    );

    await new Promise((r) => setTimeout(r, 10));

    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextW;
    stepCanvas.height = nextH;
    const stepCtx = stepCanvas.getContext('2d')!;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(current, 0, 0, nextW, nextH);

    current = stepCanvas;
    curW = nextW;
    curH = nextH;
  }

  return { canvas: current, fellBack, finalEdge: Math.max(curW, curH) };
}

/**
 * Edge-preserving chroma and luminance denoise
 * Strong chroma blur to remove ugly color noise, gentle bilateral luminance denoise
 */
export async function denoiseEdgePreserving(
  canvas: HTMLCanvasElement,
  amount: number, // 0 - 100
  onProgress?: (pct: number, stage: string) => void
): Promise<HTMLCanvasElement> {
  if (amount <= 5) return canvas;

  onProgress?.(25, 'Applying edge-preserving chroma & luminance denoise...');
  await new Promise((r) => setTimeout(r, 10));

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Separate into Luminance Y and Chroma Cb/Cr
  const Y = new Float32Array(w * h);
  const Cb = new Float32Array(w * h);
  const Cr = new Float32Array(w * h);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    Y[p] = 0.299 * r + 0.587 * g + 0.114 * b;
    Cb[p] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    Cr[p] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  }

  // 2. Strong chroma blur (color noise)
  const chromaRadius = Math.max(1, Math.round((amount / 100) * 4));
  const smoothCb = boxBlur1D(boxBlur1D(Cb, w, h, chromaRadius, true), w, h, chromaRadius, false);
  const smoothCr = boxBlur1D(boxBlur1D(Cr, w, h, chromaRadius, true), w, h, chromaRadius, false);

  // 3. Bilateral luminance denoise: edge-preserving
  const lumRadius = Math.max(1, Math.round((amount / 100) * 2));
  const sigmaRange = 12 + (amount / 100) * 16;
  const sigmaRangeSq2 = 2 * sigmaRange * sigmaRange;

  const outY = new Float32Array(w * h);

  // Sample with step when very large to keep fast
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      const idx = rowOffset + x;
      const centerVal = Y[idx];

      let sumY = 0;
      let totalW = 0;

      for (let dy = -lumRadius; dy <= lumRadius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        const nRow = ny * w;

        for (let dx = -lumRadius; dx <= lumRadius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;

          const nVal = Y[nRow + nx];
          const diff = centerVal - nVal;
          // Range weight: drops sharply across high-contrast edges!
          const rWeight = Math.exp(-(diff * diff) / sigmaRangeSq2);
          const sWeight = 1.0 / (1 + dx * dx + dy * dy);
          const weight = rWeight * sWeight;

          sumY += nVal * weight;
          totalW += weight;
        }
      }

      outY[idx] = totalW > 0 ? sumY / totalW : centerVal;
    }
  }

  // 4. Reconstruct RGB from YCbCr
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(w, h);
  const od = outData.data;

  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const yVal = outY[p];
    const cbVal = smoothCb[p] - 128;
    const crVal = smoothCr[p] - 128;

    const r = yVal + 1.402 * crVal;
    const g = yVal - 0.344136 * cbVal - 0.714136 * crVal;
    const b = yVal + 1.772 * cbVal;

    od[i] = Math.max(0, Math.min(255, Math.round(r)));
    od[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    od[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    od[i + 3] = data[i + 3];
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

/**
 * Fast separable 1D box blur helper
 */
function boxBlur1D(src: Float32Array, w: number, h: number, r: number, horizontal: boolean): Float32Array {
  const dst = new Float32Array(w * h);
  const invSize = 1 / (2 * r + 1);

  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = -r; x <= r; x++) {
        sum += src[row + Math.max(0, Math.min(w - 1, x))];
      }
      for (let x = 0; x < w; x++) {
        dst[row + x] = sum * invSize;
        const removeX = Math.max(0, x - r);
        const addX = Math.min(w - 1, x + r + 1);
        sum += src[row + addX] - src[row + removeX];
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) {
        sum += src[Math.max(0, Math.min(h - 1, y)) * w + x];
      }
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = sum * invSize;
        const removeY = Math.max(0, y - r);
        const addY = Math.min(h - 1, y + r + 1);
        sum += src[addY * w + x] - src[removeY * w + x];
      }
    }
  }
  return dst;
}

/**
 * Multi-Scale Sharpening: applies unsharp mask at three radii (0.8px, 2px, 6px)
 * Amounts roughly 1.2, 0.8, 0.5 for Strong (scaled for Light/Extreme/user slider)
 * Values clamped, with threshold to avoid halos and noise boost
 */
export async function multiScaleSharpen(
  canvas: HTMLCanvasElement,
  sharpnessPct: number, // 0 - 200
  preset: EnhancePreset,
  onProgress?: (pct: number, stage: string) => void
): Promise<HTMLCanvasElement> {
  onProgress?.(50, 'Applying multi-scale unsharp mask (0.8px, 2px, 6px)...');
  await new Promise((r) => setTimeout(r, 10));

  const w = canvas.width;
  const h = canvas.height;

  // Preset baseline multiplier
  const presetMult = preset === 'light' ? 0.6 : preset === 'extreme' ? 1.5 : 1.0;
  const scale = (sharpnessPct / 100) * presetMult;

  // Three radii and base amounts: [0.8px: 1.2, 2.0px: 0.8, 6.0px: 0.5]
  const passes = [
    { radius: 0.8, amount: 1.2 * scale, threshold: 2.5, clamp: 28 * scale },
    { radius: 2.0, amount: 0.8 * scale, threshold: 3.0, clamp: 32 * scale },
    { radius: 6.0, amount: 0.5 * scale, threshold: 4.0, clamp: 36 * scale },
  ];

  let currentCanvas = canvas;

  for (let p = 0; p < passes.length; p++) {
    const pass = passes[p];
    if (pass.amount <= 0.05) continue;

    // Create blurred version
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = w;
    blurCanvas.height = h;
    const bCtx = blurCanvas.getContext('2d')!;
    bCtx.filter = `blur(${pass.radius}px)`;
    bCtx.drawImage(currentCanvas, 0, 0, w, h);
    bCtx.filter = 'none';

    const origData = currentCanvas.getContext('2d')!.getImageData(0, 0, w, h);
    const blurData = bCtx.getImageData(0, 0, w, h);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d')!;
    const outImgData = outCtx.createImageData(w, h);

    const od = outImgData.data;
    const odOrig = origData.data;
    const odBlur = blurData.data;

    for (let i = 0; i < odOrig.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const oVal = odOrig[i + c];
        const bVal = odBlur[i + c];
        const diff = oVal - bVal;

        let boost = 0;
        // Threshold check to avoid noise boost
        if (Math.abs(diff) > pass.threshold) {
          boost = diff * pass.amount;
          // Clamp boost to avoid halos
          boost = Math.max(-pass.clamp, Math.min(pass.clamp, boost));
        }

        od[i + c] = Math.max(0, Math.min(255, Math.round(oVal + boost)));
      }
      od[i + 3] = odOrig[i + 3];
    }

    outCtx.putImageData(outImgData, 0, 0);
    currentCanvas = outCanvas;
  }

  return currentCanvas;
}

/**
 * CLAHE (Contrast Limited Adaptive Histogram Equalization) on Luminance channel only
 * Clip limit ~ 2.0 for Strong, with bilinear tile interpolation
 */
export async function applyCLAHE(
  canvas: HTMLCanvasElement,
  clarityPct: number, // 0 - 100
  preset: EnhancePreset,
  onProgress?: (pct: number, stage: string) => void
): Promise<HTMLCanvasElement> {
  if (clarityPct <= 5) return canvas;

  onProgress?.(70, 'Applying adaptive local contrast (CLAHE)...');
  await new Promise((r) => setTimeout(r, 10));

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Grid size: 8x8 tiles
  const tilesX = 8;
  const tilesY = 8;
  const tileW = w / tilesX;
  const tileH = h / tilesY;

  const baseClip = preset === 'light' ? 1.3 : preset === 'extreme' ? 3.0 : 2.0;
  const clipMultiplier = baseClip * (clarityPct / 100);

  // Compute luminance array
  const Y = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    Y[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Precompute CDF mappings for each tile
  const cdfs: Float32Array[] = [];

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const startX = Math.floor(tx * tileW);
      const endX = Math.floor((tx + 1) * tileW);
      const startY = Math.floor(ty * tileH);
      const endY = Math.floor((ty + 1) * tileH);
      const tilePixels = (endX - startX) * (endY - startY);

      // Histogram
      const hist = new Float32Array(256);
      for (let y = startY; y < endY; y++) {
        const row = y * w;
        for (let x = startX; x < endX; x++) {
          const val = Math.max(0, Math.min(255, Math.round(Y[row + x])));
          hist[val]++;
        }
      }

      // Clip limit
      const clipLimit = (tilePixels / 256) * clipMultiplier;
      let excess = 0;
      for (let b = 0; b < 256; b++) {
        if (hist[b] > clipLimit) {
          excess += hist[b] - clipLimit;
          hist[b] = clipLimit;
        }
      }

      // Redistribute excess evenly
      const bonus = excess / 256;
      for (let b = 0; b < 256; b++) {
        hist[b] += bonus;
      }

      // Cumulative Distribution Function (CDF)
      const cdf = new Float32Array(256);
      let acc = 0;
      for (let b = 0; b < 256; b++) {
        acc += hist[b];
        cdf[b] = (acc / tilePixels) * 255;
      }
      cdfs.push(cdf);
    }
  }

  // Bilinear interpolation across tile centers
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImgData = outCtx.createImageData(w, h);
  const od = outImgData.data;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    // Normalized position relative to tile centers
    const ty = (y - tileH * 0.5) / tileH;
    const ty0 = Math.max(0, Math.min(tilesY - 1, Math.floor(ty)));
    const ty1 = Math.max(0, Math.min(tilesY - 1, ty0 + 1));
    const fy = Math.max(0, Math.min(1, ty - ty0));

    for (let x = 0; x < w; x++) {
      const idx = row + x;
      const tx = (x - tileW * 0.5) / tileW;
      const tx0 = Math.max(0, Math.min(tilesX - 1, Math.floor(tx)));
      const tx1 = Math.max(0, Math.min(tilesX - 1, tx0 + 1));
      const fx = Math.max(0, Math.min(1, tx - tx0));

      const origY = Math.max(0, Math.min(255, Math.round(Y[idx])));

      const cdfTL = cdfs[ty0 * tilesX + tx0][origY];
      const cdfTR = cdfs[ty0 * tilesX + tx1][origY];
      const cdfBL = cdfs[ty1 * tilesX + tx0][origY];
      const cdfBR = cdfs[ty1 * tilesX + tx1][origY];

      const newY =
        (1 - fx) * (1 - fy) * cdfTL +
        fx * (1 - fy) * cdfTR +
        (1 - fx) * fy * cdfBL +
        fx * fy * cdfBR;

      // Scale RGB proportionally based on new luminance
      const pIdx = idx * 4;
      const ratio = origY > 0 ? newY / origY : 1;
      // Blend gently with original based on clarity strength
      const blend = (clarityPct / 100) * 0.85;

      od[pIdx] = Math.max(0, Math.min(255, Math.round(data[pIdx] * (1 - blend + ratio * blend))));
      od[pIdx + 1] = Math.max(0, Math.min(255, Math.round(data[pIdx + 1] * (1 - blend + ratio * blend))));
      od[pIdx + 2] = Math.max(0, Math.min(255, Math.round(data[pIdx + 2] * (1 - blend + ratio * blend))));
      od[pIdx + 3] = data[pIdx + 3];
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

/**
 * Auto Levels: stretches histogram, clipping 0.5% at each end
 */
export function autoLevels(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Build luminance histogram
  const hist = new Int32Array(256);
  const total = w * h;

  for (let i = 0; i < data.length; i += 4) {
    const yVal = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[Math.max(0, Math.min(255, yVal))]++;
  }

  // Find 0.5% clip thresholds
  const clipCount = Math.floor(total * 0.005);
  let low = 0;
  let count = 0;
  for (let b = 0; b < 256; b++) {
    count += hist[b];
    if (count >= clipCount) {
      low = b;
      break;
    }
  }

  let high = 255;
  count = 0;
  for (let b = 255; b >= 0; b--) {
    count += hist[b];
    if (count >= clipCount) {
      high = b;
      break;
    }
  }

  if (high <= low + 8) return canvas;

  const range = high - low;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImgData = outCtx.createImageData(w, h);
  const od = outImgData.data;

  // Build LUT
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, Math.round(((i - low) / range) * 255)));
  }

  for (let i = 0; i < data.length; i += 4) {
    od[i] = lut[data[i]];
    od[i + 1] = lut[data[i + 1]];
    od[i + 2] = lut[data[i + 2]];
    od[i + 3] = data[i + 3];
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

/**
 * Vibrance: boosts low-saturation colors slightly without making skin tones orange
 */
export function applyVibrance(canvas: HTMLCanvasElement, colorPct: number): HTMLCanvasElement {
  if (colorPct <= 5) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const vibranceAmount = (colorPct / 100) * 0.65;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImgData = outCtx.createImageData(w, h);
  const od = outImgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

    // Luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Boost is inversely proportional to saturation
    let boost = (1.0 - sat) * vibranceAmount;

    // Skin tone protection: warm hue (reds/oranges with R > G > B)
    if (r > g && g > b && r - b > 20) {
      const redDominance = (r - g) / (r - b);
      if (redDominance > 0.35 && redDominance < 0.85) {
        // Significantly dampen boost for skin pixels so they never look orange
        boost *= 0.25;
      }
    }

    od[i] = Math.max(0, Math.min(255, Math.round(r + (r - lum) * boost)));
    od[i + 1] = Math.max(0, Math.min(255, Math.round(g + (g - lum) * boost)));
    od[i + 2] = Math.max(0, Math.min(255, Math.round(b + (b - lum) * boost)));
    od[i + 3] = data[i + 3];
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

/**
 * Laplacian variance sharpness measurement
 */
export function measureLaplacianVariance(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  const w = canvas.width;
  const h = canvas.height;
  if (w < 4 || h < 4) return 0;

  const step = Math.max(1, Math.floor(Math.max(w, h) / 1000));
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const sampleW = Math.floor(w / step);
  const sampleH = Math.floor(h / step);
  const gray = new Float32Array(sampleW * sampleH);

  for (let sy = 0; sy < sampleH; sy++) {
    const y = sy * step;
    for (let sx = 0; sx < sampleW; sx++) {
      const x = sx * step;
      const idx = (y * w + x) * 4;
      gray[sy * sampleW + sx] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  let sumL = 0;
  let count = 0;
  const laplacians = new Float32Array((sampleW - 2) * (sampleH - 2));

  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const center = gray[y * sampleW + x];
      const left = gray[y * sampleW + (x - 1)];
      const right = gray[y * sampleW + (x + 1)];
      const up = gray[(y - 1) * sampleW + x];
      const down = gray[(y + 1) * sampleW + x];

      const val = Math.abs(left + right + up + down - 4 * center);
      laplacians[count] = val;
      sumL += val;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sumL / count;
  let sumSqDiff = 0;
  for (let i = 0; i < count; i++) {
    const diff = laplacians[i] - mean;
    sumSqDiff += diff * diff;
  }

  return Math.round(sumSqDiff / count);
}

/**
 * Full Photo Enhancement Pipeline
 * 1. Upscale (up to 3840px, never shrink)
 * 2. Denoise (chroma & luminance)
 * 3. Multi-scale sharpening (0.8px, 2px, 6px)
 * 4. CLAHE local contrast
 * 5. Auto levels
 * 6. Vibrance
 */
export async function runEnhancePipeline(
  sourceCanvas: HTMLCanvasElement,
  settings: EnhanceSettings,
  onProgress?: (progressPct: number, stageName: string) => void
): Promise<{
  enhancedCanvas: HTMLCanvasElement;
  upscaledOriginalCanvas: HTMLCanvasElement;
  sharpnessBefore: number;
  sharpnessAfter: number;
  sharpnessDiffPercent: number;
  fellBack: boolean;
  finalEdge: number;
}> {
  // Step 1: Upscale
  onProgress?.(5, 'Step 1/6: Progressive 2x upscaling...');
  const { canvas: upscaledCanvas, fellBack, finalEdge } = await stepwiseUpscale(
    sourceCanvas,
    settings.targetMaxEdge,
    onProgress
  );

  // Initial sharpness
  const sharpnessBefore = measureLaplacianVariance(upscaledCanvas);

  // Step 2: Denoise
  onProgress?.(25, 'Step 2/6: Edge-preserving chroma & luminance denoise...');
  const denoised = await denoiseEdgePreserving(upscaledCanvas, settings.denoise, onProgress);

  // Step 3: Multi-scale sharpening
  onProgress?.(45, 'Step 3/6: Multi-scale unsharp masking (0.8px, 2px, 6px)...');
  const sharpened = await multiScaleSharpen(denoised, settings.sharpness, settings.preset, onProgress);

  // Step 4: CLAHE
  onProgress?.(65, 'Step 4/6: Local adaptive contrast (CLAHE)...');
  const claheApplied = await applyCLAHE(sharpened, settings.clarity, settings.preset, onProgress);

  // Step 5: Auto levels
  onProgress?.(80, 'Step 5/6: Histogram auto-levels stretch...');
  await new Promise((r) => setTimeout(r, 10));
  const leveled = autoLevels(claheApplied);

  // Step 6: Vibrance
  onProgress?.(90, 'Step 6/6: Selective color vibrance...');
  await new Promise((r) => setTimeout(r, 10));
  const finalEnhanced = applyVibrance(leveled, settings.color);

  // Final sharpness score
  const sharpnessAfter = measureLaplacianVariance(finalEnhanced);
  const diffPercent =
    sharpnessBefore > 0
      ? Math.round(((sharpnessAfter - sharpnessBefore) / sharpnessBefore) * 100)
      : 0;

  onProgress?.(100, 'Enhancement complete!');

  return {
    enhancedCanvas: finalEnhanced,
    upscaledOriginalCanvas: upscaledCanvas,
    sharpnessBefore,
    sharpnessAfter,
    sharpnessDiffPercent: diffPercent,
    fellBack,
    finalEdge,
  };
}
