import React, { useState } from 'react';
import {
  EraserSettings,
  EraserMode,
  SelectionTool,
} from '../types';
import {
  Paintbrush,
  Eraser,
  RotateCcw,
  Wand2,
  Sparkles,
  Sliders,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

interface EraserPanelProps {
  settings: EraserSettings;
  onChangeSettings: (newSettings: EraserSettings) => void;
  onClearMask: () => void;
  onRunEraser: () => void;
  hasMask: boolean;
  isProcessing: boolean;
  autoObjectAvailable: boolean;
  onTriggerAutoObject: () => void;
  onApplyEdgeRefine: () => void;
}

export const EraserPanel: React.FC<EraserPanelProps> = ({
  settings,
  onChangeSettings,
  onClearMask,
  onRunEraser,
  hasMask,
  isProcessing,
  autoObjectAvailable,
  onTriggerAutoObject,
  onApplyEdgeRefine,
}) => {
  const [showEdgeRefine, setShowEdgeRefine] = useState(false);

  return (
    <div className="bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/90 px-3 sm:px-6 py-3 space-y-3 max-w-4xl mx-auto w-full text-zinc-200">
      {/* Mode Switcher: Mode 1 (Remove & fill) vs Mode 2 (Make transparent) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Mode Selector Tabs */}
        <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onChangeSettings({ ...settings, mode: 'remove_fill' })}
            disabled={isProcessing}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              settings.mode === 'remove_fill'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Remove &amp; Fill
          </button>
          <button
            type="button"
            onClick={() => onChangeSettings({ ...settings, mode: 'make_transparent' })}
            disabled={isProcessing}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              settings.mode === 'make_transparent'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Make Transparent
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onRunEraser}
            disabled={!hasMask || isProcessing}
            className={`flex-1 sm:flex-initial px-6 py-2 rounded-2xl font-bold text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 ${
              settings.mode === 'remove_fill'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-600/20'
                : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-cyan-600/20'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{settings.mode === 'remove_fill' ? 'Erase & Inpaint' : 'Cut Out to Transparent'}</span>
          </button>
        </div>
      </div>

      {/* Selection Tools Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        {/* Tool Selector: Brush, Smart Select, Auto Object */}
        <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800">
          {/* Brush */}
          <button
            type="button"
            onClick={() =>
              onChangeSettings({ ...settings, selectionTool: 'brush', isFixMask: false })
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              settings.selectionTool === 'brush' && !settings.isFixMask
                ? 'bg-[#FF00FF]/25 text-[#FF00FF] border border-[#FF00FF]/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Paint selection mask"
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Brush</span>
          </button>

          {/* Fix Mask (Eraser) */}
          <button
            type="button"
            onClick={() =>
              onChangeSettings({ ...settings, selectionTool: 'brush', isFixMask: true })
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              settings.selectionTool === 'brush' && settings.isFixMask
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Erase painted mask strokes to fix edges"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Fix Mask</span>
          </button>

          {/* Smart Select */}
          <button
            type="button"
            onClick={() => onChangeSettings({ ...settings, selectionTool: 'smart_select' })}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              settings.selectionTool === 'smart_select'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Tap an object on photo to select edge-aware"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Smart Select</span>
          </button>

          {/* Auto Object Select (Hidden if model fails to load) */}
          {autoObjectAvailable && (
            <button
              type="button"
              onClick={onTriggerAutoObject}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all disabled:opacity-40"
              title="Segment main object automatically using in-browser AI model"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Auto Object</span>
            </button>
          )}

          {/* Clear Mask */}
          <button
            type="button"
            onClick={onClearMask}
            disabled={!hasMask || isProcessing}
            className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Clear all selection"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dynamic Controls based on selected tool */}
        <div className="flex items-center gap-3 flex-1 min-w-[200px] justify-end">
          {/* Brush Size Slider */}
          {settings.selectionTool === 'brush' && (
            <div className="flex items-center gap-2 max-w-xs flex-1">
              <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                Size: {settings.brushSize}px
              </span>
              <input
                type="range"
                min={10}
                max={150}
                value={settings.brushSize}
                onChange={(e) =>
                  onChangeSettings({ ...settings, brushSize: Number(e.target.value) })
                }
                className="w-full accent-[#FF00FF] bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* Smart Select Tolerance Slider */}
          {settings.selectionTool === 'smart_select' && (
            <div className="flex items-center gap-2 max-w-xs flex-1">
              <span className="text-[11px] text-cyan-300 whitespace-nowrap">
                Tolerance: {settings.tolerance}
              </span>
              <input
                type="range"
                min={5}
                max={60}
                value={settings.tolerance}
                onChange={(e) =>
                  onChangeSettings({ ...settings, tolerance: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* Edge Refine Toggle Button */}
          <button
            type="button"
            onClick={() => setShowEdgeRefine(!showEdgeRefine)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showEdgeRefine
                ? 'bg-zinc-800 text-white border-zinc-700'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refine Edges</span>
            {showEdgeRefine ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Edge Refinement Shelf (Grow/Shrink, Feather, Smooth) */}
      {showEdgeRefine && (
        <div className="bg-zinc-900/90 rounded-2xl p-3 border border-zinc-800/80 space-y-2.5 animate-in fade-in duration-100">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span>Selection Edge Refinement</span>
            <button
              type="button"
              onClick={onApplyEdgeRefine}
              disabled={!hasMask || isProcessing}
              className="px-3 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-all disabled:opacity-40 flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              <span>Apply Refine</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Grow / Shrink */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Grow / Shrink</span>
                <span className="font-mono">
                  {settings.edgeRefine.growShrink > 0 ? `+${settings.edgeRefine.growShrink}` : settings.edgeRefine.growShrink}px
                </span>
              </div>
              <input
                type="range"
                min={-10}
                max={10}
                value={settings.edgeRefine.growShrink}
                onChange={(e) =>
                  onChangeSettings({
                    ...settings,
                    edgeRefine: {
                      ...settings.edgeRefine,
                      growShrink: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-cyan-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Feather */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Feather (Softness)</span>
                <span className="font-mono">{settings.edgeRefine.feather}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={settings.edgeRefine.feather}
                onChange={(e) =>
                  onChangeSettings({
                    ...settings,
                    edgeRefine: {
                      ...settings.edgeRefine,
                      feather: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-indigo-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Smooth */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Smooth (Contours)</span>
                <span className="font-mono">{settings.edgeRefine.smooth}</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={settings.edgeRefine.smooth}
                onChange={(e) =>
                  onChangeSettings({
                    ...settings,
                    edgeRefine: {
                      ...settings.edgeRefine,
                      smooth: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-rose-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mode-Specific Sub-Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
        {/* Mode 1: Quality (Fast / Better) and Tip text */}
        {settings.mode === 'remove_fill' && (
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 font-medium">Inpaint Quality:</span>
              <div className="flex bg-zinc-900 rounded-xl p-0.5 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => onChangeSettings({ ...settings, quality: 'fast' })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    settings.quality === 'fast'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Fast
                </button>
                <button
                  type="button"
                  onClick={() => onChangeSettings({ ...settings, quality: 'better' })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    settings.quality === 'better'
                      ? 'bg-rose-500 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Better (High Iterations)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Info className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
              <span>Tip: for big objects, erase in several smaller passes.</span>
            </div>
          </div>
        )}

        {/* Mode 2: Invert selection toggle */}
        {settings.mode === 'make_transparent' && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-300 font-medium">Cutout Target:</span>
              <button
                type="button"
                onClick={() =>
                  onChangeSettings({
                    ...settings,
                    invertSelection: !settings.invertSelection,
                  })
                }
                className="flex items-center gap-2 px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-cyan-300 hover:border-cyan-500/50 transition-colors"
              >
                <span>
                  {settings.invertSelection
                    ? 'Keep Object (Remove Background)'
                    : 'Remove Object (Make Hole Transparent)'}
                </span>
                <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                  Toggle
                </span>
              </button>
            </div>
            <div className="text-[11px] text-cyan-400/90 font-medium hidden sm:block">
              Decontaminates edge color fringes • Checkerboard preview
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
