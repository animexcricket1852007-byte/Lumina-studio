import React from 'react';
import { Sparkles, AlertCircle, RefreshCw, XCircle } from 'lucide-react';

interface ProgressModalProps {
  isOpen: boolean;
  title: string;
  stageMessage: string;
  progressPercent: number;
  error: {
    message: string;
    details?: { model: string; error: string; status?: number }[];
  } | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  onUseFallbackEngine?: () => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
  isOpen,
  title,
  stageMessage,
  progressPercent,
  error,
  onRetry,
  onDismissError,
  onUseFallbackEngine,
}) => {
  if (!isOpen && !error) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        {error ? (
          /* Error State */
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-semibold text-rose-300">
                AI Generation Notice
              </h3>
              <p className="text-xs text-zinc-400">
                {error.message || 'An issue occurred during image generation.'}
              </p>
            </div>

            {/* Detailed model fallback logs if available */}
            {error.details && error.details.length > 0 && (
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 max-h-40 overflow-y-auto space-y-2 text-[11px] font-mono text-left">
                <div className="text-zinc-500 font-sans font-medium text-[10px] uppercase tracking-wider">
                  Model Fallback Diagnostics
                </div>
                {error.details.map((d, i) => (
                  <div key={i} className="text-zinc-400 border-l-2 border-zinc-700 pl-2">
                    <span className="text-cyan-400 font-semibold">{d.model}:</span>{' '}
                    <span className="text-zinc-300">{d.error}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Quota / 429 Guidance */}
            {error.message?.includes('Quota') && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left space-y-1 text-xs">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Free Tier Limit Reached</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Gemini image generation models require a billing-enabled API key in{' '}
                  <span className="text-zinc-200 font-medium">Settings &gt; Secrets</span>.
                  You can proceed right now using the built-in Studio Engine!
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              {onUseFallbackEngine && (
                <button
                  type="button"
                  onClick={onUseFallbackEngine}
                  className="w-full sm:flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Use Studio Engine</span>
                </button>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full sm:flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Gemini</span>
                </button>
              )}
              {onDismissError && (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Processing State */
          <div className="space-y-5 text-center">
            {/* Glowing Icon */}
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-2xl bg-cyan-500/30 blur-xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-cyan-400 shadow-xl">
                <Sparkles className="w-8 h-8 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-white tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-zinc-400 min-h-[1.5rem]">
                {stageMessage}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                <div
                  className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, Math.min(100, progressPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                <span>gemini-2.5-flash-image</span>
                <span>{progressPercent}%</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500">
              Processing in high resolution • Retaining original quality
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
