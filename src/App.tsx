import React, { useState, useEffect } from 'react';
import { Metronome } from './components/Metronome';
import { Timer } from './components/Timer';
import { VideoRecorder } from './components/VideoRecorder';
import { ScoreLibrary } from './components/ScoreLibrary';
import { ScoreViewer } from './components/ScoreViewer';
import { Music, Info, LayoutDashboard, Library, Edit2, Check } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'library' | 'dashboard'>('library');
  const [appTitle, setAppTitle] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

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
    <div className="min-h-screen bg-bg-warm text-text-warm font-sans selection:bg-accent-warm selection:text-bg-warm flex flex-col md:flex-row">
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

      {/* Sidebar - Hidden on mobile/portrait, shown on desktop landscape */}
      <aside className={cn(
        "hidden md:flex flex-col bg-surface-warm border-r border-white/5 transition-all duration-300 z-40 shrink-0",
        sidebarOpen ? "w-72" : "w-20"
      )}>
        <div className="flex flex-col h-full sticky top-0">
          <div className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 bg-accent-warm rounded-xl flex items-center justify-center text-bg-warm shrink-0">
              <Music size={24} />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0 group relative">
                {isEditingTitle && appTitle ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={tempTitle}
                      onChange={(e) => setTempTitle(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm font-bold w-full focus:outline-none focus:border-accent-warm"
                      autoFocus
                      onBlur={saveTitle}
                      onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                    />
                    <button onClick={saveTitle} className="text-accent-warm"><Check size={16} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="font-bold text-lg tracking-tight leading-tight text-text-warm break-words">
                      {appTitle.split('\n').map((line, i) => (
                        <React.Fragment key={i}>{line}<br/></React.Fragment>
                      ))}
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
            )}
          </div>

          <nav className="flex-1 px-4 py-4 flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('library')}
              className={cn(
                "flex items-center gap-4 p-4 rounded-2xl transition-all group",
                activeTab === 'library' ? "bg-accent-warm text-bg-warm" : "hover:bg-white/5 text-text-muted hover:text-text-warm"
              )}
            >
              <Library size={24} />
              {sidebarOpen && <span className="font-bold">樂譜圖書館</span>}
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "flex items-center gap-4 p-4 rounded-2xl transition-all group",
                activeTab === 'dashboard' ? "bg-accent-warm text-bg-warm" : "hover:bg-white/5 text-text-muted hover:text-text-warm"
              )}
            >
              <LayoutDashboard size={24} />
              {sidebarOpen && <span className="font-bold">練習工具箱</span>}
            </button>
          </nav>

          <div className="p-4 border-t border-white/5 flex flex-col gap-2">
            <div className="px-4 py-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">v1.7.3 (修復閱覽模式錄影畫面衝突問題)</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Bottom Navigation for Mobile/Portrait */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-warm border-t border-white/5 px-6 py-3 flex justify-around items-center z-50 pb-safe">
        <button 
          onClick={() => setActiveTab('library')}
          className={cn(
            "flex flex-col items-center gap-1 p-2 transition-all",
            activeTab === 'library' ? "text-accent-warm" : "text-text-muted"
          )}
        >
          <Library size={24} />
          <span className="text-[10px] font-bold">圖書館</span>
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "flex flex-col items-center gap-1 p-2 transition-all",
            activeTab === 'dashboard' ? "text-accent-warm" : "text-text-muted"
          )}
        >
          <LayoutDashboard size={24} />
          <span className="text-[10px] font-bold">工具箱</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 min-h-screen pb-24 md:pb-0 bg-bg-warm">
        <div className="max-w-5xl mx-auto p-6 md:p-12">
          {activeTab === 'library' ? (
            <div className="flex flex-col gap-8">
              <div className="w-full">
                <ScoreLibrary onSelectScore={setActiveScore} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Metronome />
                <Timer />
              </div>
              {!activeScore && <VideoRecorder activeScoreName={activeScore?.name} className="w-full" />}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-text-warm">練習控制台</h2>
                  <p className="text-text-muted text-sm mt-1">幫助您掌握曲目的專業工具。</p>
                </div>
                <div className="w-12 h-12 bg-accent-warm rounded-xl flex items-center justify-center text-bg-warm md:hidden">
                  <Music size={24} />
                </div>
              </header>
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Metronome className="w-full" />
                  <Timer className="w-full" />
                </div>
                {!activeScore && <VideoRecorder activeScoreName={activeScore?.name} className="w-full" />}
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-white/5 text-center pb-8">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-2">
              © 2026 BERK STUDIO 提琴小幫手 - Concept by Rex CHU
            </p>
            <a 
              href="mailto:glitch.remover_1i@icloud.com"
              className="text-[10px] font-bold text-accent-warm hover:text-accent-warm/80 transition-colors uppercase tracking-widest"
            >
              聯絡信箱
            </a>
          </footer>
        </div>
      </main>

      {/* Score Viewer Modal */}
      {activeScore && (
        <ScoreViewer 
          score={activeScore} 
          onClose={() => setActiveScore(null)} 
        />
      )}
    </div>
  );
}
