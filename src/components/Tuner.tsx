import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings2, Volume2, VolumeX, Play, Square } from 'lucide-react';
import { cn } from '../lib/utils';
import { createAudioContext } from '../lib/audio';
import {
  detectPitch,
  noteNumberFromPitch,
  centsOffFromPitch,
  noteNameFromNoteNumber,
  NOTE_STRINGS
} from '../lib/pitch';

export const Tuner: React.FC<{ className?: string }> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'tuner' | 'drone'>('tuner');
  
  // Tuner States
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState<number>(0);
  const [note, setNote] = useState<string>('-');
  const [cents, setCents] = useState<number>(0);
  
  // Drone States
  const [isDronePlaying, setIsDronePlaying] = useState(false);
  const [droneNote, setDroneNote] = useState<string>('A');
  const [droneOctave, setDroneOctave] = useState<number>(4);
  const [droneVolume, setDroneVolume] = useState<number>(0.5);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  // 必須保留 getUserMedia 回傳的 stream：
  // 關閉 AudioContext 並不會停止麥克風，一定要自己把每個 track stop() 掉，
  // 否則瀏覽器的錄音指示燈會一直亮著、持續耗電。
  const micStreamRef = useRef<MediaStream | null>(null);
  // 重複使用同一個緩衝區，避免每一幀都配置新的 Float32Array
  // 型別要寫成 Float32Array<ArrayBuffer>：getFloatTimeDomainData 不接受
  // 可能指向 SharedArrayBuffer 的 Float32Array<ArrayBufferLike>
  const pitchBufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  // 音高偵測不需要跟著螢幕更新率跑，限制在約 25 次/秒就已經感覺即時
  const lastDetectTimeRef = useRef(0);

  const droneCtxRef = useRef<AudioContext | null>(null);
  const droneOscRef = useRef<OscillatorNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);
  // stopDrone 會延遲 100ms 才真正停掉振盪器（讓音量淡出），
  // 若在這段期間元件被卸載，必須取消這個 timer。
  const stopDroneTimerRef = useRef<number | null>(null);


  const updatePitch = () => {
    const analyser = analyserRef.current;
    const audioCtx = audioContextRef.current;
    if (!analyser || !audioCtx || audioCtx.state === 'closed') return;

    // 限制偵測頻率：自相關運算相對昂貴，不需要每一幀都做
    const now = performance.now();
    if (now - lastDetectTimeRef.current >= 40) {
      lastDetectTimeRef.current = now;

      if (!pitchBufferRef.current || pitchBufferRef.current.length !== analyser.fftSize) {
        pitchBufferRef.current = new Float32Array(analyser.fftSize);
      }
      const buffer = pitchBufferRef.current;
      analyser.getFloatTimeDomainData(buffer);

      const frequency = detectPitch(buffer, audioCtx.sampleRate);
      if (frequency !== -1) {
        const noteNum = noteNumberFromPitch(frequency);
        setPitch(frequency);
        setNote(noteNameFromNoteNumber(noteNum));
        setCents(centsOffFromPitch(frequency, noteNum));
      }
    }

    rafRef.current = requestAnimationFrame(updatePitch);
  };

  /** 關閉調音器並確實釋放麥克風 */
  const stopListening = async () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    // 關鍵：關閉 AudioContext 不會停止麥克風，必須自己停掉每個 track
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const toggleTuner = async () => {
    if (isListening) {
      await stopListening();
      setIsListening(false);
      setNote('-');
      setPitch(0);
      setCents(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const audioCtx = createAudioContext();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        sourceRef.current = source;
        
        setIsListening(true);
        updatePitch();
      } catch (err) {
        console.error("Error accessing microphone:", err);
        // 若已經取得麥克風但後續建立音訊節點失敗，這裡要把它放掉，
        // 否則使用者看到錯誤訊息，麥克風卻還開著。
        await stopListening();
        alert("無法存取麥克風，請檢查權限設定。");
      }
    }
  };

  // --- Drone Tone Logic ---
  const playDrone = () => {
    if (!droneCtxRef.current || droneCtxRef.current.state === 'closed') {
      droneCtxRef.current = createAudioContext();
    }
    
    const ctx = droneCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    if (droneOscRef.current) {
      try { droneOscRef.current.stop(); } catch { /* 振盪器已停止，重複呼叫 stop() 會丟例外，可安全忽略 */ }
      droneOscRef.current.disconnect();
    }
    if (droneGainRef.current) {
      droneGainRef.current.disconnect();
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Calculate frequency
    const noteIndex = NOTE_STRINGS.indexOf(droneNote);
    const freq = 440 * Math.pow(2, (noteIndex - 9 + (droneOctave - 4) * 12) / 12);
    
    osc.type = 'triangle'; // Richer tone for strings
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(droneVolume, ctx.currentTime + 0.1);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    
    droneOscRef.current = osc;
    droneGainRef.current = gainNode;
    
    setIsDronePlaying(true);
  };

  const stopDrone = () => {
    if (droneGainRef.current && droneCtxRef.current) {
      droneGainRef.current.gain.linearRampToValueAtTime(0, droneCtxRef.current.currentTime + 0.1);
      stopDroneTimerRef.current = window.setTimeout(() => {
        if (droneOscRef.current) {
          try { droneOscRef.current.stop(); } catch { /* 振盪器已停止，重複呼叫 stop() 會丟例外，可安全忽略 */ }
          droneOscRef.current.disconnect();
          droneOscRef.current = null;
        }
        if (droneGainRef.current) {
          droneGainRef.current.disconnect();
          droneGainRef.current = null;
        }
        setIsDronePlaying(false);
      }, 100);
    } else {
      setIsDronePlaying(false);
    }
  };

  const toggleDrone = () => {
    if (isDronePlaying) {
      stopDrone();
    } else {
      playDrone();
    }
  };

  useEffect(() => {
    if (isDronePlaying && droneOscRef.current && droneCtxRef.current) {
      const noteIndex = NOTE_STRINGS.indexOf(droneNote);
      const freq = 440 * Math.pow(2, (noteIndex - 9 + (droneOctave - 4) * 12) / 12);
      droneOscRef.current.frequency.setTargetAtTime(freq, droneCtxRef.current.currentTime, 0.05);
    }
  }, [droneNote, droneOctave, isDronePlaying]);

  useEffect(() => {
    if (droneGainRef.current && droneCtxRef.current) {
      droneGainRef.current.gain.setTargetAtTime(droneVolume, droneCtxRef.current.currentTime, 0.05);
    }
  }, [droneVolume]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (stopDroneTimerRef.current) clearTimeout(stopDroneTimerRef.current);
      // 元件卸載時同樣要停掉麥克風 track，不能只關 AudioContext
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (droneCtxRef.current && droneCtxRef.current.state !== 'closed') {
        droneCtxRef.current.close();
      }
    };
  }, []);

  return (
    <div className={cn("bg-surface-warm backdrop-blur-md rounded-3xl shadow-xl border border-white/5 p-6 flex flex-col transition-all", className)}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between shrink-0 h-10 mb-6">
          <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => setActiveTab('tuner')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                activeTab === 'tuner' 
                  ? "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20" 
                  : "text-text-muted hover:text-text-warm hover:bg-white/5"
              )}
            >
              <Settings2 size={16} />
              調音器
            </button>
            <button
              onClick={() => setActiveTab('drone')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                activeTab === 'drone' 
                  ? "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20" 
                  : "text-text-muted hover:text-text-warm hover:bg-white/5"
              )}
            >
              <Volume2 size={16} />
              基準音
            </button>
          </div>
          {activeTab === 'tuner' && (
            <button
              onClick={toggleTuner}
              className={cn(
                "p-2 rounded-xl transition-all",
                isListening ? "bg-red-500/20 text-red-400" : "bg-white/5 text-text-muted hover:text-text-warm"
              )}
            >
              {isListening ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center h-40 shrink-0 mb-6">
          {activeTab === 'tuner' ? (
            <>
              <div className="text-7xl font-bold leading-none text-text-warm tracking-tighter">
                {note}
              </div>
              <div className="text-sm font-bold text-text-muted font-mono mt-3">
                {pitch > 0 ? `${pitch.toFixed(1)} Hz` : '--- Hz'}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <select
                value={droneNote}
                onChange={(e) => setDroneNote(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-2xl font-bold text-text-warm focus:outline-none focus:border-accent-warm appearance-none text-center"
              >
                {NOTE_STRINGS.map(n => <option key={n} value={n} className="bg-bg-warm">{n}</option>)}
              </select>
              <select
                value={droneOctave}
                onChange={(e) => setDroneOctave(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-2xl font-bold text-text-warm focus:outline-none focus:border-accent-warm appearance-none text-center"
              >
                {[2, 3, 4, 5, 6].map(o => <option key={o} value={o} className="bg-bg-warm">{o}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          {activeTab === 'tuner' ? (
            <div className="w-full flex flex-col">
              <div className="flex items-center gap-4 h-12 mb-4">
                <div className="w-10 shrink-0" />
                <div className="flex-1 flex items-center h-full">
                  <div className="w-full h-2 bg-white/10 rounded-full relative overflow-hidden">
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30 -translate-x-1/2" />
                    {isListening && note !== '-' && (
                      <div 
                        className={cn(
                          "absolute top-0 bottom-0 w-2 rounded-full -translate-x-1/2 transition-all duration-75",
                          Math.abs(cents) < 5 ? "bg-emerald-500" : "bg-accent-warm"
                        )}
                        style={{ left: `${Math.max(0, Math.min(100, 50 + (cents / 50) * 50))}%` }}
                      />
                    )}
                  </div>
                </div>
                <div className="w-10 shrink-0" />
              </div>
              <div className="flex items-center justify-center h-12">
                <div className="flex justify-between w-full max-w-[200px] text-xs text-text-muted font-bold">
                  <span>-50</span>
                  <span className={cn("transition-colors", Math.abs(cents) < 5 ? "text-emerald-500 scale-110" : "")}>0</span>
                  <span>+50</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 h-12 mb-4">
                <button 
                  onClick={() => setDroneVolume(Math.max(0, droneVolume - 0.1))}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-warm rounded-xl transition-all active:scale-95 shrink-0"
                >
                  <VolumeX size={18} />
                </button>
                
                <div className="flex-1 flex items-center h-full">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={droneVolume}
                    onChange={(e) => setDroneVolume(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-warm"
                  />
                </div>

                <button 
                  onClick={() => setDroneVolume(Math.min(1, droneVolume + 0.1))}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-warm rounded-xl transition-all active:scale-95 shrink-0"
                >
                  <Volume2 size={18} />
                </button>
              </div>
              <div className="h-12" />
            </>
          )}
        </div>

        <div className="mt-auto pt-6">
          {activeTab === 'drone' ? (
            <button
              onClick={toggleDrone}
              className={cn(
                "w-full h-16 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg transition-all active:scale-[0.98]",
                isDronePlaying 
                  ? "bg-white/10 text-text-warm" 
                  : "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20 hover:bg-accent-warm/90"
              )}
            >
              {isDronePlaying ? (
                <><Square size={24} fill="currentColor" /> 停止</>
              ) : (
                <><Play size={24} fill="currentColor" /> 開始</>
              )}
            </button>
          ) : (
            <div className="h-16" /> // Placeholder to maintain height
          )}
        </div>
      </div>
    </div>
  );
};
