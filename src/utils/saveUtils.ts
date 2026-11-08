import { SaveResult } from '../types';

/**
 * Universal mobile & desktop save pipeline (Android + iPhone + Desktop)
 * 1. navigator.share({ files: [File] }) -> triggers native iOS "Save to Photos" / Android "Save image"
 * 2. Fallback to Blob download link (a[download])
 * 3. Fallback to full-screen view modal ("Long-press and tap Save image")
 */
export async function saveToGalleryOrDevice(
  canvas: HTMLCanvasElement,
  format: 'image/png' | 'image/jpeg' = 'image/jpeg',
  quality: number = 0.95,
  isTransparent: boolean = false
): Promise<SaveResult> {
  // Transparent images MUST be saved as PNG
  const finalFormat = isTransparent ? 'image/png' : format;
  const ext = finalFormat === 'image/png' ? 'png' : 'jpg';
  const filename = `lumina-${Date.now()}-${canvas.width}x${canvas.height}.${ext}`;

  // 1. Convert canvas to Blob
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), finalFormat, quality);
  });

  if (!blob) {
    return {
      method: 'download',
      success: false,
      message: 'Failed to generate image file.',
    };
  }

  const file = new File([blob], filename, { type: finalFormat });

  // 2. Try native mobile share sheet (iOS Safari "Save to Photos" / Android "Save Image")
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: 'Lumina Studio Photo',
      });
      return {
        method: 'share',
        success: true,
        message: 'Shared successfully! Pick "Save Image" or "Save to Photos" in the sheet.',
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User closed the share sheet
        return {
          method: 'share',
          success: true,
          message: 'Share sheet closed.',
        };
      }
      console.warn('navigator.share failed, falling back to download link:', err);
    }
  }

  // 3. Fallback to Blob download link
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // If on iOS or Android, a.click() may sometimes be silently ignored by the browser
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      // Provide full-screen modal fallback so mobile users can long-press and save
      return {
        method: 'long_press',
        success: true,
        message: 'Tap & hold the image to save to your photos gallery.',
        imageUrl: url,
      };
    }

    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return {
      method: 'download',
      success: true,
      message: `Downloaded as ${filename}`,
    };
  } catch (downloadErr) {
    console.warn('Download link failed, falling back to full-screen view:', downloadErr);
    const dataUrl = canvas.toDataURL(finalFormat, quality);
    return {
      method: 'long_press',
      success: true,
      message: 'Long-press the image and tap "Save image".',
      imageUrl: dataUrl,
    };
  }
}
