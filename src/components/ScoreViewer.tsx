import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X, ZoomIn, ZoomOut, ExternalLink, Camera, LayoutDashboard } from 'lucide-react';
import { VideoRecorder } from './VideoRecorder';
import { cn } from '../lib/utils';

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
  const [currentPage, setCurrentPage] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [displayMode, setDisplayMode] = useState<'fit-width' | 'fit-height' | 'fit-page'>('fit-page');

  const pages = Array.isArray(score.data) ? score.data : [score.data];
  const totalPages = pages.length;
  const isPDF = pages[currentPage].startsWith('data:application/pdf');

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.2), 5));
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
      setPdfPage(prev => prev + 1);
    } else {
      setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
    }
  };

  const prevPage = () => {
    if (isPDF) {
      setPdfPage(prev => Math.max(prev - 1, 1));
    } else {
      setCurrentPage(prev => Math.max(prev - 1, 0));
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
            <button 
              onClick={() => setDisplayMode('fit-height')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                displayMode === 'fit-height' ? "bg-accent-warm text-bg-warm" : "text-text-muted hover:text-text-warm"
              )}
            >
              符合高度
            </button>
          </div>

          {/* Mobile/Tablet Display Mode Toggle */}
          <button 
            onClick={() => {
              const modes: ('fit-page' | 'fit-width' | 'fit-height')[] = ['fit-page', 'fit-width', 'fit-height'];
              const nextIndex = (modes.indexOf(displayMode) + 1) % modes.length;
              const nextMode = modes[nextIndex];
              setDisplayMode(nextMode);
              if (nextMode === 'fit-page') setZoom(1);
            }}
            className="lg:hidden flex items-center gap-2 px-3 py-2 bg-white/5 text-text-muted hover:text-text-warm rounded-xl transition-all"
          >
            <LayoutDashboard size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {displayMode === 'fit-page' ? '符合頁面' : displayMode === 'fit-width' ? '符合寬度' : '符合高度'}
            </span>
          </button>

          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2 hidden sm:block" />
          
          {pages[currentPage].startsWith('data:application/pdf') && (
            <button 
              onClick={() => {
                const win = window.open();
                if (win) {
                  win.document.write(`<iframe src="${pages[currentPage]}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                }
              }}
              className="p-1 md:p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all flex items-center gap-2"
              title="在新分頁開啟 PDF"
            >
              <ExternalLink size={18} />
              <span className="text-[10px] font-bold hidden lg:block">新分頁開啟</span>
            </button>
          )}

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
      <div className="flex-1 overflow-hidden bg-bg-warm flex justify-center items-center relative">
        {score.type === 'link' ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center gap-4 sm:gap-6 bg-white">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400">
              <ExternalLink size={32} />
            </div>
            <div className="max-w-xs">
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-2">外部樂譜連結</h3>
              <p className="text-neutral-500 text-xs sm:text-sm">
                由於版權與安全限制，某些外部樂譜（如 IMSLP）無法直接在 App 內顯示。
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
            <p className="text-[9px] sm:text-[10px] text-neutral-400 uppercase tracking-widest">
              開啟後請尋找 "Download" 或 "PDF" 按鈕
            </p>
          </div>
        ) : pages[currentPage].startsWith('data:application/pdf') ? (
          <div className="w-full h-full flex flex-col bg-white">
            <iframe 
              src={`${pages[currentPage]}#page=${pdfPage}&view=FitH`}
              className="flex-1 w-full border-none"
              title={score.name}
            />
          </div>
        ) : (
          <div className="w-full h-full overflow-auto flex justify-center items-center p-4 scrollbar-hide">
            <div 
              className={cn(
                "transition-all duration-200 shadow-2xl bg-white flex items-center justify-center relative",
                displayMode === 'fit-width' && "w-full h-auto",
                displayMode === 'fit-height' && "h-full w-auto",
                displayMode === 'fit-page' && "max-w-full max-h-full"
              )}
              style={{ 
                width: displayMode === 'fit-width' ? `${zoom * 100}%` : 'auto',
                height: displayMode === 'fit-height' ? `${zoom * 100}%` : 'auto',
                maxWidth: '100%',
                maxHeight: displayMode === 'fit-page' ? '100%' : 'none',
                aspectRatio: '1 / 1.414',
              }}
            >
              <img 
                src={pages[currentPage]} 
                alt={`${score.name} - Page ${currentPage + 1}`}
                className={cn(
                  "object-contain bg-white",
                  displayMode === 'fit-page' ? "max-w-full max-h-full" : (displayMode === 'fit-height' ? "h-full w-auto" : "w-full h-auto")
                )}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Page Controls (Floating) */}
      {(totalPages > 1 || isPDF) && (
        <div className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-surface-warm/80 backdrop-blur-md border border-white/5 p-1.5 sm:p-2 rounded-2xl shadow-2xl z-[60]">
          <button 
            onClick={prevPage}
            disabled={!isPDF && currentPage === 0}
            className="p-2 sm:p-3 text-text-warm hover:bg-white/5 rounded-xl transition-all disabled:opacity-30"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center px-2 sm:px-4">
            <span className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5">
              {isPDF ? 'PDF 頁碼' : '圖片頁碼'}
            </span>
            <span className="text-xs sm:text-sm font-bold text-text-warm">
              {isPDF ? `第 ${pdfPage} 頁` : `第 ${currentPage + 1} / ${totalPages} 頁`}
            </span>
          </div>
          <button 
            onClick={nextPage}
            disabled={!isPDF && currentPage === totalPages - 1}
            className="p-2 sm:p-3 text-text-warm hover:bg-white/5 rounded-xl transition-all disabled:opacity-30"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
};
