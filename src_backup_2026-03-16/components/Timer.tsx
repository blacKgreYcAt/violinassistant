import React, { useState, useEffect, useRef } from 'react';
import { Timer as TimerIcon, Play, Pause, RotateCcw, Bell, Edit3, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { addPracticeSession } from '../lib/storage';

interface TimerProps {
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({ className }) => {
  const [inputMinutes, setInputMinutes] = useState(30);
  const [remainingSeconds, setRemainingSeconds] = useState(30 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [practicedSeconds, setPracticedSeconds] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [practiceNote, setPracticeNote] = useState('');
  
  const timerRef = useRef<number | null>(null);

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
    if (isFinished && practicedSeconds > 0) {
      if (practicedSeconds >= 60) {
        setShowNoteModal(true);
      } else {
        logPracticeSession();
      }
    }
  }, [isFinished]);

  const logPracticeSession = async (note?: string) => {
    if (practicedSeconds >= 60) { // 至少練習 1 分鐘才記錄
      await addPracticeSession(practicedSeconds, note);
    }
    setPracticedSeconds(0);
    setPracticeNote('');
    setShowNoteModal(false);
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
    setIsFinished(false);
    setRemainingSeconds(inputMinutes * 60);
  };

  const handlePresetClick = (mins: number) => {
    if (isActive) return;
    setInputMinutes(mins);
    setRemainingSeconds(mins * 60);
    setIsFinished(false);
  };

  const totalInitialSeconds = inputMinutes * 60;
  const progress = totalInitialSeconds > 0 
    ? ((totalInitialSeconds - remainingSeconds) / totalInitialSeconds) * 100 
    : 0;

  return (
    <div className={cn("bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5", className)}>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <TimerIcon size={20} className="text-accent-warm" />
            <h2 className="text-lg font-bold tracking-tight text-text-warm">練習計時</h2>
          </div>
        </div>

        <div className="relative flex flex-col items-center justify-center h-32">
          <div className={cn(
            "text-6xl font-bold font-mono tracking-tighter transition-colors duration-300",
            remainingSeconds === 0 ? "text-emerald-400" : "text-text-warm"
          )}>
            {formatTime(remainingSeconds)}
          </div>
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-1">REMAINING</div>
          
          {isFinished && (
            <div className="absolute top-0 right-0 flex items-center gap-1 text-emerald-400 animate-bounce">
              <Bell size={14} fill="currentColor" />
              <span className="text-[10px] font-bold">練習完成！</span>
            </div>
          )}
        </div>

        <div className="flex items-center h-12">
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

        <div className="grid grid-cols-4 gap-2 h-12">
          {[15, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              onClick={() => handlePresetClick(mins)}
              disabled={isActive}
              className={cn(
                "h-full rounded-xl text-xs font-bold transition-all border",
                inputMinutes === mins && !isActive
                  ? "bg-accent-warm text-bg-warm border-accent-warm"
                  : "bg-white/5 text-text-muted border-white/5 hover:bg-white/10"
              )}
            >
              {mins}m
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => {
              if (remainingSeconds > 0) {
                setIsActive(!isActive);
              }
            }}
            disabled={remainingSeconds === 0}
            className={cn(
              "flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:scale-100",
              isActive 
                ? "bg-white/10 text-text-warm" 
                : "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20"
            )}
          >
            {isActive ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            {isActive ? '暫停' : '開始'}
          </button>
          
          <button 
            onClick={resetTimer}
            className="w-14 h-14 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-muted rounded-2xl transition-all active:scale-95"
          >
            <RotateCcw size={24} />
          </button>
        </div>
      </div>

      {/* Practice Note Modal */}
      {showNoteModal && (
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
