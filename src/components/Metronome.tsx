import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Plus, Minus, Volume2, VolumeX, Activity, TrendingUp, Target, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { createAudioContext } from '../lib/audio';

// BPM 的合法範圍。排程器也會用這兩個值做防護，
// 確保就算外部傳進超出範圍的值也不會算出 0、負數或 Infinity 的拍長。
export const MIN_BPM = 30;
export const MAX_BPM = 300;

interface MetronomeProps {
  className?: string;
  bpm: number;
  setBpm: (bpm: number) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
}

export const Metronome: React.FC<MetronomeProps> = ({ 
  className,
  bpm,
  setBpm,
  isPlaying,
  setIsPlaying
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [currentBeat, setCurrentBeat] = useState(0);

  // Progressive Mode States
  const [isProgressiveMode, setIsProgressiveMode] = useState(false);
  const [targetBpm, setTargetBpm] = useState(120);
  const [bpmIncrement, setBpmIncrement] = useState(2);
  const [incrementInterval, setIncrementInterval] = useState(4); // Every 4 measures
  const [measuresCount, setMeasuresCount] = useState(0);

  const audioContext = useRef<AudioContext | null>(null);
  const nextNoteTime = useRef(0);
  const timerID = useRef<number | null>(null);
  const lookahead = 25.0; // How frequently to call scheduling function (in milliseconds)
  const scheduleAheadTime = 0.1; // How far ahead to schedule audio (in seconds)

  // 已排程但還沒真正發聲的拍子。音訊是提前最多 scheduleAheadTime 秒排進去的，
  // 所以畫面不能在「排程當下」就更新，否則燈號會比聲音早最多 100ms
  // （300 BPM 時等於差半拍）。改由 drawLoop 依照 audioContext.currentTime 來追。
  const notesInQueue = useRef<{ beat: number; time: number }[]>([]);
  const drawFrameID = useRef<number | null>(null);

  // 靜音狀態用 ref 保存：playClick 若把 isMuted 放進依賴陣列，
  // 切換靜音會重建 scheduler，但舊的 scheduler 是靠自己遞迴呼叫 setTimeout 活著的，
  // 新的永遠接不上 → 播放中按靜音不會有任何反應。
  const isMutedRef = useRef(isMuted);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Use refs for values needed in scheduler to avoid stale closures
  const bpmRef = useRef(bpm);
  const beatsPerMeasureRef = useRef(beatsPerMeasure);
  const currentBeatRef = useRef(currentBeat);
  const isProgressiveModeRef = useRef(isProgressiveMode);
  const targetBpmRef = useRef(targetBpm);
  const bpmIncrementRef = useRef(bpmIncrement);
  const incrementIntervalRef = useRef(incrementInterval);
  const measuresCountRef = useRef(measuresCount);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { beatsPerMeasureRef.current = beatsPerMeasure; }, [beatsPerMeasure]);
  useEffect(() => { currentBeatRef.current = currentBeat; }, [currentBeat]);
  useEffect(() => { isProgressiveModeRef.current = isProgressiveMode; }, [isProgressiveMode]);
  useEffect(() => { targetBpmRef.current = targetBpm; }, [targetBpm]);
  useEffect(() => { bpmIncrementRef.current = bpmIncrement; }, [bpmIncrement]);
  useEffect(() => { incrementIntervalRef.current = incrementInterval; }, [incrementInterval]);
  useEffect(() => { measuresCountRef.current = measuresCount; }, [measuresCount]);

  const playClick = useCallback((time: number, beat: number) => {
    if (!audioContext.current || isMutedRef.current) return;

    const osc = audioContext.current.createOscillator();
    const envelope = audioContext.current.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(beat === 0 ? 1200 : 1000, time);
    
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(1, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(envelope);
    envelope.connect(audioContext.current.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  const scheduler = useCallback(() => {
    if (!audioContext.current) return;

    while (nextNoteTime.current < audioContext.current.currentTime + scheduleAheadTime) {
      const beatToPlay = currentBeatRef.current;
      playClick(nextNoteTime.current, beatToPlay);
      // 記下這一拍「實際會發聲的時間」，交給 drawLoop 在那個時間點才更新畫面。
      // 需要設上限：分頁切到背景時 requestAnimationFrame 會完全停止（沒人消耗佇列），
      // 但 setTimeout 仍會以較低頻率繼續排程並推入，佇列會無限成長。
      // 超過上限就丟掉最舊的，回到前景時 drawLoop 本來就只會顯示最後一拍。
      notesInQueue.current.push({ beat: beatToPlay, time: nextNoteTime.current });
      if (notesInQueue.current.length > 256) notesInQueue.current.shift();

      // 必須保證 secondsPerBeat 永遠是正的有限值：
      // 若 bpm 變成 0 會得到 Infinity（節拍器無聲死掉），
      // 變成負數則 nextNoteTime 會不斷倒退，這個 while 迴圈永遠跑不完，直接凍結整個分頁。
      const safeBpm = Math.min(MAX_BPM, Math.max(MIN_BPM, bpmRef.current || MIN_BPM));
      const secondsPerBeat = 60.0 / safeBpm;
      nextNoteTime.current += secondsPerBeat;
      
      // 這裡只推進內部計數，不再直接 setCurrentBeat（畫面由 drawLoop 負責）
      const nextBeat = (currentBeatRef.current + 1) % beatsPerMeasureRef.current;
      currentBeatRef.current = nextBeat;

      if (nextBeat === 0) {
        // End of measure
        const nextMeasureCount = measuresCountRef.current + 1;
        measuresCountRef.current = nextMeasureCount;
        setMeasuresCount(nextMeasureCount);

        // Progressive logic
        if (isProgressiveModeRef.current && nextMeasureCount >= incrementIntervalRef.current) {
          if (bpmRef.current < targetBpmRef.current) {
            const newBpm = Math.min(bpmRef.current + bpmIncrementRef.current, targetBpmRef.current);
            bpmRef.current = newBpm;
            setBpm(newBpm);
          }
          // 不論有沒有真的加速都要歸零：到達目標速度後若不重設，
          // 計數會一直累加，進度條會顯示成「47/4 小節」這種超過 100% 的數字。
          measuresCountRef.current = 0;
          setMeasuresCount(0);
        }
      }
    }
    timerID.current = window.setTimeout(scheduler, lookahead);
  }, [playClick, setBpm]);

  useEffect(() => {
    if (isPlaying) {
      if (!audioContext.current) {
        audioContext.current = createAudioContext();
      }
      if (audioContext.current.state === 'suspended') {
        audioContext.current.resume();
      }
      // Only start scheduler if it's not already running
      if (!timerID.current) {
        currentBeatRef.current = 0;
        setCurrentBeat(0);
        measuresCountRef.current = 0;
        setMeasuresCount(0);
        notesInQueue.current = [];
        nextNoteTime.current = audioContext.current.currentTime + 0.05;
        scheduler();
      }
    } else {
      if (timerID.current) {
        clearTimeout(timerID.current);
        timerID.current = null;
      }
      notesInQueue.current = [];
    }
  }, [isPlaying, scheduler]);

  // 畫面更新迴圈：只有當某一拍的排定時間真的到了（以 audioContext 的時鐘為準），
  // 才把它顯示出來。這樣燈號才會跟耳朵聽到的聲音對齊。
  useEffect(() => {
    if (!isPlaying) return;

    const drawLoop = () => {
      const ctx = audioContext.current;
      if (ctx) {
        let beatToShow: number | null = null;
        // 把所有「已經該發聲」的拍子取出，只顯示最後一拍（避免分頁卡頓後補播一堆）
        while (notesInQueue.current.length && notesInQueue.current[0].time <= ctx.currentTime) {
          beatToShow = notesInQueue.current[0].beat;
          notesInQueue.current.shift();
        }
        if (beatToShow !== null) {
          setCurrentBeat(beatToShow);
        }
      }
      drawFrameID.current = requestAnimationFrame(drawLoop);
    };

    drawFrameID.current = requestAnimationFrame(drawLoop);
    return () => {
      if (drawFrameID.current) cancelAnimationFrame(drawFrameID.current);
      drawFrameID.current = null;
    };
  }, [isPlaying]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    return () => {
      if (timerID.current) clearTimeout(timerID.current);
      if (drawFrameID.current) cancelAnimationFrame(drawFrameID.current);
      if (audioContext.current && audioContext.current.state !== 'closed') {
        audioContext.current.close();
      }
    };
  }, []);

  const handleBpmChange = (newBpm: number) => {
    if (Number.isNaN(newBpm)) return;
    setBpm(Math.min(Math.max(newBpm, MIN_BPM), MAX_BPM));
  };

  return (
    <div className={cn(
      "bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5 transition-all duration-75",
      isPlaying && currentBeat === 0 ? "ring-2 ring-accent-warm/50 scale-[1.01]" : "",
      className
    )}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between shrink-0 h-10 mb-6">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-accent-warm" />
            <h2 className="text-lg font-bold tracking-tight text-text-warm">節拍設定</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsProgressiveMode(!isProgressiveMode)}
              className={cn(
                "px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 border",
                isProgressiveMode 
                  ? "bg-accent-warm text-bg-warm border-accent-warm shadow-lg shadow-accent-warm/20" 
                  : "hover:bg-white/5 text-text-muted border-white/5"
              )}
              title="速度漸進模式"
            >
              <TrendingUp size={20} />
              <span className="text-sm font-bold uppercase tracking-wider">漸進模式</span>
            </button>
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              {isMuted ? <VolumeX size={20} className="text-red-400" /> : <Volume2 size={20} className="text-text-muted" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-center h-40 shrink-0 mb-6">
          {isProgressiveMode ? (
            <div className="bg-white/5 p-5 rounded-2xl space-y-4 border border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-muted">
                  <Target size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">目標速度</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setTargetBpm(Math.max(bpm + 1, targetBpm - 5))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Minus size={16} /></button>
                  <span className="text-base font-mono font-bold w-10 text-center text-text-warm">{targetBpm}</span>
                  <button onClick={() => setTargetBpm(Math.min(300, targetBpm + 5))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Plus size={16} /></button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-muted">
                  <TrendingUp size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">每次增加</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setBpmIncrement(Math.max(1, bpmIncrement - 1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Minus size={16} /></button>
                  <span className="text-base font-mono font-bold w-10 text-center text-text-warm">+{bpmIncrement}</span>
                  <button onClick={() => setBpmIncrement(Math.min(20, bpmIncrement + 1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Plus size={16} /></button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-muted">
                  <RefreshCw size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">間隔小節</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setIncrementInterval(Math.max(1, incrementInterval - 1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Minus size={16} /></button>
                  <span className="text-base font-mono font-bold w-10 text-center text-text-warm">{incrementInterval}</span>
                  <button onClick={() => setIncrementInterval(Math.min(32, incrementInterval + 1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Plus size={16} /></button>
                </div>
              </div>
              {isPlaying && (
                <div className="pt-3 border-t border-white/5">
                  <div className="flex justify-between items-center text-xs text-text-muted font-bold uppercase tracking-wider mb-2">
                    <span>進度</span>
                    <span>{measuresCount}/{incrementInterval} 小節</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent-warm transition-all duration-300" 
                      style={{ width: `${(measuresCount / incrementInterval) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="text-7xl font-bold font-mono tracking-tighter text-text-warm leading-none">
                {bpm}
              </div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-2">BPM</div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-4 h-12 mb-4">
            <button 
              onClick={() => handleBpmChange(bpm - 1)}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-warm rounded-xl transition-all active:scale-95 shrink-0"
            >
              <Minus size={20} />
            </button>
            
            <div className="flex-1 flex items-center h-full">
              <input 
                type="range" 
                min="30" 
                max="300" 
                value={bpm} 
                onChange={(e) => handleBpmChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-warm"
              />
            </div>

            <button 
              onClick={() => handleBpmChange(bpm + 1)}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-warm rounded-xl transition-all active:scale-95 shrink-0"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 h-12">
            <div className="flex gap-2">
              {[...Array(beatsPerMeasure)].map((_, i) => (
                <div 
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full transition-all duration-100",
                    isPlaying && currentBeat === i ? "bg-accent-warm scale-125" : "bg-white/10"
                  )}
                />
              ))}
            </div>
            <select 
              value={beatsPerMeasure}
              onChange={(e) => setBeatsPerMeasure(parseInt(e.target.value))}
              className="text-base font-bold bg-white/5 text-text-warm px-4 py-2 rounded-xl outline-none border border-white/5 hover:border-white/10 transition-all cursor-pointer"
            >
              <option value="2">2/4</option>
              <option value="3">3/4</option>
              <option value="4">4/4</option>
              <option value="6">6/8</option>
            </select>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <button 
            onClick={togglePlay}
            className={cn(
              "w-full h-16 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg transition-all active:scale-[0.98]",
              isPlaying 
                ? "bg-white/10 text-text-warm" 
                : "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20 hover:bg-accent-warm/90"
            )}
          >
            {isPlaying ? (
              <>
                <Square size={24} fill="currentColor" /> 停止
              </>
            ) : (
              <>
                <Play size={24} fill="currentColor" /> 開始
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
