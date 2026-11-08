import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MainSection, EraserSettings } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Wand2,
  Paintbrush,
} from 'lucide-react';

interface CanvasEditorProps {
  imageSrc: string;
  section: MainSection;
  eraserSettings: EraserSettings;
  maskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  imageCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onMaskChange?: (hasMask: boolean) => void;
  onSmartSelect?: (x: number, y: number) => void;
  isProcessing?: boolean;
  isTransparent?: boolean;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageSrc,
  section,
  eraserSettings,
  maskCanvasRef,
  imageCanvasRef,
  onMaskChange,
  onSmartSelect,
  isProcessing = false,
  isTransparent = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isZoom100, setIsZoom100] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawnMask, setHasDrawnMask] = useState<boolean>(false);

  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const isEraserActive = section === 'eraser';

  // Load and render base image to imageCanvas
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const imgCanvas = imageCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!imgCanvas || !maskCanvas) return;

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      imgCanvas.width = w;
      imgCanvas.height = h;
      maskCanvas.width = w;
      maskCanvas.height = h;

      const ctx = imgCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // Clear mask canvas
      const mCtx = maskCanvas.getContext('2d')!;
      mCtx.clearRect(0, 0, w, h);

      setHasDrawnMask(false);
      onMaskChange?.(false);
    };
    img.src = imageSrc;
  }, [imageSrc, imageCanvasRef, maskCanvasRef, onMaskChange]);

  // Convert client pointer coordinates to internal canvas pixel coordinates
  const getCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [maskCanvasRef]);

  // Brush drawing routines
  const drawStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;
      const ctx = maskCanvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = eraserSettings.brushSize;

      if (eraserSettings.isFixMask) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#FF00FF';
      }

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();

      if (!eraserSettings.isFixMask) {
        setHasDrawnMask(true);
        onMaskChange?.(true);
      }
    },
    [eraserSettings, maskCanvasRef, onMaskChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEraserActive || isProcessing) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (eraserSettings.selectionTool === 'smart_select') {
      // Smart Select: edge-aware flood fill on tap
      onSmartSelect?.(coords.x, coords.y);
      setHasDrawnMask(true);
      onMaskChange?.(true);
      return;
    }

    if (eraserSettings.selectionTool === 'brush') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDrawing(true);
      lastPointRef.current = coords;
      drawStroke(coords, coords);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current || !isEraserActive || isProcessing) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    drawStroke(lastPointRef.current, coords);
    lastPointRef.current = coords;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const toggle100PercentZoom = () => {
    setIsZoom100(!isZoom100);
    setZoomLevel(isZoom100 ? 1 : 2.0);
  };

  return (
    <div className="relative flex-1 flex flex-col h-full overflow-hidden bg-zinc-950 select-none">
      {/* Top Floating Controls */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Status Indicator */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {isEraserActive && (
            <div className="px-3 py-1.5 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-700/80 text-xs text-zinc-200 flex items-center gap-2 shadow-lg">
              {eraserSettings.selectionTool === 'smart_select' ? (
                <>
                  <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Smart Select (Tap object to add)</span>
                </>
              ) : (
                <>
                  <Paintbrush className="w-3.5 h-3.5 text-[#FF00FF]" />
                  <span>Brush Selection</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Zoom & Fit controls */}
        <div className="flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl p-1 shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={toggle100PercentZoom}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              isZoom100
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
            }`}
            title="Inspect 100% pixel detail"
          >
            {isZoom100 ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            <span>{isZoom100 ? 'Fit' : '100%'}</span>
          </button>
          <div className="w-px h-3.5 bg-zinc-800" />
          <button
            type="button"
            onClick={() => {
              setIsZoom100(false);
              setZoomLevel(1);
            }}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title="Fit to screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full overflow-auto flex items-center justify-center p-2 sm:p-6"
        style={{ touchAction: isEraserActive ? 'none' : 'auto' }}
      >
        <div
          className={`relative transition-transform duration-200 origin-center flex items-center justify-center shadow-2xl rounded-xl overflow-hidden border border-zinc-800/80 ${
            isTransparent ? 'bg-checkerboard' : 'bg-zinc-900'
          }`}
          style={{
            transform: isZoom100 ? `scale(${zoomLevel})` : 'scale(1)',
            maxHeight: isZoom100 ? 'none' : 'calc(100vh - 230px)',
            maxWidth: isZoom100 ? 'none' : '100%',
          }}
        >
          {/* Base Image Canvas */}
          <canvas
            ref={imageCanvasRef}
            className="block max-w-full max-h-full object-contain pointer-events-none"
            style={{
              maxHeight: isZoom100 ? 'none' : 'calc(100vh - 230px)',
            }}
          />

          {/* Mask Overlay Canvas */}
          <canvas
            ref={maskCanvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`absolute inset-0 w-full h-full ${
              isEraserActive
                ? eraserSettings.selectionTool === 'smart_select'
                  ? 'cursor-pointer opacity-75'
                  : 'cursor-crosshair opacity-80'
                : 'pointer-events-none opacity-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
