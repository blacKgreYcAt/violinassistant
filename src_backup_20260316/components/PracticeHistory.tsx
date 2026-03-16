import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, Plus, Share2, Pen } from 'lucide-react';
import { getPracticeHistory, addPracticeSession, PracticeSession } from '../lib/storage';
import { cn } from '../lib/utils';

interface PracticeHistoryProps {
  className?: string;
}

export const PracticeHistory: React.FC<PracticeHistoryProps> = ({ className }) => {
  const [history, setHistory] = useState<PracticeSession[]>([]);
  const [manualMinutes, setManualMinutes] = useState<number>(30);
  const [isAdding, setIsAdding] = useState(false);

  const loadHistory = async () => {
    const data = await getPracticeHistory();
    setHistory(data);
  };

  useEffect(() => {
    loadHistory();
    window.addEventListener('practice-history-updated', loadHistory);
    return () => window.removeEventListener('practice-history-updated', loadHistory);
  }, []);

  const handleManualAdd = async () => {
    if (manualMinutes > 0) {
      await addPracticeSession(manualMinutes * 60);
      setIsAdding(false);
    }
  };

  const shareHistory = async () => {
    if (history.length === 0) {
      alert("目前還沒有練習紀錄可以分享喔！");
      return;
    }

    const grouped: Record<string, number> = {};
    history.forEach(session => {
      grouped[session.date] = (grouped[session.date] || 0) + session.durationSeconds;
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    let text = "🎻 我的提琴練習紀錄\n\n";
    let totalSeconds = 0;
    
    text += "【每日練習時間】\n";
    sortedDates.forEach(date => {
      const mins = Math.round(grouped[date] / 60);
      text += `${date}: ${mins} 分鐘\n`;
      totalSeconds += grouped[date];
    });

    text += `\n總計練習：${Math.round(totalSeconds / 60)} 分鐘\n`;
    text += "來自「提琴練習小幫手」";

    try {
      if (navigator.canShare && navigator.canShare({ text })) {
        await navigator.share({
          title: '我的提琴練習紀錄',
          text: text,
        });
      } else {
        window.location.href = `mailto:?subject=${encodeURIComponent('我的提琴練習紀錄')}&body=${encodeURIComponent(text)}`;
      }
    } catch (error) {
      console.error("Share failed:", error);
      if ((error as any).name !== 'AbortError') {
        window.location.href = `mailto:?subject=${encodeURIComponent('我的提琴練習紀錄')}&body=${encodeURIComponent(text)}`;
      }
    }
  };

  // Process data for the last 7 days chart
  const getChartData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      const daySessions = history.filter(s => s.date === dateStr);
      const totalSeconds = daySessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
      
      data.push({
        name: `${d.getMonth() + 1}/${d.getDate()}`,
        dateStr,
        minutes: Math.round(totalSeconds / 60)
      });
    }
    return data;
  };

  const chartData = getChartData();
  const todayMinutes = chartData[chartData.length - 1].minutes;
  const totalMinutes = chartData.reduce((acc, curr) => acc + curr.minutes, 0);

  return (
    <div className={cn("bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5", className)}>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-accent-warm" />
            <h2 className="text-lg font-bold tracking-tight text-text-warm">練習紀錄</h2>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={shareHistory}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-warm"
              title="分享或發送郵件"
            >
              <Share2 size={20} />
            </button>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="p-2 hover:bg-accent-warm/10 rounded-full transition-colors text-accent-warm"
              title="手動補登"
            >
              <Pen size={20} />
            </button>
          </div>
        </div>

        {isAdding && (
          <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex-1">
              <label className="text-xs text-text-muted font-bold uppercase tracking-wider block mb-2">本次練習時間 (分鐘)</label>
              <input 
                type="number" 
                value={manualMinutes}
                onChange={(e) => setManualMinutes(Number(e.target.value))}
                min="1"
                className="w-full bg-bg-warm border border-white/10 rounded-xl px-4 py-2 text-text-warm font-bold outline-none focus:border-accent-warm"
              />
            </div>
            <button 
              onClick={handleManualAdd}
              className="mt-6 bg-accent-warm text-bg-warm px-6 py-2 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95"
            >
              儲存
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="bg-white/5 px-4 py-3 rounded-2xl border border-white/5 flex items-center justify-between">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">今日練習</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-text-warm">{todayMinutes}</span>
              <span className="text-xs text-text-muted font-bold">分鐘</span>
            </div>
          </div>
          <div className="bg-white/5 px-4 py-3 rounded-2xl border border-white/5 flex items-center justify-between">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">近七天累計</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-accent-warm">{totalMinutes}</span>
              <span className="text-xs text-text-muted font-bold">分鐘</span>
            </div>
          </div>
        </div>

        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#8E9299', fontSize: 10, fontWeight: 'bold' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#8E9299', fontSize: 10, fontWeight: 'bold' }} 
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: '#151619', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontWeight: 'bold' }}
                itemStyle={{ color: '#F27D26' }}
                formatter={(value: number) => [`${value} 分鐘`, '練習時間']}
              />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#F27D26' : 'rgba(242, 125, 38, 0.4)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
