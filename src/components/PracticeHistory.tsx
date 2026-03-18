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

    let text = "🎻 我的練琴練習紀錄\n\n";
    let totalSeconds = 0;
    
    text += "【每日練習時間】\n";
    sortedDates.forEach(date => {
      const mins = Math.round(grouped[date] / 60);
      text += `${date}: ${mins} 分鐘\n`;
      totalSeconds += grouped[date];
    });

    text += `\n總計練習：${Math.round(totalSeconds / 60)} 分鐘\n`;
    text += "來自「練琴練習小幫手」";

    try {
      if (navigator.canShare && navigator.canShare({ text })) {
        await navigator.share({
          title: '我的練琴練習紀錄',
          text: text,
        });
      } else {
        window.location.href = `mailto:?subject=${encodeURIComponent('我的練琴練習紀錄')}&body=${encodeURIComponent(text)}`;
      }
    } catch (error) {
      console.error("Share failed:", error);
      if ((error as any).name !== 'AbortError') {
        window.location.href = `mailto:?subject=${encodeURIComponent('我的練琴練習紀錄')}&body=${encodeURIComponent(text)}`;
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
    <div className={cn("bg-surface-warm backdrop-blur-md p-3 md:p-4 rounded-3xl shadow-xl border border-white/5", className)}>
      <div className="flex flex-col gap-3 md:gap-4 h-full">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-accent-warm" />
            <h2 className="text-base md:text-lg font-bold tracking-tight text-text-warm">練習紀錄</h2>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={shareHistory}
              className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-warm"
              title="分享或發送郵件"
            >
              <Share2 size={18} />
            </button>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="p-1.5 hover:bg-accent-warm/10 rounded-full transition-colors text-accent-warm"
              title="手動補登"
            >
              <Pen size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 min-h-0">
          {/* Stats & Add Manual */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <div className="bg-white/5 px-4 py-6 rounded-2xl border border-white/5 flex flex-col justify-center flex-1">
              <div className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] mb-2">今日練習</div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold font-mono text-text-warm">{todayMinutes}</span>
                <span className="text-base text-text-muted font-bold">分鐘</span>
              </div>
            </div>
            <div className="bg-white/5 px-4 py-6 rounded-2xl border border-white/5 flex flex-col justify-center flex-1">
              <div className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] mb-2">近七天累計</div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold font-mono text-accent-warm">{totalMinutes}</span>
                <span className="text-base text-text-muted font-bold">分鐘</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="md:col-span-6 bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col">
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#8E9299', fontSize: 14, fontWeight: 'bold' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#8E9299', fontSize: 14, fontWeight: 'bold' }} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#151619', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontWeight: 'bold', fontSize: '14px', padding: '12px' }}
                    itemStyle={{ color: '#F27D26' }}
                    formatter={(value: number) => [`${value} 分鐘`, '練習時間']}
                  />
                  <Bar dataKey="minutes" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#F27D26' : 'rgba(242, 125, 38, 0.4)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Notes */}
          <div className="md:col-span-4 flex flex-col gap-2 min-h-0">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider shrink-0">近期筆記</h3>
            <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {history.filter(s => s.note).length > 0 ? (
                history
                  .filter(s => s.note)
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 3)
                  .map((session) => (
                    <div key={session.id} className="bg-white/5 p-3 rounded-xl border border-white/5 shrink-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-accent-warm">{session.date}</span>
                        <span className="text-xs text-text-muted">{Math.round(session.durationSeconds / 60)} 分鐘</span>
                      </div>
                      <p className="text-base text-text-warm whitespace-pre-wrap line-clamp-2 leading-relaxed">{session.note}</p>
                    </div>
                  ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-text-muted text-sm font-bold italic bg-white/5 rounded-xl border border-dashed border-white/10">
                  尚無筆記
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
