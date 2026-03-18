import React, { useEffect, useState } from 'react';
import { X, Music, Star, Award, Sparkles } from 'lucide-react';
import { getRewards, RewardsState } from '../lib/storage';
import { cn } from '../lib/utils';

interface RewardCardProps {
  isOpen: boolean;
  onClose: () => void;
}

const BowIcon = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
    <g transform="rotate(-45 50 50)">
      {/* Stick */}
      <rect x="10" y="46" width="80" height="4" fill="#8B4513" rx="2" />
      {/* Hair */}
      <rect x="15" y="54" width="70" height="2" fill="#E8E8E8" />
      {/* Frog */}
      <rect x="12" y="46" width="8" height="10" fill="#222" rx="1" />
      <circle cx="16" cy="51" r="1.5" fill="#FFD700" />
      {/* Tip */}
      <path d="M88 46 Q 94 46 90 56 L 85 56 Z" fill="#8B4513" />
    </g>
  </svg>
);

const MusicStandIcon = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
    {/* Tripod Base */}
    <path d="M 50 85 L 25 95 L 28 92 L 50 82 L 72 92 L 75 95 Z" fill="#4a5568" />
    <rect x="47" y="40" width="6" height="45" fill="#718096" />
    {/* Stand Desk */}
    <path d="M 15 25 L 85 25 L 80 45 L 20 45 Z" fill="#2d3748" />
    <rect x="15" y="45" width="70" height="4" fill="#1a202c" rx="2" />
    {/* Sheet Music */}
    <g transform="rotate(-5 50 30)">
      <rect x="30" y="15" width="40" height="28" fill="#f7fafc" rx="1" />
      <path d="M 35 22 L 60 20 M 35 26 L 60 24 M 35 30 L 50 28" stroke="#cbd5e0" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="42" cy="27" r="1.5" fill="#4a5568" />
      <circle cx="52" cy="25" r="1.5" fill="#4a5568" />
      <path d="M 43 27 L 43 20 M 53 25 L 53 18" stroke="#4a5568" strokeWidth="1" />
    </g>
  </svg>
);

const INSTRUMENTS = [
  { id: 'stand', name: '琴譜架', render: () => <div className="w-16 h-16"><MusicStandIcon /></div> },
  { id: 'bow', name: '琴弓', render: () => <div className="w-16 h-16"><BowIcon /></div> },
  { id: 'violin', name: '小提琴', render: () => <div className="text-6xl transform scale-75 drop-shadow-md">🎻</div> },
  { id: 'viola', name: '中提琴', render: () => <div className="text-6xl transform scale-90 hue-rotate-15 drop-shadow-md">🎻</div> },
  { id: 'cello', name: '大提琴', render: () => <div className="text-6xl transform scale-100 hue-rotate-30 drop-shadow-md">🎻</div> },
  { id: 'bass', name: '低音提琴', render: () => <div className="text-6xl transform scale-110 hue-rotate-60 drop-shadow-md">🎻</div> },
];

export const RewardCard: React.FC<RewardCardProps> = ({ isOpen, onClose }) => {
  const [rewards, setRewards] = useState<RewardsState | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRewards();
    }
  }, [isOpen]);

  const loadRewards = async () => {
    const data = await getRewards();
    setRewards(data);
  };

  if (!isOpen || !rewards) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-warm w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-accent-warm p-6 text-center relative shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-bg-warm hover:bg-black/10 p-2 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-bg-warm flex items-center justify-center gap-2">
            <Star className="w-6 h-6 fill-bg-warm" />
            音樂集點卡
            <Star className="w-6 h-6 fill-bg-warm" />
          </h2>
          <p className="text-bg-warm/80 mt-2 text-sm">
            每練習 30 分鐘可獲得 1 個音符 🎵，集滿 10 個音符即可獲得拼圖碎片！
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          {/* Notes Section */}
          <div className="bg-white/50 p-6 rounded-2xl border border-accent-warm/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-warm flex items-center gap-2">
                <Music className="w-5 h-5 text-accent-warm" />
                收集音符
              </h3>
              <span className="text-sm font-medium text-text-muted">
                總計獲得：{rewards.totalNotes} 🎵
              </span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-3">
              {Array.from({ length: 10 }).map((_, i) => {
                const isCollected = i < rewards.currentNotes;
                return (
                  <div 
                    key={i}
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all duration-500",
                      isCollected 
                        ? "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/40 scale-110" 
                        : "bg-black/5 text-black/10"
                    )}
                  >
                    {isCollected ? '🎵' : '·'}
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-4 text-sm text-text-muted font-medium">
              進度：{rewards.currentNotes} / 10
            </div>
          </div>

          {/* Puzzles Section */}
          <div>
            <h3 className="text-lg font-bold text-text-warm flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-accent-warm" />
              樂器拼圖收集
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {INSTRUMENTS.map(inst => {
                const collectedPieces = rewards.pieces.filter(p => p.startsWith(`${inst.id}-`));
                const isComplete = collectedPieces.length === 6;
                
                return (
                  <div 
                    key={inst.id} 
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center",
                      isComplete ? "bg-accent-warm/10 border-accent-warm/30 shadow-sm" : "bg-white/50 border-black/5"
                    )}
                  >
                    <div className="text-sm font-bold text-text-warm mb-3">
                      {inst.name}
                    </div>
                    
                    {/* Puzzle Image Container */}
                    <div className="relative w-24 h-24 mb-2 rounded-xl overflow-hidden bg-white/50 shadow-inner border border-black/5">
                      {/* Base Image (Always colored) */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {inst.render()}
                      </div>
                      
                      {/* Puzzle Grid Overlay */}
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 gap-[1px] bg-black/10 p-[1px]">
                        {[1, 2, 3, 4, 5, 6].map(i => {
                          const isCollected = rewards.pieces.includes(`${inst.id}-${i}`);
                          return (
                            <div 
                              key={i} 
                              className={cn(
                                "transition-all duration-500",
                                isCollected 
                                  ? "opacity-0" 
                                  : "backdrop-grayscale bg-bg-warm/80"
                              )}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-center text-[10px] text-text-muted font-medium">
                      {collectedPieces.length} / 6
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ultimate Badge */}
          <div className={cn(
            "p-6 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all duration-700",
            rewards.concertmasterUnlocked 
              ? "bg-gradient-to-br from-yellow-100 to-amber-100 border-yellow-400 shadow-xl shadow-yellow-400/20" 
              : "bg-black/5 border-black/10 grayscale opacity-60"
          )}>
            <div className="relative">
              <Award className={cn(
                "w-20 h-20 mb-2",
                rewards.concertmasterUnlocked ? "text-yellow-500" : "text-black/20"
              )} />
              {rewards.concertmasterUnlocked && (
                <Sparkles className="w-8 h-8 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
              )}
            </div>
            <h3 className={cn(
              "text-xl font-black tracking-widest",
              rewards.concertmasterUnlocked ? "text-yellow-700" : "text-black/40"
            )}>
              首席演奏家
            </h3>
            <p className={cn(
              "text-sm mt-2 max-w-xs",
              rewards.concertmasterUnlocked ? "text-yellow-600/80" : "text-black/30"
            )}>
              {rewards.concertmasterUnlocked 
                ? "太棒了！你已經收集了所有樂器拼圖，成為了真正的首席演奏家！" 
                : "收集所有樂器拼圖（共 36 片）即可解鎖終極徽章！"}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
