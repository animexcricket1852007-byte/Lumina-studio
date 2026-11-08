import { SharpnessResult, EnhancePreset, EnhanceEngineParams } from '../types';

/**
 * Loads an image safely from URL or data URI
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });
}

/**
 * Ensures an image does not exceed 4096px on its longest edge when loaded
 */
export function constrainTo4096(img: HTMLImageElement): { canvas: HTMLCanvasElement; width: number; height: number; scaled: boolean } {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const maxEdge = 4096;

  let scaled = false;
  if (w > maxEdge || h > maxEdge) {
    if (w >= h) {
      h = Math.round((h * maxEdge) / w);
      w = maxEdge;
    } else {
      w = Math.round((w * maxEdge) / h);
      h = maxEdge;
    }
    scaled = true;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  return { canvas, width: w, height: h, scaled };
}

/**
 * Safe canvas allocation check for phone memory safety
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
  } catch (e) {
    console.warn(`Canvas allocation test failed for ${width}x${height}:`, e);
    return false;
  }
}

/**
 * Converts canvas to dataURL
 */
export function canvasToBase64(canvas: HTMLCanvasElement, mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.95): string {
  return canvas.toDataURL(mimeType, quality);
}

/**
 * Converts canvas to File blob for native sharing / download
 */
export function canvasToFile(canvas: HTMLCanvasElement, filename: string, mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.95): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'));
          return;
        }
        const file = new File([blob], filename, { type: mimeType, lastModified: Date.now() });
        resolve(file);
      },
      mimeType,
      quality
    );
  });
}

/**
 * Measure image sharpness using Laplacian variance
 */
export function measureSharpness(canvas: HTMLCanvasElement): SharpnessResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { score: 0, variance: 0 };

  const w = canvas.width;
  const h = canvas.height;
  if (w < 4 || h < 4) return { score: 0, variance: 0 };

  // Sample with an adaptive step to keep measurement fast even on 4K
  const step = Math.max(1, Math.floor(Math.max(w, h) / 1200));
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
      // Rec. 709 luminance
      gray[sy * sampleW + sx] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  // Laplacian kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
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

  if (count === 0) return { score: 0, variance: 0 };

  const mean = sumL / count;
  let sumSqDiff = 0;
  for (let i = 0; i < count; i++) {
    const diff = laplacians[i] - mean;
    sumSqDiff += diff * diff;
  }

  const variance = sumSqDiff / count;
  return {
    score: Math.round(variance),
    variance,
  };
}

/**
 * Detect halos (over-sharpening artifacts characterized by extreme clipping around sharp edges)
 */
export function detectHalos(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const w = Math.min(canvas.width, 1000);
  const h = Math.min(canvas.height, 1000);

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = w;
  sampleCanvas.height = h;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(canvas, 0, 0, w, h);

  const imgData = sCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let clippedPixels = 0;
  const total = w * h;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if ((r >= 254 && g >= 254 && b >= 254) || (r <= 1 && g <= 1 && b <= 1)) {
      clippedPixels++;
    }
  }

  return clippedPixels / total > 0.055;
}

// -------------------------------------------------------------------------------------------------
// PHOTO ENHANCEMENT ENGINE (100% Client-Side, No Billing, High-Fidelity DSP Pipeline)
// -------------------------------------------------------------------------------------------------

/**
 * Step 1: Stepwise Upscale (at most 2x each step with high-quality cubic smoothing)
 * Targets up to 3840px (or fallback 2560px on constrained phones). Never shrinks the image.
 */
export async function stepwiseUpscale(
  source: HTMLCanvasElement | HTMLImageElement,
  targetMaxEdge: number,
  onProgress?: (progressPct: number, stageName: string) => void
): Promise<HTMLCanvasElement> {
  let curW = 'naturalWidth' in source ? source.naturalWidth : source.width;
  let curH = 'naturalHeight' in source ? source.naturalHeight : source.height;

  const currentMaxEdge = Math.max(curW, curH);

  // Never shrink the image
  if (currentMaxEdge >= targetMaxEdge) {
    const keepCanvas = document.createElement('canvas');
    keepCanvas.width = curW;
    keepCanvas.height = curH;
    const ctx = keepCanvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0);
    return keepCanvas;
  }

  // Calculate target preserving aspect ratio
  let targetW: number;
  let targetH: number;
  if (curW >= curH) {
    targetW = targetMaxEdge;
    targetH = Math.round((curH * targetMaxEdge) / curW);
  } else {
    targetH = targetMaxEdge;
    targetW = Math.round((curW * targetMaxEdge) / curH);
  }

  let currentCanvas = document.createElement('canvas');
  currentCanvas.width = curW;
  currentCanvas.height = curH;
  currentCanvas.getContext('2d')!.drawImage(source, 0, 0);

  // Progressive 2x steps
  while (curW < targetW || curH < targetH) {
    const nextW = Math.min(curW * 2, targetW);
    const nextH = Math.min(curH * 2, targetH);

    onProgress?.(
      Math.round((Math.max(nextW, nextH) / targetMaxEdge) * 15) + 5,
      `Stepwise upscaling to ${nextW}×${nextH}...`
    );
    await new Promise((r) => setTimeout(r, 0));

    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextW;
    stepCanvas.height = nextH;
    const stepCtx = stepCanvas.getContext('2d')!;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(currentCanvas, 0, 0, nextW, nextH);

    currentCanvas = stepCanvas;
    curW = nextW;
    curH = nextH;
  }

  return currentCanvas;
}

