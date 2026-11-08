import React from 'react';
import { EnhanceSettings, EnhancePreset } from '../types';
import { ENHANCE_PRESETS } from '../utils/enhanceEngine';
import { Zap, Sparkles, SlidersHorizontal, Sun, Layers, Eye } from 'lucide-react';

interface EnhancePanelProps {
  settings: EnhanceSettings;
  onChangeSettings: (newSettings: EnhanceSettings) => void;
  onRunEnhance: () => void;
  isProcessing: boolean;
}

export const EnhancePanel: React.FC<EnhancePanelProps> = ({
  settings,
  onChangeSettings,
  onRunEnhance,
  isProcessing,
}) => {
  const handleSelectPreset = (preset: EnhancePreset) => {
    const base = ENHANCE_PRESETS[preset];
    onChangeSettings({
      ...base,
      targetMaxEdge: settings.targetMaxEdge,
    });
  };

  return (
    <div className="bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/90 px-3 sm:px-6 py-3 space-y-3 max-w-4xl mx-auto w-full text-zinc-200">
      {/* Top: Preset Selector & Main Action Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Presets: Light, Strong (default), Extreme */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800">
          {(['light', 'strong', 'extreme'] as EnhancePreset[]).map((p) => {
            const isActive = settings.preset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleSelectPreset(p)}
                disabled={isProcessing}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {p === 'strong' ? 'Strong (Default)' : p}
              </button>
            );
          })}
        </div>

        {/* Primary Enhance Button */}
        <button
          type="button"
          onClick={onRunEnhance}
          disabled={isProcessing}
          className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 font-bold text-xs sm:text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        >
          <Zap className="w-4 h-4 fill-zinc-950" />
          <span>Enhance to 4K</span>
        </button>
      </div>

      {/* Fine-Tuning Sliders Grid: Sharpness, Clarity, Denoise, Color */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
        {/* Sharpness */}
        <div className="bg-zinc-900/70 p-2.5 rounded-xl border border-zinc-800/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-semibold text-zinc-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Sharpness
            </span>
            <span className="font-mono text-zinc-400">{settings.sharpness}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            value={settings.sharpness}
            onChange={(e) =>
              onChangeSettings({ ...settings, sharpness: Number(e.target.value) })
            }
            className="w-full accent-amber-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Clarity (CLAHE) */}
        <div className="bg-zinc-900/70 p-2.5 rounded-xl border border-zinc-800/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-semibold text-zinc-300 flex items-center gap-1">
              <Layers className="w-3 h-3 text-cyan-400" />
              Clarity (CLAHE)
            </span>
            <span className="font-mono text-zinc-400">{settings.clarity}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.clarity}
            onChange={(e) =>
              onChangeSettings({ ...settings, clarity: Number(e.target.value) })
            }
            className="w-full accent-cyan-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Denoise */}
        <div className="bg-zinc-900/70 p-2.5 rounded-xl border border-zinc-800/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-semibold text-zinc-300 flex items-center gap-1">
              <Eye className="w-3 h-3 text-indigo-400" />
              Denoise
            </span>
            <span className="font-mono text-zinc-400">{settings.denoise}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.denoise}
            onChange={(e) =>
              onChangeSettings({ ...settings, denoise: Number(e.target.value) })
            }
            className="w-full accent-indigo-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Color / Vibrance */}
        <div className="bg-zinc-900/70 p-2.5 rounded-xl border border-zinc-800/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-semibold text-zinc-300 flex items-center gap-1">
              <Sun className="w-3 h-3 text-rose-400" />
              Color (Vibrance)
            </span>
            <span className="font-mono text-zinc-400">{settings.color}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.color}
            onChange={(e) =>
              onChangeSettings({ ...settings, color: Number(e.target.value) })
            }
            className="w-full accent-rose-400 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
