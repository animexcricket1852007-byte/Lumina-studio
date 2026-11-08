import React from 'react';
import { MainSection } from '../types';
import { Zap, Eraser, Sparkles } from 'lucide-react';

interface ToolbarProps {
  currentSection: MainSection;
  onSelectSection: (section: MainSection) => void;
  isProcessing: boolean;
  hasImage: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentSection,
  onSelectSection,
  isProcessing,
  hasImage,
}) => {
  if (!hasImage) return null;

  return (
    <div className="relative z-20 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 px-3 sm:px-6 py-2">
      <div className="max-w-xl mx-auto flex items-center justify-center gap-3">
        {/* Enhance 4K Tab */}
        <button
          type="button"
          onClick={() => onSelectSection('enhance')}
          disabled={isProcessing}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl transition-all border text-center ${
            currentSection === 'enhance'
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-lg shadow-amber-500/15 ring-1 ring-amber-500/30 font-semibold'
              : 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white font-medium'
          } disabled:opacity-40 disabled:pointer-events-none`}
        >
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 fill-amber-400/30" />
          </div>
          <div className="text-left">
            <div className="text-xs sm:text-sm font-bold leading-tight">Enhance to 4K</div>
            <div className="text-[10px] text-amber-400/80 hidden xs:block">Upscale, Denoise &amp; CLAHE</div>
          </div>
        </button>

        {/* Eraser Tab */}
        <button
          type="button"
          onClick={() => onSelectSection('eraser')}
          disabled={isProcessing}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl transition-all border text-center ${
            currentSection === 'eraser'
              ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-lg shadow-rose-500/15 ring-1 ring-rose-500/30 font-semibold'
              : 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white font-medium'
          } disabled:opacity-40 disabled:pointer-events-none`}
        >
          <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <Eraser className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="text-xs sm:text-sm font-bold leading-tight">Eraser Studio</div>
            <div className="text-[10px] text-rose-400/80 hidden xs:block">Remove &amp; Fill / Cutout</div>
          </div>
        </button>
      </div>
    </div>
  );
};