/**
 * Step 2: Denoise
 * Strong chroma noise reduction (filtering Cb/Cr channels) and gentle edge-preserving luminance denoise
 */
export async function applyEdgePreservingDenoise(
  canvas: HTMLCanvasElement,
  strengthFactor: number = 0.5 // 0.0 to 1.0
): Promise<HTMLCanvasElement> {
  const w = canvas.width;
  const h = canvas.height;

  // 1. Create a blurred copy of canvas for strong chroma noise cleanup
  const chromaBlurCanvas = document.createElement('canvas');
  chromaBlurCanvas.width = w;
  chromaBlurCanvas.height = h;
  const cbCtx = chromaBlurCanvas.getContext('2d')!;
  const chromaRadius = Math.max(1.5, Math.min(5.0, 3.0 * strengthFactor));
  cbCtx.filter = `blur(${chromaRadius.toFixed(1)}px)`;
  cbCtx.drawImage(canvas, 0, 0, w, h);
  cbCtx.filter = 'none';

  const origData = canvas.getContext('2d')!.getImageData(0, 0, w, h);
  const blurData = cbCtx.getImageData(0, 0, w, h);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(w, h);

  const od = outData.data;
  const odOrig = origData.data;
  const odBlur = blurData.data;

  const total = w * h * 4;
  const lumThreshold = 18.0 * strengthFactor; // gentle edge-preserving threshold

  for (let i = 0; i < total; i += 4) {
    const rO = odOrig[i];
    const gO = odOrig[i + 1];
    const bO = odOrig[i + 2];

    const rB = odBlur[i];
    const gB = odBlur[i + 1];
    const bB = odBlur[i + 2];

    // Convert original to YCbCr
    const yO = 0.299 * rO + 0.587 * gO + 0.114 * bO;
    const yB = 0.299 * rB + 0.587 * gB + 0.114 * bB;

    // Convert blurred to CbCr
    const cbB = 128 - 0.168736 * rB - 0.331264 * gB + 0.5 * bB;
    const crB = 128 + 0.5 * rB - 0.418688 * gB - 0.081312 * bB;

    // Gentle edge-preserving luminance denoise
    const lumDiff = Math.abs(yO - yB);
    let finalY = yO;
    if (lumDiff < lumThreshold && strengthFactor > 0.05) {
      const blend = (1.0 - lumDiff / lumThreshold) * 0.55 * strengthFactor;
      finalY = yO * (1.0 - blend) + yB * blend;
    }

    // Blend chroma (strong chroma denoise)
    const cbO = 128 - 0.168736 * rO - 0.331264 * gO + 0.5 * bO;
    const crO = 128 + 0.5 * rO - 0.418688 * gO - 0.081312 * bO;
    const chromaBlend = 0.75 * strengthFactor;
    const finalCb = cbO * (1.0 - chromaBlend) + cbB * chromaBlend;
    const finalCr = crO * (1.0 - chromaBlend) + crB * chromaBlend;

    // Convert back to RGB
    const r = finalY + 1.402 * (finalCr - 128);
    const g = finalY - 0.344136 * (finalCb - 128) - 0.714136 * (finalCr - 128);
    const b = finalY + 1.772 * (finalCb - 128);

    od[i] = Math.max(0, Math.min(255, Math.round(r)));
    od[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    od[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    od[i + 3] = odOrig[i + 3];
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

/**
 * Step 3: Multi-Scale Sharpening (Radii: 0.8px, 2px, 6px with halo & noise clamping)
 */
export async function applyMultiScaleSharpening(
  canvas: HTMLCanvasElement,
  preset: EnhancePreset,
  userSharpnessRatio: number = 1.0 // 0.0 to 2.0
): Promise<HTMLCanvasElement> {
  const w = canvas.width;
  const h = canvas.height;

  // Base amounts per specifications: roughly 1.2 (0.8px), 0.8 (2px), 0.5 (6px) for Strong
  let scale = 1.0;
  if (preset === 'light') scale = 0.55;
  if (preset === 'extreme') scale = 1.6;

  const a1 = 1.2 * scale * userSharpnessRatio;
  const a2 = 0.8 * scale * userSharpnessRatio;
  const a3 = 0.5 * scale * userSharpnessRatio;

  // Pre-render 3 blurred scales using hardware-accelerated canvas filter
  const blur08Canvas = document.createElement('canvas');
  blur08Canvas.width = w;
  blur08Canvas.height = h;
  const ctx08 = blur08Canvas.getContext('2d')!;
  ctx08.filter = 'blur(0.8px)';
  ctx08.drawImage(canvas, 0, 0, w, h);
  ctx08.filter = 'none';

  const blur20Canvas = document.createElement('canvas');
  blur20Canvas.width = w;
  blur20Canvas.height = h;
  const ctx20 = blur20Canvas.getContext('2d')!;
  ctx20.filter = 'blur(2.0px)';
  ctx20.drawImage(canvas, 0, 0, w, h);
  ctx20.filter = 'none';

  const blur60Canvas = document.createElement('canvas');
  blur60Canvas.width = w;
  blur60Canvas.height = h;
  const ctx60 = blur60Canvas.getContext('2d')!;
  ctx60.filter = 'blur(6.0px)';
  ctx60.drawImage(canvas, 0, 0, w, h);
  ctx60.filter = 'none';

  const origData = canvas.getContext('2d')!.getImageData(0, 0, w, h);
  const data08 = ctx08.getImageData(0, 0, w, h);
  const data20 = ctx20.getImageData(0, 0, w, h);
  const data60 = ctx60.getImageData(0, 0, w, h);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(w, h);

  const od = outData.data;
  const odOrig = origData.data;
  const od08 = data08.data;
  const od20 = data20.data;
  const od60 = data60.data;

  const total = w * h * 4;
  const threshold = 2.5; // Avoid boosting flat noise
  const maxDelta = 45.0; // Halo protection clamp

  for (let i = 0; i < total; i += 4) {
    for (let c = 0; c < 3; c++) {
      const origVal = odOrig[i + c];
      const diff1 = origVal - od08[i + c];
      const diff2 = origVal - od20[i + c];
      const diff3 = origVal - od60[i + c];

      let delta = 0;
      if (Math.abs(diff1) > threshold) delta += diff1 * a1;
      if (Math.abs(diff2) > threshold) delta += diff2 * a2;
      if (Math.abs(diff3) > threshold) delta += diff3 * a3;

      // Clamp total delta to prevent edge haloing
      delta = Math.max(-maxDelta, Math.min(maxDelta, delta));

      od[i + c] = Math.max(0, Math.min(255, Math.round(origVal + delta)));
    }
    od[i + 3] = odOrig[i + 3];
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

/**
 * Step 4: CLAHE (Contrast Limited Adaptive Histogram Equalization) on Luminance channel only
 * With bilinear tile interpolation for artifact-free local contrast
 */
export async function applyCLAHE(
  canvas: HTMLCanvasElement,
  clipLimit: number = 2.0 // roughly 2.0 for Strong
): Promise<HTMLCanvasElement> {
  const w = canvas.width;
  const h = canvas.height;

  const origCtx = canvas.getContext('2d')!;
  const imgData = origCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Extract luminance channel Y and store chromas
  const numPixels = w * h;
  const Y = new Uint8Array(numPixels);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    Y[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // Grid dimensions (8 x 8 contextual tiles)
  const gridX = 8;
  const gridY = 8;
  const tileW = Math.ceil(w / gridX);
  const tileH = Math.ceil(h / gridY);

  // Compute mapping function (LUT) for each tile
  const tileLUTs: Uint8Array[] = new Array(gridX * gridY);

  for (let ty = 0; ty < gridY; ty++) {
    for (let tx = 0; tx < gridX; tx++) {
      const startX = tx * tileW;
      const endX = Math.min(w, startX + tileW);
      const startY = ty * tileH;
      const endY = Math.min(h, startY + tileH);
      const tilePixelCount = (endX - startX) * (endY - startY);

      // 1. Histogram
      const hist = new Int32Array(256);
      for (let y = startY; y < endY; y++) {
        const row = y * w;
        for (let x = startX; x < endX; x++) {
          hist[Y[row + x]]++;
        }
      }

      // 2. Clip histogram
      const clipValue = Math.max(1, Math.round((clipLimit * tilePixelCount) / 256));
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipValue) {
          excess += hist[i] - clipValue;
          hist[i] = clipValue;
        }
      }

      // Redistribute excess
      const binIncr = Math.floor(excess / 256);
      const remainingExcess = excess % 256;
      for (let i = 0; i < 256; i++) {
        hist[i] += binIncr;
      }
      for (let i = 0; i < remainingExcess; i++) {
        hist[i]++;
      }

      // 3. Compute CDF mapping
      const lut = new Uint8Array(256);
      let cumulative = 0;
      const scaleFactor = 255 / tilePixelCount;
      for (let i = 0; i < 256; i++) {
        cumulative += hist[i];
        lut[i] = Math.max(0, Math.min(255, Math.round(cumulative * scaleFactor)));
      }

      tileLUTs[ty * gridX + tx] = lut;
    }
  }

  // Bilinear interpolation across tile grid
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(w, h);
  const od = outData.data;

  for (let y = 0; y < h; y++) {
    const normY = (y / h) * gridY - 0.5;
    let y1 = Math.floor(normY);
    let y2 = y1 + 1;
    const fy = normY - y1;
    y1 = Math.max(0, Math.min(gridY - 1, y1));
    y2 = Math.max(0, Math.min(gridY - 1, y2));

    const rowOffset = y * w;

    for (let x = 0; x < w; x++) {
      const normX = (x / w) * gridX - 0.5;
      let x1 = Math.floor(normX);
      let x2 = x1 + 1;
      const fx = normX - x1;
      x1 = Math.max(0, Math.min(gridX - 1, x1));
      x2 = Math.max(0, Math.min(gridX - 1, x2));

      const pIdx = rowOffset + x;
      const origLum = Y[pIdx];

      // Interpolate from 4 surrounding tile LUTs
      const v11 = tileLUTs[y1 * gridX + x1][origLum];
      const v21 = tileLUTs[y1 * gridX + x2][origLum];
      const v12 = tileLUTs[y2 * gridX + x1][origLum];
      const v22 = tileLUTs[y2 * gridX + x2][origLum];

      const top = v11 * (1 - fx) + v21 * fx;
      const bottom = v12 * (1 - fx) + v22 * fx;
      const claheLum = top * (1 - fy) + bottom * fy;

      // Transfer modified luminance back into RGB preserving chromas
      const deltaLum = claheLum - origLum;
      const p4 = pIdx * 4;

      od[p4] = Math.max(0, Math.min(255, Math.round(data[p4] + deltaLum)));
      od[p4 + 1] = Math.max(0, Math.min(255, Math.round(data[p4 + 1] + deltaLum)));
      od[p4 + 2] = Math.max(0, Math.min(255, Math.round(data[p4 + 2] + deltaLum)));
      od[p4 + 3] = data[p4 + 3];
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

/**
 * Step 5: Auto Levels (Histogram stretch clipping 0.5% at each end)
 */
export async function applyAutoLevels(
  canvas: HTMLCanvasElement,
  clipPercent: number = 0.5 // 0.5%
): Promise<HTMLCanvasElement> {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const totalPixels = w * h;

  // Build luminance histogram
  const hist = new Int32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[lum]++;
  }

  // Find 0.5% low and 99.5% high percentiles
  const lowTarget = Math.round((clipPercent / 100) * totalPixels);
  const highTarget = Math.round(((100 - clipPercent) / 100) * totalPixels);

  let pLow = 0;
  let cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += hist[i];
    if (cum >= lowTarget) {
      pLow = i;
      break;
    }
  }

  let pHigh = 255;
  cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += hist[i];
    if (cum >= highTarget) {
      pHigh = i;
      break;
    }
  }

  if (pHigh <= pLow) return canvas;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(w, h);
  const od = outData.data;

  const scale = 255 / (pHigh - pLow);

  // Precompute LUT for speed
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, Math.round((i - pLow) * scale)));
  }

  for (let i = 0; i < data.length; i += 4) {
    od[i] = lut[data[i]];
    od[i + 1] = lut[data[i + 1]];
    od[i + 2] = lut[data[i + 2]];
    od[i + 3] = data[i + 3];
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

/**
 * Step 6: Vibrance
 * Boosts low-saturation colors slightly without making skin tones orange
 */
export async function applySmartVibrance(
  canvas: HTMLCanvasElement,
  amountRatio: number = 0.5 // 0.0 to 1.0
): Promise<HTMLCanvasElement> {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(w, h);
  const od = outData.data;

  const vibranceFactor = amountRatio * 0.45;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const delta = maxC - minC;

    if (maxC === 0 || delta === 0) {
      od[i] = r;
      od[i + 1] = g;
      od[i + 2] = b;
      od[i + 3] = data[i + 3];
      continue;
    }

    const sat = delta / maxC; // 0 to 1

    // Detect skin tones: R > G > B with moderate saturation and brightness
    let skinDampener = 1.0;
    if (r > g && g > b && r > 60 && r - b > 18) {
      skinDampener = 0.3; // Protect skin from turning orange
    }

    // Boost inversely proportional to saturation
    const boost = vibranceFactor * (1.0 - sat) * skinDampener;

    od[i] = Math.max(0, Math.min(255, Math.round(r + (maxC - r) * boost)));
    od[i + 1] = Math.max(0, Math.min(255, Math.round(g + (maxC - g) * boost)));
    od[i + 2] = Math.max(0, Math.min(255, Math.round(b + (maxC - b) * boost)));
    od[i + 3] = data[i + 3];
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

/**
 * MASTER FULL ENHANCE PIPELINE (Runs when user taps Enhance)
 * With 3 Presets: Light, Strong (default), Extreme
 * Full non-blocking chunked execution with live progress reporting
 */
export async function runEnhancePipeline(
  sourceCanvas: HTMLCanvasElement,
  params: EnhanceEngineParams,
  onProgress: (pct: number, stageName: string) => void
): Promise<{ finalCanvas: HTMLCanvasElement; fellBackTo2560: boolean }> {
  // Check memory allocation safety for phone devices
  let targetEdge = params.targetMaxEdge;
  let fellBackTo2560 = false;
  if (!testCanvasAllocation(targetEdge, Math.round(targetEdge * 0.56))) {
    targetEdge = 2560;
    fellBackTo2560 = true;
  }

  // 1. UPSCALE
  onProgress(10, 'Step 1/6: High-Quality Stepwise Upscaling...');
  await new Promise((r) => setTimeout(r, 0));
  const upscaledCanvas = await stepwiseUpscale(sourceCanvas, targetEdge, onProgress);

  // 2. DENOISE
  onProgress(30, 'Step 2/6: Edge-Preserving Denoise (Chroma & Luminance)...');
  await new Promise((r) => setTimeout(r, 0));
  const denoiseStrength = (params.denoise / 100) * (params.preset === 'light' ? 0.35 : params.preset === 'extreme' ? 0.85 : 0.55);
  const denoisedCanvas = await applyEdgePreservingDenoise(upscaledCanvas, denoiseStrength);

  // 3. MULTI-SCALE SHARPENING (0.8px, 2px, 6px)
  onProgress(50, 'Step 3/6: Multi-Scale Sharpening (0.8px, 2px, 6px)...');
  await new Promise((r) => setTimeout(r, 0));
  const userSharpnessRatio = params.sharpness / 100;
  const sharpenedCanvas = await applyMultiScaleSharpening(denoisedCanvas, params.preset, userSharpnessRatio);

  // 4. LOCAL CONTRAST (CLAHE on Luminance channel)
  onProgress(70, 'Step 4/6: Local Contrast (CLAHE Adaptive Equalization)...');
  await new Promise((r) => setTimeout(r, 0));
  let baseClipLimit = 2.0; // Strong default
  if (params.preset === 'light') baseClipLimit = 1.3;
  if (params.preset === 'extreme') baseClipLimit = 3.2;
  const effectiveClipLimit = baseClipLimit * (params.clarity / 60);
  const claheCanvas = await applyCLAHE(sharpenedCanvas, effectiveClipLimit);

  // 5. AUTO LEVELS (Histogram stretch clipping 0.5% at each end)
  onProgress(85, 'Step 5/6: Auto Levels Histogram Optimization...');
  await new Promise((r) => setTimeout(r, 0));
  const autoLevelsCanvas = await applyAutoLevels(claheCanvas, 0.5);

  // 6. VIBRANCE (boost low-saturation colors without making skin tones orange)
  onProgress(95, 'Step 6/6: Smart Vibrance & Color Optimization...');
  await new Promise((r) => setTimeout(r, 0));
  const vibranceRatio = params.color / 100;
  const finalCanvas = await applySmartVibrance(autoLevelsCanvas, vibranceRatio);

  onProgress(100, 'Enhance Complete!');
  return { finalCanvas, fellBackTo2560 };
}
