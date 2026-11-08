import React, { useState } from 'react';
import {
  Undo2,
  Redo2,
  Download,
  Share2,
  Image as ImageIcon,
  Sparkles,
  ChevronDown,
  FileCheck,
  Smartphone,
} from 'lucide-react';

interface HeaderProps {
  hasImage: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  historyCount: number;
  imageDimensions: { width: number; height: number } | null;
  onNewImageClick: () => void;
  onSaveToGallery: () => void;
  onDownload: (format: 'image/png' | 'image/jpeg', quality?: number) => void;
  isProcessing: boolean;
  isTransparent?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  hasImage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historyCount,
  imageDimensions,
  onNewImageClick,
  onSaveToGallery,
  onDownload,
  isProcessing,
  isTransparent = false,
}) => {
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const is4K = imageDimensions && Math.max(imageDimensions.width, imageDimensions.height) >= 3800;

  return (
    <header className="relative z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-3 sm:px-6 py-2.5 flex items-center justify-between text-zinc-100">
      {/* Brand & Dimensions */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/10">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="font-bold text-sm sm:text-base tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Lumina Studio
            </h1>
            <span className="hidden xs:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              4K Pro
            </span>
          </div>
          {imageDimensions && (
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
              <span>{imageDimensions.width} × {imageDimensions.height}</span>
              {is4K && (
                <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 text-[9px]">
                  4K UHD
                </span>
              )}
              {isTransparent && (
                <span className="px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30 text-[9px]">
                  Alpha PNG
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {hasImage && (
          <>
            {/* Undo / Redo */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo || isProcessing}
                className="p-1.5 sm:p-2 sm:px-2.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-xs hidden md:inline">Undo</span>
              </button>
              <div className="w-px h-3.5 bg-zinc-800" />
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo || isProcessing}
                className="p-1.5 sm:p-2 sm:px-2.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-xs hidden md:inline">Redo</span>
              </button>
            </div>

            {/* "Save to Gallery" Button (Android & iPhone Share Sheet / Photos) */}
            <button
              type="button"
              onClick={onSaveToGallery}
              disabled={isProcessing}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-xl shadow-md shadow-emerald-900/20 transition-all disabled:opacity-40"
              title="Save directly to phone gallery (iOS Photos / Android Gallery)"
            >
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Save to Gallery</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                disabled={isProcessing}
                className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium text-xs sm:text-sm px-2.5 sm:px-3 py-2 rounded-xl transition-all disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {downloadMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDownloadMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        onDownload('image/png');
                        setDownloadMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-800 text-zinc-200 hover:text-white flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                          Download PNG
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          {isTransparent ? 'Preserves transparency' : 'Full lossless resolution'}
                        </p>
                      </div>
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono">PNG</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isTransparent) {
                          alert('Transparent results can only be saved as PNG to preserve transparency. Switching to PNG export.');
                          onDownload('image/png');
                        } else {
                          onDownload('image/jpeg', 0.95);
                        }
                        setDownloadMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-800 text-zinc-200 hover:text-white flex items-center justify-between transition-colors mt-0.5"
                    >
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5 text-blue-400" />
                          Download JPEG
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          {isTransparent ? 'Solid background (no alpha)' : 'High quality (0.95), smaller file'}
                        </p>
                      </div>
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono">JPG</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Change / New Image */}
        <button
          type="button"
          onClick={onNewImageClick}
          className="p-1.5 sm:px-2.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-xl transition-colors flex items-center gap-1.5"
          title="Open another photo"
        >
          <ImageIcon className="w-4 h-4 text-zinc-400" />
          <span className="hidden sm:inline">New</span>
        </button>
      </div>
    </header>
  );
};
