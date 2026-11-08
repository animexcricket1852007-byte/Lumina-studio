export type MainSection = 'enhance' | 'eraser';

export type EnhancePreset = 'light' | 'strong' | 'extreme';

export interface EnhanceSettings {
  preset: EnhancePreset;
  sharpness: number; // 0 - 200%
  clarity: number;   // 0 - 100%
  denoise: number;   // 0 - 100%
  color: number;     // 0 - 100%
  targetMaxEdge: number; // up to 3840
}

export type EraserMode = 'remove_fill' | 'make_transparent';

export type SelectionTool = 'brush' | 'smart_select' | 'auto_object';

export interface EdgeRefineSettings {
  growShrink: number; // -10 to +10 px
  feather: number;    // 0 to 20 px
  smooth: number;     // 0 to 10
}

export interface EraserSettings {
  mode: EraserMode;
  selectionTool: SelectionTool;
  brushSize: number;
  isFixMask: boolean; // eraser for mask
  tolerance: number;  // 5 to 60 for smart select
  quality: 'fast' | 'better';
  invertSelection: boolean;
  edgeRefine: EdgeRefineSettings;
}

export interface HistoryItem {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
  isTransparent?: boolean;
}

export interface ComparisonState {
  beforeUrl: string;
  afterUrl: string;
  width: number;
  height: number;
  sharpnessBefore?: number;
  sharpnessAfter?: number;
  sharpnessDiffPercent?: number;
  isTransparent?: boolean;
  mode: 'enhance' | 'eraser_fill' | 'eraser_transparent';
  enhanceSettings?: EnhanceSettings;
}

export interface SaveResult {
  method: 'share' | 'download' | 'long_press';
  success: boolean;
  message: string;
  imageUrl?: string;
}

export interface SampleImage {
  id: string;
  title: string;
  description: string;
  url: string;
  recommendedSection: MainSection;
}

export interface SharpnessResult {
  score: number;
  variance: number;
}

export interface EnhanceConfig {
  sharpness: number;
  radius: number;
  clarity: number;
  faithful: number;
  targetMaxEdge: number;
}
