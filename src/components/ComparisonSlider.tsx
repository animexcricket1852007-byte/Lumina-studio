import React, { useState, useRef, useCallback } from 'react';
import { ComparisonState, EnhanceSettings } from '../types';
import {
  Check,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Sliders,
} from 'lucide-react';

interface ComparisonSliderProps {
  comparison: ComparisonState;
  onApply: () => void;
  onTryAgain: () => void;
  onCancel: () => void;
  onUpdateEnhanceSettings?: (settings: EnhanceSettings) => void;
  isRecomputing?: boolean;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  comparison,
  onApply,
  onTryAgain,
  onCancel,
  onUpdateEnhanceSettings,
  isRecomputing = false,
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);
  const [isZoom100, setIsZoom100] = useState<boolean>(false);
  const [showSliders, setShowSliders] = useState<boolean>(comparison.mode === 'enhance');

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    isDraggingRef.current = false;
  };

  const updateSliderFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const effectivePos = isHoldingOriginal ? 100 : sliderPos;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col select-none text-zinc-100">
      {/* Top Bar: Quality Guard Score & Controls */}
      <div className="bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Sharpness Score badge */}
        <div className="flex items-center gap-2">
          {typeof comparison.sharpnessDiffPercent === 'number' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                Sharpness improved by {comparison.sharpnessDiffPercent >= 0 ? `+${comparison.sharpnessDiffPercent}` : comparison.sharpnessDiffPercent}%
              </span>
            </div>
          )}
          {comparison.isTransparent && (
            <div className="px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-medium">
              Transparent Alpha Cutout
            </div>
          )}
        </div>

        {/* Right: Hold Original & 100% Zoom & Fine-tune */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={() => setIsHoldingOriginal(true)}
            onPointerUp={() => setIsHoldingOriginal(false)}
            onPointerLeave={() => setIsHoldingOriginal(false)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              isHoldingOriginal
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
            }`}
          >
            {isHoldingOriginal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">Hold Original</span>
          </button>

          <button
            type="button"
            onClick={() => setIsZoom100(!isZoom100)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              isZoom100
                ? 'bg-amber-500 text-zinc-950 font-bold border-amber-400 shadow-sm'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
            }`}
          >
            {isZoom100 ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            <span>{isZoom100 ? 'Fit' : '100% Zoom'}</span>
          </button>

          {comparison.mode === 'enhance' && (
            <button
              type="button"
              onClick={() => setShowSliders(!showSliders)}
              className={`p-2 rounded-xl text-xs border transition-colors ${
                showSliders
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
              title="Toggle Fine-Tuning Sliders"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Split Comparison Viewport */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center p-2 sm:p-6 bg-zinc-950">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative max-w-full max-h-[calc(100vh-250px)] rounded-xl overflow-hidden shadow-2xl border border-zinc-800 cursor-ew-resize select-none touch-none ${
            comparison.isTransparent ? 'bg-checkerboard' : 'bg-zinc-900'
          }`}
          style={{
            transform: isZoom100 ? 'scale(2.0)' : 'scale(1)',
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
          }}
        >
          {/* AFTER (Enhanced / Cutout Result) - Base */}
          <img
            src={comparison.afterUrl}
            alt="Enhanced Result"
            className="block max-w-full max-h-[calc(100vh-250px)] object-contain pointer-events-none"
          />

          {/* BEFORE (Original) - Clipped Top Layer */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ width: `${effectivePos}%` }}
          >
            <img
              src={comparison.beforeUrl}
              alt="Original"
              className="block max-w-none max-h-[calc(100vh-250px)] object-contain"
              style={{
                width: containerRef.current ? containerRef.current.clientWidth : '100%',
                height: containerRef.current ? containerRef.current.clientHeight : '100%',
              }}
            />
          </div>

          {/* Draggable Divider Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.9)] pointer-events-none"
            style={{ left: `${effectivePos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-xl border-2 border-zinc-900 pointer-events-auto cursor-ew-resize font-bold text-[10px]">
              ◀ ▶
            </div>
          </div>

          {/* Labels */}
          <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-lg bg-zinc-950/80 backdrop-blur text-[11px] font-semibold text-zinc-300 border border-zinc-800 pointer-events-none">
            Original (Before)
          </div>
          <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-lg bg-amber-950/80 backdrop-blur text-[11px] font-semibold text-amber-300 border border-amber-800/80 pointer-events-none">
            {comparison.mode === 'enhance' ? '4K Enhanced (After)' : 'Result (After)'}
          </div>
        </div>
      </div>

      {/* Fine-Tuning Sliders (for Enhance mode) */}
      {showSliders && comparison.mode === 'enhance' && comparison.enhanceSettings && (
        <div className="bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 px-4 sm:px-8 py-3 text-zinc-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-5xl mx-auto text-xs">
            {/* Sharpness */}
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-amber-300">Sharpness</span>
                <span className="font-mono text-zinc-400">{comparison.enhanceSettings.sharpness}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={comparison.enhanceSettings.sharpness}
                onChange={(e) =>
                  onUpdateEnhanceSettings?.({
                    ...comparison.enhanceSettings!,
                    sharpness: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Clarity */}
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-cyan-300">Clarity (CLAHE)</span>
                <span className="font-mono text-zinc-400">{comparison.enhanceSettings.clarity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={comparison.enhanceSettings.clarity}
                onChange={(e) =>
                  onUpdateEnhanceSettings?.({
                    ...comparison.enhanceSettings!,
                    clarity: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Denoise */}
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-indigo-300">Denoise</span>
                <span className="font-mono text-zinc-400">{comparison.enhanceSettings.denoise}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={comparison.enhanceSettings.denoise}
                onChange={(e) =>
                  onUpdateEnhanceSettings?.({
                    ...comparison.enhanceSettings!,
                    denoise: Number(e.target.value),
                  })
                }
                className="w-full accent-indigo-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Color */}
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-rose-300">Color (Vibrance)</span>
                <span className="font-mono text-zinc-400">{comparison.enhanceSettings.color}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={comparison.enhanceSettings.color}
                onChange={(e) =>
                  onUpdateEnhanceSettings?.({
                    ...comparison.enhanceSettings!,
                    color: Number(e.target.value),
                  })
                }
                className="w-full accent-rose-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {isRecomputing && (
            <div className="text-center text-[11px] text-amber-400 mt-2 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Updating enhancement filters...</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="bg-zinc-950 border-t border-zinc-800/90 px-4 sm:px-8 py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Cancel */}
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors text-xs sm:text-sm font-medium"
        >
          <X className="w-4 h-4 text-zinc-400" />
          <span>Cancel</span>
        </button>

        {/* Center Hint */}
        <p className="hidden md:block text-xs text-zinc-500 text-center">
          Drag divider to compare • Only saved on Apply
        </p>

        {/* Try Again & Apply */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onTryAgain}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 transition-colors text-xs sm:text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>Try Again</span>
          </button>

          <button
            type="button"
            onClick={onApply}
            className="flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-900/30 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Apply Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
