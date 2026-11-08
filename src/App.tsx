import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MainSection,
  EnhanceSettings,
  EraserSettings,
  HistoryItem,
  ComparisonState,
  SaveResult,
} from './types';
import {
  loadImage,
  constrainTo4096,
  canvasToBase64,
} from './utils/imageProcessing';
import {
  ENHANCE_PRESETS,
  runEnhancePipeline,
} from './utils/enhanceEngine';
import {
  smartSelectFloodFill,
  checkAutoObjectAvailable,
  runAutoObjectSegmentation,
  applyEdgeRefine,
  runRemoveAndFill,
  runMakeTransparent,
} from './utils/eraserEngine';
import { saveToGalleryOrDevice } from './utils/saveUtils';
import { Header } from './components/Header';
import { CanvasEditor } from './components/CanvasEditor';
import { Toolbar } from './components/Toolbar';
import { EnhancePanel } from './components/EnhancePanel';
import { EraserPanel } from './components/EraserPanel';
import { ComparisonSlider } from './components/ComparisonSlider';
import { ProgressModal } from './components/ProgressModal';
import { WelcomeUpload } from './components/WelcomeUpload';
import { SaveModal } from './components/SaveModal';

export default function App() {
  // Navigation Section: 'enhance' | 'eraser'
  const [currentSection, setCurrentSection] = useState<MainSection>('enhance');

  // History stack
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Settings for Enhance
  const [enhanceSettings, setEnhanceSettings] = useState<EnhanceSettings>(
    ENHANCE_PRESETS.strong
  );

  // Settings for Eraser
  const [eraserSettings, setEraserSettings] = useState<EraserSettings>({
    mode: 'remove_fill',
    selectionTool: 'brush',
    brushSize: 36,
    isFixMask: false,
    tolerance: 25,
    quality: 'better',
    invertSelection: false,
    edgeRefine: {
      growShrink: 0,
      feather: 6,
      smooth: 2,
    },
  });

  // Mask status
  const [hasMaskDrawn, setHasMaskDrawn] = useState<boolean>(false);
  const [autoObjectAvailable, setAutoObjectAvailable] = useState<boolean>(false);

  // Comparison State
  const [comparison, setComparison] = useState<ComparisonState | null>(null);
  const [isRecomputing, setIsRecomputing] = useState<boolean>(false);

  // Progress Modal State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressTitle, setProgressTitle] = useState<string>('');
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [processingError, setProcessingError] = useState<{
    message: string;
    details?: { model: string; error: string; status?: number }[];
  } | null>(null);

  // Save Modal State
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  // Canvas Refs
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cached assets for Try Again / Live parameter updates
  const lastActionRef = useRef<(() => void) | null>(null);
  const cachedOriginalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cachedUpscaledOriginalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Check Auto Object Select availability on startup
  useEffect(() => {
    checkAutoObjectAvailable().then((avail) => setAutoObjectAvailable(avail));
  }, []);

  // Active History item
  const currentItem =
    historyIndex >= 0 && historyIndex < history.length ? history[historyIndex] : null;

  // Push to history
  const pushToHistory = useCallback(
    (name: string, dataUrl: string, width: number, height: number, isTransparent = false) => {
      const newItem: HistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name,
        dataUrl,
        width,
        height,
        timestamp: Date.now(),
        isTransparent,
      };

      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, newItem];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setComparison(null);
    }
  }, [historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setComparison(null);
    }
  }, [historyIndex, history.length]);

  // Keyboard Shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Load new image
  const handleLoadImage = useCallback(async (dataUrl: string, sampleInfo?: any) => {
    try {
      setIsProcessing(true);
      setProgressTitle('Loading Photo');
      setProgressStage('Constraining to maximum 4096px in memory...');
      setProgressPercent(30);

      const img = await loadImage(dataUrl);
      const { canvas, width, height } = constrainTo4096(img);

      const finalDataUrl = canvasToBase64(canvas, 'image/jpeg', 0.95);
      const initialName = sampleInfo ? sampleInfo.title : 'Original Photo';

      setHistory([
        {
          id: `init-${Date.now()}`,
          name: initialName,
          dataUrl: finalDataUrl,
          width,
          height,
          timestamp: Date.now(),
          isTransparent: false,
        },
      ]);
      setHistoryIndex(0);
      setComparison(null);
      setHasMaskDrawn(false);
      setCurrentSection('enhance');

      setIsProcessing(false);
      setProgressPercent(100);
    } catch (err: any) {
      console.error('Failed to load image:', err);
      setIsProcessing(false);
      setProcessingError({
        message: 'Could not load photo. Please ensure it is a valid JPG or PNG.',
      });
    }
  }, []);

  // -------------------------------------------------------------
  // ACTION: RUN ENHANCE PIPELINE (Light / Strong / Extreme)
  // -------------------------------------------------------------
  const handleRunEnhance = async (customSettings?: EnhanceSettings) => {
    if (!imageCanvasRef.current || !currentItem) return;

    const settings = customSettings ?? enhanceSettings;
    lastActionRef.current = () => handleRunEnhance(settings);

    try {
      setIsProcessing(true);
      setProcessingError(null);
      setProgressTitle(`Photo Enhancement (${settings.preset.toUpperCase()})`);

      const origCanvas = imageCanvasRef.current;
      cachedOriginalCanvasRef.current = origCanvas;

      const result = await runEnhancePipeline(
        origCanvas,
        settings,
        (pct, stage) => {
          setProgressPercent(pct);
          setProgressStage(stage);
        }
      );

      cachedUpscaledOriginalCanvasRef.current = result.upscaledOriginalCanvas;

      const beforeUrl = canvasToBase64(result.upscaledOriginalCanvas, 'image/jpeg', 0.95);
      const afterUrl = canvasToBase64(result.enhancedCanvas, 'image/jpeg', 0.95);

      setComparison({
        beforeUrl,
        afterUrl,
        width: result.enhancedCanvas.width,
        height: result.enhancedCanvas.height,
        sharpnessBefore: result.sharpnessBefore,
        sharpnessAfter: result.sharpnessAfter,
        sharpnessDiffPercent: result.sharpnessDiffPercent,
        isTransparent: false,
        mode: 'enhance',
        enhanceSettings: settings,
      });

      setIsProcessing(false);
      setProgressPercent(100);
    } catch (err: any) {
      console.error('Enhance pipeline failed:', err);
      setIsProcessing(false);
      setProcessingError({
        message: err.message || 'Enhancement pipeline failed.',
      });
    }
  };

  // Live Fine-Tuning in Comparison View
  const handleUpdateEnhanceInComparison = async (newSettings: EnhanceSettings) => {
    if (!cachedOriginalCanvasRef.current || !comparison) return;

    try {
      setIsRecomputing(true);
      setEnhanceSettings(newSettings);

      const result = await runEnhancePipeline(
        cachedOriginalCanvasRef.current,
        newSettings
      );

      const afterUrl = canvasToBase64(result.enhancedCanvas, 'image/jpeg', 0.95);

      setComparison((prev) =>
        prev
          ? {
              ...prev,
              afterUrl,
              sharpnessAfter: result.sharpnessAfter,
              sharpnessDiffPercent: result.sharpnessDiffPercent,
              enhanceSettings: newSettings,
            }
          : null
      );
    } catch (err) {
      console.error('Failed to recompute enhance filters:', err);
    } finally {
      setIsRecomputing(false);
    }
  };

  // -------------------------------------------------------------
  // ACTION: ERASER STUDIO (Remove & Fill OR Make Transparent)
  // -------------------------------------------------------------
  const handleRunEraser = async () => {
    if (!imageCanvasRef.current || !maskCanvasRef.current || !currentItem) return;

    lastActionRef.current = () => handleRunEraser();

    try {
      setIsProcessing(true);
      setProcessingError(null);

      const origCanvas = imageCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;

      const beforeUrl = currentItem.dataUrl;

      if (eraserSettings.mode === 'remove_fill') {
        setProgressTitle('Exemplar Patch Inpainting');
        const filled = await runRemoveAndFill(
          origCanvas,
          maskCanvas,
          eraserSettings.quality,
          (pct, stage) => {
            setProgressPercent(pct);
            setProgressStage(stage);
          }
        );

        const afterUrl = canvasToBase64(filled, 'image/jpeg', 0.95);

        setComparison({
          beforeUrl,
          afterUrl,
          width: filled.width,
          height: filled.height,
          isTransparent: false,
          mode: 'eraser_fill',
        });
      } else {
        // Mode 2: Make transparent
        setProgressTitle('Creating Transparent Alpha Cutout');
        const transparentCanvas = await runMakeTransparent(
          origCanvas,
          maskCanvas,
          eraserSettings.invertSelection,
          (pct, stage) => {
            setProgressPercent(pct);
            setProgressStage(stage);
          }
        );

        const afterUrl = canvasToBase64(transparentCanvas, 'image/png');

        setComparison({
          beforeUrl,
          afterUrl,
          width: transparentCanvas.width,
          height: transparentCanvas.height,
          isTransparent: true,
          mode: 'eraser_transparent',
        });
      }

      setIsProcessing(false);
      setProgressPercent(100);
    } catch (err: any) {
      console.error('Eraser execution failed:', err);
      setIsProcessing(false);
      setProcessingError({
        message: err.message || 'Eraser processing failed.',
      });
    }
  };

  // Smart Select Handler (Tap coordinate flood fill)
  const handleSmartSelect = (clickX: number, clickY: number) => {
    if (!imageCanvasRef.current || !maskCanvasRef.current) return;

    const updatedMask = smartSelectFloodFill(
      imageCanvasRef.current,
      maskCanvasRef.current,
      clickX,
      clickY,
      eraserSettings.tolerance
    );

    const mCtx = maskCanvasRef.current.getContext('2d')!;
    mCtx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    mCtx.drawImage(updatedMask, 0, 0);

    setHasMaskDrawn(true);
  };

  // Auto Object Segmentation Trigger
  const handleTriggerAutoObject = async () => {
    if (!imageCanvasRef.current || !maskCanvasRef.current) return;

    try {
      setIsProcessing(true);
      setProgressTitle('Auto Object Segmentation');
      const maskResult = await runAutoObjectSegmentation(
        imageCanvasRef.current,
        (pct, stage) => {
          setProgressPercent(pct);
          setProgressStage(stage);
        }
      );

      if (maskResult) {
        const mCtx = maskCanvasRef.current.getContext('2d')!;
        mCtx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
        mCtx.drawImage(maskResult, 0, 0);
        setHasMaskDrawn(true);
      } else {
        alert('Could not segment object automatically. Use Smart Select or the Brush to paint selection.');
      }
    } catch (err) {
      console.warn('Auto object trigger failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply Edge Refine to current mask
  const handleApplyEdgeRefine = () => {
    if (!maskCanvasRef.current) return;
    const refined = applyEdgeRefine(maskCanvasRef.current, eraserSettings.edgeRefine);
    const mCtx = maskCanvasRef.current.getContext('2d')!;
    mCtx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    mCtx.drawImage(refined, 0, 0);
  };

  // Clear mask
  const handleClearMask = () => {
    if (maskCanvasRef.current) {
      const ctx = maskCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
      setHasMaskDrawn(false);
    }
  };

  // -------------------------------------------------------------
  // COMPARISON ACTIONS: APPLY, TRY AGAIN, CANCEL
  // -------------------------------------------------------------
  const handleApplyComparison = async () => {
    if (!comparison) return;

    try {
      setIsProcessing(true);
      setProgressTitle('Applying Changes');
      setProgressStage('Saving step to history...');
      setProgressPercent(70);

      const img = await loadImage(comparison.afterUrl);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const title =
        comparison.mode === 'enhance'
          ? `4K Enhance (${comparison.enhanceSettings?.preset || 'Preset'})`
          : comparison.mode === 'eraser_fill'
          ? 'Erase & Fill'
          : 'Transparent Cutout';

      pushToHistory(title, comparison.afterUrl, w, h, comparison.isTransparent);

      setComparison(null);
      handleClearMask();

      setIsProcessing(false);
      setProgressPercent(100);
    } catch (e) {
      console.error('Failed to apply:', e);
      setIsProcessing(false);
    }
  };

  const handleTryAgain = () => {
    setComparison(null);
    if (lastActionRef.current) {
      lastActionRef.current();
    }
  };

  // -------------------------------------------------------------
  // UNIVERSAL MOBILE & DESKTOP SAVE
  // -------------------------------------------------------------
  const handleSaveToGallery = async () => {
    if (!imageCanvasRef.current || !currentItem) return;

    try {
      const format = currentItem.isTransparent ? 'image/png' : 'image/jpeg';
      const result = await saveToGalleryOrDevice(
        imageCanvasRef.current,
        format,
        0.95,
        currentItem.isTransparent
      );

      setSaveResult(result);
      setSaveModalOpen(true);
    } catch (err: any) {
      console.error('Save failed:', err);
      setSaveResult({
        method: 'download',
        success: false,
        message: err?.message || 'Could not save photo.',
      });
      setSaveModalOpen(true);
    }
  };

  const handleDownloadDirect = async (format: 'image/png' | 'image/jpeg', quality = 0.95) => {
    if (!imageCanvasRef.current || !currentItem) return;

    try {
      const finalFormat = currentItem.isTransparent ? 'image/png' : format;
      const result = await saveToGalleryOrDevice(
        imageCanvasRef.current,
        finalFormat,
        quality,
        currentItem.isTransparent
      );

      setSaveResult(result);
      if (result.method === 'long_press') {
        setSaveModalOpen(true);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Universal Header with Save to Gallery */}
      <Header
        hasImage={!!currentItem}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        historyCount={historyIndex + 1}
        imageDimensions={
          currentItem ? { width: currentItem.width, height: currentItem.height } : null
        }
        onNewImageClick={() => {
          setHistory([]);
          setHistoryIndex(-1);
          setComparison(null);
        }}
        onSaveToGallery={handleSaveToGallery}
        onDownload={handleDownloadDirect}
        isProcessing={isProcessing}
        isTransparent={currentItem?.isTransparent}
      />

      {/* Main Workspace Area */}
      {currentItem ? (
        <CanvasEditor
          imageSrc={currentItem.dataUrl}
          section={currentSection}
          eraserSettings={eraserSettings}
          maskCanvasRef={maskCanvasRef}
          imageCanvasRef={imageCanvasRef}
          onMaskChange={setHasMaskDrawn}
          onSmartSelect={handleSmartSelect}
          isProcessing={isProcessing}
          isTransparent={currentItem?.isTransparent}
        />
      ) : (
        <WelcomeUpload
          onImageSelected={(url) => handleLoadImage(url)}
          onSelectSample={(sample) => handleLoadImage(sample.url, sample)}
        />
      )}

      {/* Section Specific Bottom Shelf */}
      {currentItem && currentSection === 'enhance' && (
        <EnhancePanel
          settings={enhanceSettings}
          onChangeSettings={setEnhanceSettings}
          onRunEnhance={() => handleRunEnhance()}
          isProcessing={isProcessing}
        />
      )}

      {currentItem && currentSection === 'eraser' && (
        <EraserPanel
          settings={eraserSettings}
          onChangeSettings={setEraserSettings}
          onClearMask={handleClearMask}
          onRunEraser={handleRunEraser}
          hasMask={hasMaskDrawn}
          isProcessing={isProcessing}
          autoObjectAvailable={autoObjectAvailable}
          onTriggerAutoObject={handleTriggerAutoObject}
          onApplyEdgeRefine={handleApplyEdgeRefine}
        />
      )}

      {/* Section Switcher Tabs: Enhance 4K vs Eraser Studio */}
      <Toolbar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        isProcessing={isProcessing}
        hasImage={!!currentItem}
      />

      {/* Before / After Comparison Slider Modal */}
      {comparison && (
        <ComparisonSlider
          comparison={comparison}
          onApply={handleApplyComparison}
          onTryAgain={handleTryAgain}
          onCancel={() => setComparison(null)}
          onUpdateEnhanceSettings={handleUpdateEnhanceInComparison}
          isRecomputing={isRecomputing}
        />
      )}

      {/* Universal Save Modal (Long-press view fallback on mobile) */}
      <SaveModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        imageUrl={saveResult?.imageUrl || null}
        message={saveResult?.message || ''}
        isSuccess={saveResult?.success ?? true}
        method={saveResult?.method || null}
        isTransparent={currentItem?.isTransparent}
      />

      {/* Progress & Processing Modal */}
      <ProgressModal
        isOpen={isProcessing}
        title={progressTitle}
        stageMessage={progressStage}
        progressPercent={progressPercent}
        error={processingError}
        onRetry={() => {
          setProcessingError(null);
          if (lastActionRef.current) {
            lastActionRef.current();
          }
        }}
        onDismissError={() => setProcessingError(null)}
      />
    </div>
  );
}
