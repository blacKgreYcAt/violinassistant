import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Plus, Minus, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';

interface MetronomeProps {
  className?: string;
}

export const Metronome: React.FC<MetronomeProps> = ({ className }) => {
  const [bpm, setBpm] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioContext = useRef<AudioContext | null>(null);
  const nextNoteTime = useRef(0);
  const timerID = useRef<number | null>(null);
  const lookahead = 25.0; // How frequently to call scheduling function (in milliseconds)
  const scheduleAheadTime = 0.1; // How far ahead to schedule audio (in seconds)

  const playClick = useCallback((time: number, beat: number) => {
    if (!audioContext.current || isMuted) return;

    // Create a sharper, more percussive sound (Woodblock style)
    const osc = audioContext.current.createOscillator();
    const envelope = audioContext.current.createGain();
    
    // Use a square wave for better harmonic presence (cuts through better)
    // or stick to sine but with a very sharp envelope
    osc.type = 'sine';
    
    // Higher frequencies to cut through instrument resonance
    // 1200Hz for downbeat, 1000Hz for other beats
    osc.frequency.setValueAtTime(beat === 0 ? 1200 : 1000, time);
    
    // Sharp attack and quick decay for a "click" sound
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(1, time + 0.001); // Instant attack
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05); // Very short decay

    osc.connect(envelope);
    envelope.connect(audioContext.current.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }, [isMuted]);

  const scheduler = useCallback(() => {
    if (!audioContext.current) return;

    while (nextNoteTime.current < audioContext.current.currentTime + scheduleAheadTime) {
      const beatToPlay = currentBeat;
      playClick(nextNoteTime.current, beatToPlay);
      
      const secondsPerBeat = 60.0 / bpm;
      nextNoteTime.current += secondsPerBeat;
      
      setCurrentBeat((prev) => (prev + 1) % beatsPerMeasure);
    }
    timerID.current = window.setTimeout(scheduler, lookahead);
  }, [bpm, beatsPerMeasure, currentBeat, playClick]);

  const togglePlay = () => {
    if (!isPlaying) {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContext.current.state === 'suspended') {
        audioContext.current.resume();
      }

      setCurrentBeat(0);
      nextNoteTime.current = audioContext.current.currentTime + 0.05;
      setIsPlaying(true);
      scheduler();
    } else {
      setIsPlaying(false);
      if (timerID.current) {
        clearTimeout(timerID.current);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timerID.current) clearTimeout(timerID.current);
      if (audioContext.current) audioContext.current.close();
    };
  }, []);

  const handleBpmChange = (newBpm: number) => {
    setBpm(Math.min(Math.max(newBpm, 30), 300));
  };

  return (
    <div className={cn(
      "bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5 transition-all duration-75",
      isPlaying && currentBeat === 1 ? "ring-2 ring-accent-warm/50 scale-[1.01]" : "",
      className
    )}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between h-8">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">節拍器</h3>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            {isMuted ? <VolumeX size={20} className="text-red-400" /> : <Volume2 size={20} className="text-text-muted" />}
          </button>
        </div>

        <div className="flex flex-col items-center justify-center h-32">
          <div className="text-6xl font-bold font-mono tracking-tighter text-text-warm">
            {bpm}
          </div>
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-1">BPM</div>
        </div>

        <div className="flex items-center gap-3 h-12">
          <button 
            onClick={() => handleBpmChange(bpm - 1)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-warm rounded-xl transition-all active:scale-95"
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
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-warm rounded-xl transition-all active:scale-95"
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
                  isPlaying && currentBeat === (i + 1) % beatsPerMeasure ? "bg-accent-warm scale-125" : "bg-white/10"
                )}
              />
            ))}
          </div>
          <select 
            value={beatsPerMeasure}
            onChange={(e) => setBeatsPerMeasure(parseInt(e.target.value))}
            className="text-sm font-semibold bg-white/5 text-text-warm px-3 py-1 rounded-lg outline-none"
          >
            <option value="2">2/4</option>
            <option value="3">3/4</option>
            <option value="4">4/4</option>
            <option value="6">6/8</option>
          </select>
        </div>

        <button 
          onClick={togglePlay}
          className={cn(
            "w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg transition-all active:scale-[0.98]",
            isPlaying 
              ? "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20" 
              : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
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
  );
};
