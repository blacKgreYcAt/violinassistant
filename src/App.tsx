import React, { useState, useEffect } from 'react';
import { Metronome } from './components/Metronome';
import { Timer } from './components/Timer';
import { VideoRecorder } from './components/VideoRecorder';
import { ScoreLibrary } from './components/ScoreLibrary';
import { ScoreViewer } from './components/ScoreViewer';
import { UserGuide } from './components/UserGuide';
import { PracticeHistory } from './components/PracticeHistory';
import { Music, Info, LayoutDashboard, Library, Edit2, Check, HelpCircle } from 'lucide-react';
import { cn } from './lib/utils';

interface Score {
  id: string;
  name: string;
  type: 'file' | 'link';
  data: string | string[]; // Support single string or array of strings for multiple pages
  date: number;
}

export default function App() {
  const [activeScore, setActiveScore] = useState<Score | null>(null);
  const [appTitle, setAppTitle] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const savedTitle = localStorage.getItem('app_title');
    if (savedTitle) {
      setAppTitle(savedTitle);
    } else {
      setIsEditingTitle(true);
    }
  }, []);

  const saveTitle = () => {
    const finalTitle = tempTitle.trim() || '我的練習小幫手';
    setAppTitle(finalTitle);
    localStorage.setItem('app_title', finalTitle);
    setIsEditingTitle(false);
  };

  const startEditing = () => {
    setTempTitle(appTitle);
    setIsEditingTitle(true);
  };

  return (
    <div className="min-h-screen md:h-screen bg-bg-warm text-text-warm font-sans selection:bg-accent-warm selection:text-bg-warm flex flex-col md:overflow-hidden">
      {/* First Time Setup Overlay */}
      {isEditingTitle && !appTitle && (
        <div className="fixed inset-0 z-[100] bg-bg-warm/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-surface-warm p-8 rounded-[32px] border border-white/5 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-accent-warm rounded-2xl flex items-center justify-center text-bg-warm mb-6 mx-auto">
              <Music size={32} />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">歡迎使用練習小幫手</h2>
            <p className="text-text-muted text-center text-sm mb-8">請為您的專屬練習空間取個名字吧！</p>
            
            <div className="space-y-4">
              <input 
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                placeholder="例如：REX的中提練習小幫手"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-lg font-bold focus:outline-none focus:border-accent-warm transition-all"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
              />
              <button 
                onClick={saveTitle}
                className="w-full bg-accent-warm text-bg-warm py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all active:scale-95"
              >
                開始使用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="h-16 shrink-0 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-surface-warm/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent-warm rounded-lg flex items-center justify-center text-bg-warm shrink-0">
            <Music size={18} />
          </div>
          <div className="group relative">
            {isEditingTitle && appTitle ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm font-bold w-48 focus:outline-none focus:border-accent-warm"
                  autoFocus
                  onBlur={saveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                />
                <button onClick={saveTitle} className="text-accent-warm"><Check size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight text-text-warm truncate max-w-[200px] sm:max-w-xs">
                  {appTitle}
                </h1>
                <button 
                  onClick={startEditing}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-warm transition-all"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">v1.8.0</span>
          </div>
          <button 
            onClick={() => setGuideOpen(true)} 
            className="p-2 text-text-muted hover:text-text-warm transition-colors rounded-lg hover:bg-white/5 flex items-center gap-2"
          >
            <HelpCircle size={20} />
            <span className="hidden sm:inline text-xs font-bold">使用說明</span>
          </button>
        </div>
      </header>

      {/* Main Content - Bento Grid */}
      <main className="flex-1 min-h-0 p-4 md:p-6 lg:p-8 overflow-y-auto md:overflow-hidden bg-bg-warm">
        <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col md:grid md:grid-cols-2 md:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-3 lg:grid-rows-1 gap-6">
          
          {/* Column 1: Library */}
          <div className="md:col-span-2 lg:col-span-1 flex flex-col min-h-[500px] md:min-h-0 h-full">
            <ScoreLibrary onSelectScore={setActiveScore} className="flex-1 h-full" />
          </div>

          {/* Column 2: Metronome & Timer */}
          <div className="flex flex-col gap-6 min-h-0 h-full overflow-y-auto custom-scrollbar md:pr-2">
            <Metronome className="shrink-0" />
            <Timer className="shrink-0" />
          </div>

          {/* Column 3: Video & History */}
          <div className="flex flex-col gap-6 min-h-0 h-full overflow-y-auto custom-scrollbar md:pr-2 pb-8 md:pb-0">
            {!activeScore && (
              <>
                <VideoRecorder activeScoreName={activeScore?.name} className="shrink-0" />
                <PracticeHistory className="shrink-0" />
              </>
            )}
          </div>

        </div>
      </main>

      {/* Score Viewer Modal */}
      {activeScore && (
        <ScoreViewer 
          score={activeScore} 
          onClose={() => setActiveScore(null)} 
        />
      )}

      {/* User Guide Modal */}
      <UserGuide 
        isOpen={guideOpen} 
        onClose={() => setGuideOpen(false)} 
      />
    </div>
  );
}

