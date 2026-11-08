import React, { useRef } from 'react';
import { SAMPLE_IMAGES } from '../utils/sampleImages';
import { SampleImage, MainSection } from '../types';
import {
  Upload,
  Sparkles,
  Zap,
  Eraser,
  Camera,
  Layers,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

interface WelcomeUploadProps {
  onImageSelected: (dataUrl: string, sampleInfo?: SampleImage) => void;
  onSelectSample: (sample: SampleImage) => void;
}

export const WelcomeUpload: React.FC<WelcomeUploadProps> = ({
  onImageSelected,
  onSelectSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a JPG or PNG image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        onImageSelected(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please drop a JPG or PNG image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        onImageSelected(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const getSectionIcon = (section: MainSection) => {
    if (section === 'enhance') {
      return <Zap className="w-3.5 h-3.5 text-amber-400" />;
    }
    return <Eraser className="w-3.5 h-3.5 text-rose-400" />;
  };

  return (
    <div className="flex-1 w-full overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl w-full space-y-7 my-auto">
        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Studio Enhancement &amp; Eraser Engine</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Lumina Photo Studio
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            4K Multi-Scale Sharpening, CLAHE Adaptive Contrast, Exemplar Patch Inpainting, and Transparent Cutouts with direct Save to Phone Gallery.
          </p>
        </div>

        {/* Upload Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="group relative border-2 border-dashed border-zinc-700 hover:border-amber-500/80 bg-zinc-900/60 hover:bg-zinc-900/90 rounded-3xl p-8 sm:p-11 text-center cursor-pointer transition-all shadow-xl hover:shadow-amber-500/10"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 group-hover:bg-amber-500/20 text-zinc-400 group-hover:text-amber-400 border border-zinc-700 group-hover:border-amber-500/40 flex items-center justify-center mx-auto transition-all shadow-md">
              <Upload className="w-7 h-7 transition-transform group-hover:-translate-y-0.5" />
            </div>

            <div className="space-y-1">
              <p className="text-sm sm:text-base font-semibold text-zinc-200">
                Tap to upload or drop your photo here
              </p>
              <p className="text-xs text-zinc-500">
                Supports JPG, PNG up to 4096px • Never shrinks in memory
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 text-zinc-300 text-xs font-medium border border-zinc-700/60">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                Select Photo
              </span>
            </div>
          </div>
        </div>

        {/* Sample Photos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Or Try with Demo Photos
            </h2>
            <span className="text-[11px] text-zinc-500">Instant one-tap testing</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {SAMPLE_IMAGES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => onSelectSample(sample)}
                className="group text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden p-2 transition-all hover:scale-[1.02] shadow-md"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-zinc-950">
                  <img
                    src={sample.url}
                    alt={sample.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-zinc-950/80 backdrop-blur border border-zinc-800">
                    {getSectionIcon(sample.recommendedSection)}
                  </div>
                </div>
                <div className="space-y-0.5 px-1">
                  <div className="text-xs font-semibold text-zinc-200 truncate">
                    {sample.title}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">
                    {sample.recommendedSection === 'enhance' ? '4K Enhance' : 'Eraser Studio'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Highlight Feature Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs text-zinc-400">
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-3 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-300 block">4K Enhance Engine</span>
              <span className="text-[11px] text-zinc-500">
                Light, Strong &amp; Extreme presets with 3-radius sharpening &amp; CLAHE.
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-3 flex items-start gap-2.5">
            <Eraser className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-300 block">Eraser &amp; Cutout</span>
              <span className="text-[11px] text-zinc-500">
                Smart Select flood fill, PatchMatch inpainting, and alpha cutouts.
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-3 flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-300 block">Save to Gallery</span>
              <span className="text-[11px] text-zinc-500">
                Native Share Sheet save for iOS Photos and Android Gallery.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
