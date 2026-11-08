import React from 'react';
import { X, Share2, Download, CheckCircle2, AlertCircle } from 'lucide-react';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  message: string;
  isSuccess: boolean;
  method: 'share' | 'download' | 'long_press' | null;
  isTransparent?: boolean;
}

export const SaveModal: React.FC<SaveModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  message,
  isSuccess,
  method,
  isTransparent = false,
}) => {
  if (!isOpen) return null;

  const isLongPressView = method === 'long_press' && imageUrl;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl text-zinc-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <h3 className="font-semibold text-sm sm:text-base text-zinc-200">
              {isLongPressView ? 'Save to Photos Gallery' : 'Export Status'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Long-press view for Mobile Gallery Saving */}
        {isLongPressView ? (
          <div className="flex-1 flex flex-col items-center justify-center py-3 overflow-hidden">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 mb-3 text-center w-full">
              <p className="text-xs sm:text-sm font-semibold text-amber-300">
                👉 Long-press the image below and tap &quot;Save image&quot;
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                This saves the high-resolution photo directly into your Camera Roll / Photos app.
              </p>
            </div>

            <div
              className={`relative max-h-[50vh] w-full flex items-center justify-center rounded-2xl overflow-hidden border border-zinc-700/80 p-1 ${
                isTransparent ? 'bg-checkerboard' : 'bg-zinc-950'
              }`}
            >
              <img
                src={imageUrl!}
                alt="Long press to save"
                className="max-h-[48vh] max-w-full object-contain rounded-xl select-auto"
                style={{ WebkitTouchCallout: 'default' }}
              />
            </div>
          </div>
        ) : (
          /* Feedback Toast */
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-zinc-300">{message}</p>
            {isTransparent && (
              <p className="text-xs text-cyan-400">
                Preserved transparent alpha background in lossless PNG.
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
          {imageUrl && (
            <a
              href={imageUrl}
              download="lumina-photo.png"
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Download File</span>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
