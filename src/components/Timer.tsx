import React, { useState, useEffect, useRef } from 'react';
import { Timer as TimerIcon, Play, Pause, RotateCcw, Bell } from 'lucide-react';
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
      logPracticeSession();
    }
  }, [isFinished]);

  const logPracticeSession = async () => {
    if (practicedSeconds >= 60) { // 至少練習 1 分鐘才記錄
      await addPracticeSession(practicedSeconds);
    }
    setPracticedSeconds(0);
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTimer = () => {
    if (practicedSeconds > 0) {
      logPracticeSession();
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
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 h-8">
          <TimerIcon size={20} className="text-text-muted" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">練習倒數計時</h3>
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
    </div>
  );
};
