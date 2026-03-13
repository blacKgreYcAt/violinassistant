import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X, ZoomIn, ZoomOut, ExternalLink, Camera, LayoutDashboard, Loader2, AlertCircle } from 'lucide-react';
import { VideoRecorder } from './VideoRecorder';
import { cn } from '../lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

// Use a reliable CDN for the worker - fixed version to match package.json
const PDFJS_VERSION = '4.0.379';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

interface Score {
  id: string;
  name: string;
  type: 'file' | 'link';
  data: string | string[];
  date: number;
}

interface ScoreViewerProps {
  score: Score;
  onClose: () => void;
  className?: string;
}

export const ScoreViewer: React.FC<ScoreViewerProps> = ({ score, onClose, className }) => {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [currentPage, setCurrentPage] = useState(0); // For multi-image scores
  const [pdfPage, setPdfPage] = useState(1); // For PDF scores
  const [numPages, setNumPages] = useState(0); // Total pages in PDF
  const [displayMode, setDisplayMode] = useState<'fit-width' | 'fit-page'>('fit-page');
  const [isLoading, setIsLoading] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const pages = Array.isArray(score.data) ? score.data : [score.data];
  const totalImagePages = pages.length;
  const isPDF = pages[0].startsWith('data:application/pdf');

  // Load PDF Document
  useEffect(() => {
    if (!isPDF || useNativeViewer) return;

    let isMounted = true;
    const loadPdf = async () => {
      setIsLoading(true);
      setRenderError(null);
      try {
        const base64Data = pages[0].split(',')[1];
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ 
          data: bytes,
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/cmaps/`,
          cMapPacked: true,
        });
        
        const pdf = await loadingTask.promise;
        
        if (isMounted) {
          pdfDocRef.current = pdf;
          setNumPages(pdf.numPages);
          setPdfPage(1);
        }
      } catch (error: any) {
        console.error('PDF loading error:', error);
        if (isMounted) {
          setRenderError("無法讀取 PDF 檔案。這可能是因為瀏覽器限制或檔案過大。");
          // If loading fails, suggest native viewer
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPdf();
    return () => {
      isMounted = false;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [isPDF, pages, useNativeViewer]);

  // Render PDF Page to Image
  useEffect(() => {
    if (!isPDF || !pdfDocRef.current || useNativeViewer) return;

    let isMounted = true;
    const renderPageToImage = async () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      setIsLoading(true);
      try {
        const pdf = pdfDocRef.current;
        const pageToRender = Math.min(Math.max(pdfPage, 1), pdf.numPages);
        const page = await pdf.getPage(pageToRender);
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        // Render at a higher scale for better quality on iPad
        const viewport = page.getViewport({ scale: 2.0 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
        
        if (isMounted) {
          const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
          setRenderedImageUrl(imageUrl);
          setRenderError(null);
        }
      } catch (error: any) {
        if (error.name === 'RenderingCancelledException') return;
        console.error('PDF rendering error:', error);
        if (isMounted) setRenderError("頁面渲染失敗。請嘗試使用「原生模式」查看。");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    renderPageToImage();
    return () => { isMounted = false; };
  }, [isPDF, pdfPage, numPages, useNativeViewer]);

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 3));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const nextPage = () => {
    if (isPDF) {
      setPdfPage(prev => Math.min(prev + 1, numPages));
    } else {
      setCurrentPage(prev => Math.min(prev + 1, totalImagePages - 1));
    }
  };

  const prevPage = () => {
    if (isPDF) {
      setPdfPage(prev => Math.max(prev - 1, 1));
    } else {
      setCurrentPage(prev => Math.max(prev - 1, 0));
    }
  };

  const openInNewTab = () => {
    const base64 = pages[currentPage];
    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <head><title>${score.name}</title></head>
          <body style="margin:0;padding:0;"><embed src="${base64}" type="application/pdf" width="100%" height="100%" /></body>
        </html>
      `);
      win.document.close();
    }
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-bg-warm flex flex-col",
      className
    )}>
      {/* Toolbar */}
      <div className="h-16 bg-surface-warm border-b border-white/5 flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
          >
            <X size={24} />
          </button>
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <h2 className="text-text-warm font-bold tracking-tight truncate max-w-[100px] sm:max-w-md text-sm sm:text-base">
            {score.name}
          </h2>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Display Mode Toggles */}
          <div className="hidden lg:flex items-center bg-white/5 rounded-xl p-1 gap-1">
            <button 
              onClick={() => {
                setDisplayMode('fit-page');
                setZoom(1);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                displayMode === 'fit-page' ? "bg-accent-warm text-bg-warm" : "text-text-muted hover:text-text-warm"
              )}
            >
              符合頁面
            </button>
            <button 
              onClick={() => setDisplayMode('fit-width')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                displayMode === 'fit-width' ? "bg-accent-warm text-bg-warm" : "text-text-muted hover:text-text-warm"
              )}
            >
              符合寬度
            </button>
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2 hidden sm:block" />
          
          {isPDF && (
            <div className="flex items-center bg-white/5 rounded-xl p-1 gap-1">
              <button 
                onClick={() => setUseNativeViewer(false)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  !useNativeViewer ? "bg-accent-warm text-bg-warm" : "text-text-muted hover:text-text-warm"
                )}
              >
                圖片模式
              </button>
              <button 
                onClick={() => setUseNativeViewer(true)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  useNativeViewer ? "bg-accent-warm text-bg-warm" : "text-text-muted hover:text-text-warm"
                )}
              >
                原生模式
              </button>
            </div>
          )}

          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2 hidden sm:block" />
          
          {isPDF && !useNativeViewer && (
            <button 
              onClick={openInNewTab}
              className="p-1 md:p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all flex items-center gap-2"
              title="在新分頁開啟 PDF"
            >
              <ExternalLink size={18} />
              <span className="text-[10px] font-bold hidden lg:block">新分頁開啟</span>
            </button>
          )}

          {!useNativeViewer && (
            <>
              <button 
                onClick={() => handleZoom(-0.1)}
                className="p-1 md:p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-[10px] md:text-xs font-bold text-text-muted w-8 md:w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button 
                onClick={() => handleZoom(0.1)}
                className="p-1 md:p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
              >
                <ZoomIn size={18} />
              </button>
            </>
          )}
          
          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2" />
          
          <button 
            onClick={toggleFullscreen}
            className="p-1 md:p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2" />

          <button 
            onClick={() => setShowRecorder(!showRecorder)}
            className={cn(
              "p-1 md:p-2 rounded-xl transition-all flex items-center gap-2",
              showRecorder ? "bg-red-500 text-white" : "text-text-muted hover:text-text-warm hover:bg-white/5"
            )}
          >
            <Camera size={18} />
            <span className="text-[10px] font-bold hidden sm:block">錄影模式</span>
          </button>
        </div>
      </div>

      {/* Recorder Overlay */}
      {showRecorder && (
        <div className="absolute top-20 right-4 z-[70] w-full max-w-[320px] animate-in slide-in-from-right-4">
          <VideoRecorder activeScoreName={score.name} className="shadow-2xl border-accent-warm/20" />
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden bg-bg-warm relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-warm/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-accent-warm animate-spin" />
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest">渲染樂譜中...</p>
            </div>
          </div>
        )}

        {renderError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg-warm p-6">
            <div className="flex flex-col items-center gap-4 text-center max-w-xs">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-sm font-bold text-text-warm">{renderError}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-text-warm rounded-xl text-xs font-bold transition-all"
              >
                重新整理頁面
              </button>
            </div>
          </div>
        )}

        {score.type === 'link' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-12 text-center gap-4 sm:gap-6 bg-white">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400">
              <ExternalLink size={32} />
            </div>
            <div className="max-w-xs">
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-2">外部樂譜連結</h3>
              <p className="text-neutral-500 text-xs sm:text-sm">
                由於版權與安全限制，某些外部樂譜無法直接在 App 內顯示。
              </p>
            </div>
            <a 
              href={score.data as string} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              在新分頁開啟樂譜 <ExternalLink size={18} />
            </a>
          </div>
        ) : useNativeViewer ? (
          <div className="absolute inset-0 bg-white">
            <iframe 
              src={pages[0]} 
              className="w-full h-full border-none"
              title="Native PDF Viewer"
            />
          </div>
        ) : (
          <div className="absolute inset-0 overflow-auto flex justify-center items-center p-4 scrollbar-hide">
            <div 
              className={cn(
                "transition-all duration-200 shadow-2xl bg-white flex items-center justify-center relative",
                displayMode === 'fit-width' && "w-full h-auto",
                displayMode === 'fit-page' && "max-w-full max-h-full"
              )}
              style={{ 
                width: displayMode === 'fit-width' ? `${zoom * 100}%` : 'auto',
                maxWidth: '100%',
                maxHeight: displayMode === 'fit-page' ? '100%' : 'none',
                aspectRatio: '1 / 1.414',
              }}
            >
              <img 
                src={isPDF ? (renderedImageUrl || '') : pages[currentPage]} 
                alt={`${score.name} - Page ${isPDF ? pdfPage : currentPage + 1}`}
                className={cn(
                  "object-contain bg-white",
                  displayMode === 'fit-page' ? "max-w-full max-h-full" : "w-full h-auto"
                )}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Page Controls (Floating) */}
      {!useNativeViewer && (totalImagePages > 1 || (isPDF && numPages > 1)) && (
        <div className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-surface-warm/80 backdrop-blur-md border border-white/5 p-1.5 sm:p-2 rounded-2xl shadow-2xl z-[60]">
          <button 
            onClick={prevPage}
            disabled={isPDF ? pdfPage === 1 : currentPage === 0}
            className="p-2 sm:p-3 text-text-warm hover:bg-white/5 rounded-xl transition-all disabled:opacity-30"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center px-2 sm:px-4">
            <span className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5">
              {isPDF ? 'PDF 頁碼' : '圖片頁碼'}
            </span>
            <span className="text-xs sm:text-sm font-bold text-text-warm">
              {isPDF ? `第 ${pdfPage} / ${numPages} 頁` : `第 ${currentPage + 1} / ${totalImagePages} 頁`}
            </span>
          </div>
          <button 
            onClick={nextPage}
            disabled={isPDF ? pdfPage === numPages : currentPage === totalImagePages - 1}
            className="p-2 sm:p-3 text-text-warm hover:bg-white/5 rounded-xl transition-all disabled:opacity-30"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
};
