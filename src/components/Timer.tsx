import React, { useState, useEffect, useRef } from 'react';
import { Timer as TimerIcon, Play, Pause, RotateCcw, Bell, Edit3, Check, X, ListMusic, SkipForward } from 'lucide-react';
import { cn } from '../lib/utils';
import { addPracticeSession, PracticeRoutine, processPracticeReward, RewardResult } from '../lib/storage';

interface TimerProps {
  activeRoutine?: PracticeRoutine | null;
  onClearRoutine?: () => void;
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({ activeRoutine, onClearRoutine, className }) => {
  const [inputMinutes, setInputMinutes] = useState(30);
  const [remainingSeconds, setRemainingSeconds] = useState(30 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [practicedSeconds, setPracticedSeconds] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [practiceNote, setPracticeNote] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [rewardResult, setRewardResult] = useState<RewardResult | null>(null);
  
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeRoutine && activeRoutine.steps.length > 0) {
      setCurrentStepIndex(0);
      const firstStepDuration = activeRoutine.steps[0].duration || (activeRoutine.steps[0] as any).durationSeconds || 30;
      setInputMinutes(firstStepDuration);
      setRemainingSeconds(firstStepDuration * 60);
      setIsActive(false);
      setIsFinished(false);
    }
  }, [activeRoutine]);

  useEffect(() => {
    if (isActive && remainingSeconds > 0) {
      timerRef.current = window.setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            setIsActive(false);
            setIsFinished(true);
            return 0;
          }
          return prev - 1;
        });
        setPracticedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, remainingSeconds]);

  useEffect(() => {
    if (isFinished) {
      if (activeRoutine) {
        // Play a sound to notify step completion
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          oscillator.start();
          gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
          oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
          console.error("Audio playback failed", e);
        }

        if (currentStepIndex < activeRoutine.steps.length - 1) {
          // Move to next step automatically after a short delay or require manual start
          // Let's require manual start for the next step, but load it up
          const nextIndex = currentStepIndex + 1;
          setCurrentStepIndex(nextIndex);
          const nextDuration = activeRoutine.steps[nextIndex].duration || (activeRoutine.steps[nextIndex] as any).durationSeconds || 30;
          setInputMinutes(nextDuration);
          setRemainingSeconds(nextDuration * 60);
          setIsFinished(false);
        } else {
          // Routine finished
          if (practicedSeconds >= 60) {
            setShowNoteModal(true);
          } else {
            logPracticeSession();
          }
        }
      } else {
        if (practicedSeconds > 0) {
          if (practicedSeconds >= 60) {
            setShowNoteModal(true);
          } else {
            logPracticeSession();
          }
        }
      }
    }
  }, [isFinished]);

  const completeReset = () => {
    setIsFinished(false);
    if (activeRoutine && activeRoutine.steps[currentStepIndex]) {
      setRemainingSeconds(activeRoutine.steps[currentStepIndex].duration * 60);
    } else {
      setRemainingSeconds(inputMinutes * 60);
    }
  };

  const logPracticeSession = async (note?: string) => {
    if (practicedSeconds >= 60) { // 至少練習 1 分鐘才記錄
      await addPracticeSession(practicedSeconds, note);
      
      // Process rewards only if session is valid
      const reward = await processPracticeReward(practicedSeconds);
      if (reward.earnedNotes > 0) {
        setRewardResult(reward);
        setShowNoteModal(false);
        return; // Do not reset practicedSeconds yet, so the modal can display it
      } else {
        completeReset();
      }
    } else {
      completeReset();
    }

    setPracticedSeconds(0);
    setPracticeNote('');
    setShowNoteModal(false);
  };

  const handleCloseReward = () => {
    setRewardResult(null);
    setPracticedSeconds(0);
    setPracticeNote('');
    completeReset();
  };

  const handleSaveNote = () => {
    logPracticeSession(practiceNote.trim() || undefined);
  };

  const handleSkipNote = () => {
    logPracticeSession();
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTimer = () => {
    if (practicedSeconds >= 60) {
      setShowNoteModal(true);
      setIsActive(false);
      return;
    }
    setIsActive(false);
    setPracticedSeconds(0);
    completeReset();
  };

  const handlePresetClick = (mins: number) => {
    if (isActive || activeRoutine) return;
    setInputMinutes(mins);
    setRemainingSeconds(mins * 60);
    setIsFinished(false);
  };

  const handleSkipStep = () => {
    if (!activeRoutine) return;
    setIsActive(false);
    if (currentStepIndex < activeRoutine.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      const nextDuration = activeRoutine.steps[nextIndex].duration;
      setInputMinutes(nextDuration);
      setRemainingSeconds(nextDuration * 60);
      setIsFinished(false);
    } else {
      setIsFinished(true);
    }
  };

  const totalInitialSeconds = activeRoutine && activeRoutine.steps[currentStepIndex] 
    ? activeRoutine.steps[currentStepIndex].duration * 60 
    : inputMinutes * 60;
  const progress = totalInitialSeconds > 0 
    ? ((totalInitialSeconds - remainingSeconds) / totalInitialSeconds) * 100 
    : 0;

  return (
    <div className={cn("bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5", className)}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between shrink-0 h-10 mb-6">
          <div className="flex items-center gap-2">
            <TimerIcon size={20} className="text-accent-warm" />
            <h2 className="text-lg font-bold tracking-tight text-text-warm">
              {activeRoutine ? '計畫執行中' : '練習計時'}
            </h2>
          </div>
          {activeRoutine && onClearRoutine && (
            <button 
              onClick={onClearRoutine}
              className="text-xs font-bold text-text-muted hover:text-red-400 transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg"
            >
              結束計畫
            </button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center h-40 shrink-0 mb-6 relative">
          <div className={cn(
            "text-7xl font-bold font-mono tracking-tighter transition-colors duration-300 leading-none",
            remainingSeconds === 0 ? "text-emerald-400" : "text-text-warm"
          )}>
            {formatTime(remainingSeconds)}
          </div>
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-2">REMAINING</div>
          
          {isFinished && (
            <div className="absolute top-0 right-0 flex items-center gap-1 text-emerald-400 animate-bounce">
              <Bell size={14} fill="currentColor" />
              <span className="text-[10px] font-bold">練習完成！</span>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-6 justify-center">
          {activeRoutine ? (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent-warm flex items-center gap-1">
                  <ListMusic size={14} />
                  {activeRoutine.name}
                </span>
                <span className="text-xs font-bold text-text-muted">
                  步驟 {currentStepIndex + 1} / {activeRoutine.steps.length}
                </span>
              </div>
              <div className="text-lg font-bold text-text-warm truncate">
                {activeRoutine.steps[currentStepIndex]?.name}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => handlePresetClick(mins)}
                    disabled={isActive || !!activeRoutine}
                    className={cn(
                      "py-2 rounded-xl text-xs font-bold transition-all border",
                      inputMinutes === mins && !isActive && !activeRoutine
                        ? "bg-accent-warm text-bg-warm border-accent-warm shadow-lg shadow-accent-warm/20"
                        : "bg-white/5 text-text-muted border-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/5">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider pl-2 shrink-0">自訂分鐘</span>
                <input 
                  type="number"
                  min="1"
                  max="999"
                  value={inputMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setInputMinutes(val);
                    setRemainingSeconds(val * 60);
                  }}
                  disabled={isActive}
                  className="flex-1 bg-transparent border-none text-right pr-2 font-bold text-lg text-text-warm focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-1000",
                remainingSeconds === 0 ? "bg-emerald-400" : "bg-accent-warm"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-auto pt-6 flex gap-3">
          <button 
            onClick={() => {
              if (remainingSeconds > 0) {
                setIsActive(!isActive);
              }
            }}
            disabled={remainingSeconds === 0}
            className={cn(
              "flex-1 h-16 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:scale-100",
              isActive 
                ? "bg-white/10 text-text-warm" 
                : "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20 hover:bg-accent-warm/90"
            )}
          >
            {isActive ? (
              <><Pause size={24} fill="currentColor" /> 暫停</>
            ) : (
              <><Play size={24} fill="currentColor" /> 開始</>
            )}
          </button>
          
          {activeRoutine && currentStepIndex < activeRoutine.steps.length - 1 ? (
            <button 
              onClick={handleSkipStep}
              className="w-16 h-16 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-muted rounded-2xl transition-all active:scale-95 border border-white/5"
              title="跳過此步驟"
            >
              <SkipForward size={24} />
            </button>
          ) : (
            <button 
              onClick={resetTimer}
              className="w-16 h-16 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-muted rounded-2xl transition-all active:scale-95 border border-white/5"
              title="重設計時器"
            >
              <RotateCcw size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Reward Notification Modal */}
      {rewardResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-warm w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col items-center p-8 text-center animate-in zoom-in duration-300">
            <div className="text-6xl mb-4">🎵</div>
            <h2 className="text-2xl font-bold text-text-warm mb-2">太棒了！</h2>
            <p className="text-text-muted mb-6">
              你完成了 {Math.floor(practicedSeconds / 60)} 分鐘的練習，獲得了 <strong className="text-accent-warm">{rewardResult.earnedNotes}</strong> 個音符！
            </p>
            
            {rewardResult.earnedPieces.length > 0 && (
              <div className="bg-accent-warm/10 p-4 rounded-2xl mb-6 w-full">
                <div className="text-4xl mb-2">✨</div>
                <h3 className="font-bold text-accent-warm mb-1">獲得拼圖碎片！</h3>
                <p className="text-sm text-text-warm">
                  你集滿了 10 個音符，獲得了 {rewardResult.earnedPieces.length} 個新的樂器拼圖碎片！
                </p>
              </div>
            )}

            {rewardResult.unlockedConcertmaster && (
              <div className="bg-gradient-to-br from-yellow-100 to-amber-100 border border-yellow-400 p-4 rounded-2xl mb-6 w-full shadow-lg shadow-yellow-400/20">
                <div className="text-5xl mb-2">🏆</div>
                <h3 className="font-black text-yellow-700 mb-1 tracking-widest">解鎖終極徽章</h3>
                <p className="text-sm text-yellow-600 font-medium">
                  恭喜你收集了所有拼圖，成為了「首席提琴手」！
                </p>
              </div>
            )}

            <button
              onClick={handleCloseReward}
              className="w-full bg-accent-warm text-bg-warm py-3 rounded-xl font-bold hover:bg-accent-warm/90 transition-colors"
            >
              繼續加油
            </button>
          </div>
        </div>
      )}

      {/* Practice Note Modal */}
      {showNoteModal && !rewardResult && (
        <div className="fixed inset-0 z-50 bg-bg-warm/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-warm border border-white/10 p-6 rounded-3xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-accent-warm">
                <Edit3 size={20} />
                <h3 className="font-bold text-lg text-text-warm">練習筆記</h3>
              </div>
              <button onClick={handleSkipNote} className="text-text-muted hover:text-text-warm p-1">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-text-muted mb-4">
              您剛剛練習了 {Math.floor(practicedSeconds / 60)} 分鐘，要記錄一下心得或下次的目標嗎？
            </p>
            <textarea
              value={practiceNote}
              onChange={(e) => setPracticeNote(e.target.value)}
              placeholder="例如：第 45 小節的換弦還要加強..."
              className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-text-warm focus:outline-none focus:border-accent-warm resize-none mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSkipNote}
                className="flex-1 py-3 rounded-xl bg-white/5 text-text-muted font-bold hover:bg-white/10 transition-colors"
              >
                略過
              </button>
              <button
                onClick={handleSaveNote}
                className="flex-1 py-3 rounded-xl bg-accent-warm text-bg-warm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Check size={18} /> 儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
