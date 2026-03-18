import React, { useState, useEffect } from 'react';
import { Metronome } from './components/Metronome';
import { Tuner } from './components/Tuner';
import { Timer } from './components/Timer';
import { VideoRecorder } from './components/VideoRecorder';
import { ScoreLibrary } from './components/ScoreLibrary';
import { ScoreViewer } from './components/ScoreViewer';
import { UserGuide } from './components/UserGuide';
import { RewardCard } from './components/RewardCard';
import { PracticeHistory } from './components/PracticeHistory';
import { PracticeRoutine, Score } from './lib/storage';
import { Music, LayoutDashboard, Library, Edit2, Check, HelpCircle, Mail, Star } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [activeScore, setActiveScore] = useState<Score | null>(null);
  const [activeRoutine, setActiveRoutine] = useState<PracticeRoutine | null>(null);
  const [activeTab, setActiveTab] = useState<'tools' | 'library'>('tools');
  const [appTitle, setAppTitle] = useState<string>('我的練習小幫手');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [rewardCardOpen, setRewardCardOpen] = useState(false);

  // Shared Metronome State
  const [bpm, setBpm] = useState(100);
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);

  useEffect(() => {
    const savedTitle = localStorage.getItem('app_title');
    if (savedTitle) {
      setAppTitle(savedTitle);
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
    <div className="h-screen bg-bg-warm text-text-warm font-sans selection:bg-accent-warm selection:text-bg-warm flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="h-16 shrink-0 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-surface-warm/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-warm rounded-xl flex items-center justify-center text-bg-warm shrink-0 shadow-lg shadow-accent-warm/20">
            <Music size={20} />
          </div>
          <div className="group relative">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-base font-bold w-48 sm:w-64 focus:outline-none focus:border-accent-warm transition-all"
                  autoFocus
                  onBlur={saveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                />
                <button onClick={saveTitle} className="text-accent-warm p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <Check size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 
                  onClick={startEditing}
                  className="font-bold text-xl tracking-tight text-text-warm truncate max-w-[180px] sm:max-w-xs cursor-pointer hover:text-accent-warm transition-colors"
                >
                  {appTitle}
                </h1>
                <button 
                  onClick={startEditing}
                  className="p-2 text-text-muted hover:text-accent-warm transition-all rounded-lg hover:bg-white/5"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setRewardCardOpen(true)} 
            className="p-2 text-yellow-500 hover:text-yellow-400 transition-colors rounded-lg hover:bg-yellow-500/10 flex items-center gap-2"
          >
            <Star size={20} className="fill-yellow-500" />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">集點卡</span>
          </button>
          <button 
            onClick={() => setGuideOpen(true)} 
            className="p-2 text-text-muted hover:text-text-warm transition-colors rounded-lg hover:bg-white/5 flex items-center gap-2"
          >
            <HelpCircle size={20} />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">使用說明</span>
          </button>
        </div>
      </header>

      {/* Main Content - Tabbed Layout */}
      <main className="flex-1 min-h-0 p-3 md:p-4 overflow-hidden bg-bg-warm flex flex-col">
        <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col gap-4">
          
          {/* Tabs */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 shrink-0 bg-surface-warm/80 p-2 rounded-2xl border border-white/5 w-fit mx-auto shadow-xl">
            <button
              onClick={() => setActiveTab('tools')}
              className={cn(
                "px-8 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center gap-2",
                activeTab === 'tools' 
                  ? "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20" 
                  : "text-text-muted hover:text-text-warm hover:bg-white/5"
              )}
            >
              <LayoutDashboard size={20} />
              練習工具
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={cn(
                "px-8 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center gap-2",
                activeTab === 'library' 
                  ? "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20" 
                  : "text-text-muted hover:text-text-warm hover:bg-white/5"
              )}
            >
              <Library size={20} />
              樂譜與紀錄
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <div 
              className="h-full grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 overflow-y-auto md:overflow-hidden p-1"
              style={{ display: activeTab === 'tools' ? '' : 'none' }}
            >
              <Metronome 
                bpm={bpm} 
                setBpm={setBpm} 
                isPlaying={isMetronomePlaying} 
                setIsPlaying={setIsMetronomePlaying}
                className="min-h-[540px] md:h-full" 
              />
              <Tuner className="min-h-[540px] md:h-full" />
              <Timer activeRoutine={activeRoutine} onClearRoutine={() => setActiveRoutine(null)} className="min-h-[540px] md:h-full" />
            </div>
            
            <div 
              className="h-full flex flex-col gap-4 overflow-y-auto md:overflow-hidden custom-scrollbar p-1"
              style={{ display: activeTab === 'library' ? '' : 'none' }}
            >
              {!activeScore && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 min-h-[500px]">
                    <ScoreLibrary onSelectScore={setActiveScore} className="h-full" />
                    <VideoRecorder activeScoreName={activeScore?.name} className="h-full" />
                  </div>
                  <div className="shrink-0 min-h-[400px]">
                    <PracticeHistory className="h-full" />
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-white/5 py-3 px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted bg-surface-warm/30 z-10">
        <div>
          &copy; 2026 BERK STUDIO 練琴小幫手 - Concept by Rex CHU
        </div>
        <div className="flex items-center gap-4">
          <a 
            href="mailto:glitch.remover_1i@icloud.com" 
            className="hover:text-text-warm transition-colors flex items-center gap-1.5"
          >
            <Mail size={14} />
            <span className="font-bold">聯繫我們</span>
          </a>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold uppercase tracking-widest">v2.2.0</span>
          </div>
        </div>
      </footer>

      {/* Score Viewer Modal */}
      {activeScore && (
        <ScoreViewer 
          score={activeScore} 
          onClose={() => setActiveScore(null)} 
          bpm={bpm}
          setBpm={setBpm}
          isMetronomePlaying={isMetronomePlaying}
          setIsMetronomePlaying={setIsMetronomePlaying}
        />
      )}

      {/* User Guide Modal */}
      <UserGuide 
        isOpen={guideOpen} 
        onClose={() => setGuideOpen(false)} 
      />

      {/* Reward Card Modal */}
      <RewardCard 
        isOpen={rewardCardOpen} 
        onClose={() => setRewardCardOpen(false)} 
      />
    </div>
  );
}
