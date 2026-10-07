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
import { PracticeDashboard } from './components/PracticeDashboard';
import { PracticeRoutine, Score } from './lib/storage';
import { Video, LayoutDashboard, Library, Edit2, Check, HelpCircle, Mail, Star, Smartphone } from 'lucide-react';
import { ViolinIcon } from './components/ViolinIcon';
import { RecordingLibrary } from './components/RecordingLibrary';
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
  const [recordingLibraryOpen, setRecordingLibraryOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Shared Metronome State
  const [bpm, setBpm] = useState(100);
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);

  useEffect(() => {
    const savedTitle = localStorage.getItem('app_title');
    if (savedTitle) {
      setAppTitle(savedTitle);
    }
    
    // Start exit animation after 2.5 seconds
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 2500);
    
    // Remove from DOM after 3.5 seconds
    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 3500);
    
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
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

  // 開場動畫固定要等 3.5 秒，對每天都會開好幾次的練習工具來說太久。
  // 保留動畫，但讓使用者可以點一下直接跳過。
  const skipSplash = () => {
    setIsExiting(true);
    setShowSplash(false);
  };

  if (showSplash) {
    return (
      <div
        onClick={skipSplash}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') skipSplash(); }}
        className={cn(
          "fixed inset-0 z-[200] bg-bg-warm flex flex-col items-center justify-center transition-opacity duration-1000 cursor-pointer",
          isExiting ? "opacity-0" : "opacity-100"
        )}>
        <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700">
          <div className="relative w-32 h-32 flex items-center justify-center bg-surface-warm rounded-full shadow-2xl border border-white/5">
            <Smartphone 
              size={64} 
              className="text-accent-warm animate-tablet-rotate" 
              strokeWidth={1.5}
            />
          </div>
          <div className="text-center space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold text-text-warm tracking-tight">我的練習小幫手</h1>
            <p className="text-accent-warm text-sm md:text-base font-bold tracking-widest bg-accent-warm/10 px-4 py-2 rounded-full border border-accent-warm/20">
              請將平板直式放置，以便取得最佳效果
            </p>
            <p className="text-text-muted text-xs tracking-widest pt-2">點擊畫面任一處可直接進入</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-bg-warm text-text-warm font-sans selection:bg-accent-warm selection:text-bg-warm flex flex-col overflow-hidden animate-in fade-in duration-1000">
      {/* Top Header */}
      <header className="h-16 shrink-0 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-surface-warm/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          {/* 與 PWA 主畫面圖示使用同一組輪廓（見 ViolinIcon / generate-icons.py），
              讓 App 內的識別和安裝後看到的圖示一致 */}
          <div className="w-10 h-10 bg-accent-warm rounded-xl flex items-center justify-center text-bg-warm shrink-0 shadow-lg shadow-accent-warm/20">
            <ViolinIcon size={22} />
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
          {/* 放在全域標題列而不是某個分頁裡：錄影可以在樂譜檢視器內錄，
              也可以不開任何樂譜直接錄，不屬於特定分頁 */}
          <button
            onClick={() => setRecordingLibraryOpen(true)}
            aria-label="練習錄影"
            className="p-2 text-text-muted hover:text-text-warm transition-colors rounded-lg hover:bg-white/5 flex items-center gap-2"
          >
            <Video size={20} />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">練習錄影</span>
          </button>
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
              /* 不要用 md:overflow-hidden：子元件有 min-h-[540px]，視窗高度不足時
                 內容會被切掉而且完全捲不動。改成一律允許捲動，放得下時本來就不會出現捲軸。 */
              className="h-full grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 overflow-y-auto custom-scrollbar p-1"
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
              /* 同上。這一頁內容至少 924px（樂譜區 500 + 練習紀錄 400 + 間距），
                 在 1024×768 的 iPad 橫向下有 378px 完全看不到且無法捲動。 */
              className="h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar p-1"
              style={{ display: activeTab === 'library' ? '' : 'none' }}
            >
              {!activeScore && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 min-h-[500px]">
                    <ScoreLibrary onSelectScore={setActiveScore} />
                    {/* 這個區塊只在沒有選取樂譜時才會渲染，所以不會有可關聯的樂譜；
                        原本傳的 activeScoreName={activeScore?.name} 必定是 undefined。
                        要把錄影歸到某一份樂譜底下，請從樂譜檢視器裡的錄影模式錄製。 */}
                    <VideoRecorder className="h-full" />
                  </div>
                  {/* 「練習計畫 / 練習目標」放在「練習紀錄」旁邊 ——
                      這正是使用說明所描述的位置（「在『練習紀錄』旁的『練習計畫』分頁」）。
                      PracticeDashboard 這個容器元件先前完全沒有被掛載，
                      導致 activeRoutine 永遠是 null、Timer 裡整套計畫執行邏輯變成死碼。 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0 min-h-[400px]">
                    <PracticeHistory className="lg:col-span-2 h-full" />
                    <PracticeDashboard
                      onStartRoutine={(routine) => {
                        setActiveRoutine(routine);
                        // 計畫是由「練習工具」分頁的計時器執行，所以直接切過去，
                        // 否則使用者按了播放卻看不到任何反應。
                        setActiveTab('tools');
                      }}
                      className="h-full"
                    />
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
            <span className="font-bold uppercase tracking-widest">v2.5.0</span>
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

      <RecordingLibrary
        isOpen={recordingLibraryOpen}
        onClose={() => setRecordingLibraryOpen(false)}
      />

      {/* Reward Card Modal */}
      <RewardCard 
        isOpen={rewardCardOpen} 
        onClose={() => setRewardCardOpen(false)} 
      />
    </div>
  );
}
