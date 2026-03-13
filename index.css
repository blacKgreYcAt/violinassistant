import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X, ZoomIn, ZoomOut, ExternalLink, Camera } from 'lucide-react';
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
  const [displayMode, setDisplayMode] = useState<'fit-width' | 'fit-height'>('fit-height');

  const pages = Array.isArray(score.data) ? score.data : [score.data];
  const totalPages = pages.length;

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

  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 0));

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
          <h2 className="text-text-warm font-bold tracking-tight truncate max-w-[120px] sm:max-w-md text-sm sm:text-base">
            {score.name}
          </h2>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* iPad Optimization Toggle */}
          <button 
            onClick={() => setDisplayMode(displayMode === 'fit-height' ? 'fit-width' : 'fit-height')}
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-text-muted hover:text-text-warm"
            title={displayMode === 'fit-height' ? '切換至符合寬度' : '切換至符合高度'}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {displayMode === 'fit-height' ? '符合高度' : '符合寬度'}
            </span>
          </button>

          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2 hidden sm:block" />

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
      <div className="flex-1 overflow-auto bg-bg-warm p-2 sm:p-4 md:p-8 flex justify-center items-start scrollbar-hide">
        <div 
          className={cn(
            "transition-all duration-200 origin-top shadow-2xl bg-white flex items-center justify-center",
            displayMode === 'fit-height' ? "h-full w-auto" : "w-full h-auto"
          )}
          style={{ 
            transform: `scale(${zoom})`,
            maxWidth: displayMode === 'fit-width' ? '1200px' : 'none',
            aspectRatio: '1 / 1.414', // A4 Aspect Ratio
          }}
        >
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
            <iframe 
              src={pages[currentPage]} 
              className="w-full h-full border-none bg-white"
              title={score.name}
            />
          ) : (
            <img 
              src={pages[currentPage]} 
              alt={`${score.name} - Page ${currentPage + 1}`}
              className={cn(
                "object-contain bg-white",
                displayMode === 'fit-height' ? "h-full w-auto" : "w-full h-auto"
              )}
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      </div>

      {/* Page Controls (Floating) */}
      {totalPages > 1 && (
        <div className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-surface-warm/80 backdrop-blur-md border border-white/5 p-1.5 sm:p-2 rounded-2xl shadow-2xl z-[60]">
          <button 
            onClick={prevPage}
            disabled={currentPage === 0}
            className="p-2 sm:p-3 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="text-[10px] sm:text-sm font-bold text-text-warm px-2 sm:px-4">
            第 {currentPage + 1} / {totalPages} 頁
          </span>
          <button 
            onClick={nextPage}
            disabled={currentPage === totalPages - 1}
            className="p-2 sm:p-3 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
};
