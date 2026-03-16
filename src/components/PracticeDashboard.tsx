import React, { useState } from 'react';
import { PracticeHistory } from './PracticeHistory';
import { PracticeRoutines } from './PracticeRoutines';
import { PracticeRoutine } from '../lib/storage';
import { cn } from '../lib/utils';
import { History, ListMusic } from 'lucide-react';

interface PracticeDashboardProps {
  onStartRoutine: (routine: PracticeRoutine) => void;
  className?: string;
}

export const PracticeDashboard: React.FC<PracticeDashboardProps> = ({ onStartRoutine, className }) => {
  const [activeTab, setActiveTab] = useState<'history' | 'routines'>('history');

  return (
    <div className={cn("bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5 flex flex-col gap-6", className)}>
      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl shrink-0">
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'history' 
              ? "bg-accent-warm text-white shadow-lg" 
              : "text-text-muted hover:text-text-warm hover:bg-white/5"
          )}
        >
          <History size={16} />
          練習紀錄
        </button>
        <button
          onClick={() => setActiveTab('routines')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'routines' 
              ? "bg-accent-warm text-white shadow-lg" 
              : "text-text-muted hover:text-text-warm hover:bg-white/5"
          )}
        >
          <ListMusic size={16} />
          練習計畫
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'history' ? (
          <PracticeHistory className="h-full p-0 bg-transparent shadow-none border-none" />
        ) : (
          <PracticeRoutines onStartRoutine={onStartRoutine} className="h-full p-0 bg-transparent shadow-none border-none overflow-y-auto custom-scrollbar" />
        )}
      </div>
    </div>
  );
};
