import React, { useState, useEffect } from 'react';
import { Target, Plus, CheckCircle2, Circle, TrendingUp, Calendar, Clock, Music } from 'lucide-react';
import { cn } from '../lib/utils';
import { getGoals, saveGoals, getPracticeHistory, PracticeGoal } from '../lib/storage';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface PracticeGoalsProps {
  className?: string;
}

export const PracticeGoals: React.FC<PracticeGoalsProps> = ({ className }) => {
  const [goals, setGoals] = useState<PracticeGoal[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState<Partial<PracticeGoal>>({
    type: 'time',
    target: 60,
    period: 'weekly',
    current: 0
  });

  useEffect(() => {
    const loadData = async () => {
      const savedGoals = await getGoals();
      const practiceHistory = await getPracticeHistory();
      setGoals(savedGoals);
      setHistory(practiceHistory);
      
      // Update current progress for goals
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      
      const updatedGoals = savedGoals.map(goal => {
        let current = 0;
        if (goal.type === 'time') {
          current = practiceHistory
            .filter(h => h.timestamp >= oneWeekAgo)
            .reduce((acc, h) => acc + (h.durationSeconds / 60), 0);
        } else if (goal.type === 'sessions') {
          current = practiceHistory
            .filter(h => h.timestamp >= oneWeekAgo).length;
        }
        return { ...goal, current: Math.round(current) };
      });
      
      if (JSON.stringify(updatedGoals) !== JSON.stringify(savedGoals)) {
        setGoals(updatedGoals);
        await saveGoals(updatedGoals);
      }
    };
    loadData();
  }, []);

  const handleAddGoal = async () => {
    if (!newGoal.title || !newGoal.target) return;
    
    const goal: PracticeGoal = {
      id: crypto.randomUUID(),
      title: newGoal.title,
      type: newGoal.type as 'time' | 'sessions' | 'score',
      target: Number(newGoal.target),
      current: 0,
      period: 'weekly'
    };
    
    const updatedGoals = [...goals, goal];
    setGoals(updatedGoals);
    await saveGoals(updatedGoals);
    setShowAddGoal(false);
    setNewGoal({ type: 'time', target: 60, period: 'weekly', current: 0 });
  };

  const deleteGoal = async (id: string) => {
    const updatedGoals = goals.filter(g => g.id !== id);
    setGoals(updatedGoals);
    await saveGoals(updatedGoals);
  };

  // Insights Data
  const weeklyData = [
    { name: 'Mon', time: 0 },
    { name: 'Tue', time: 0 },
    { name: 'Wed', time: 0 },
    { name: 'Thu', time: 0 },
    { name: 'Fri', time: 0 },
    { name: 'Sat', time: 0 },
    { name: 'Sun', time: 0 },
  ];

  history.forEach(h => {
    const day = new Date(h.timestamp).getDay();
    const index = (day + 6) % 7; // Adjust to Mon-Sun
    weeklyData[index].time += Math.round(h.durationSeconds / 60);
  });

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-accent-warm" />
            <h3 className="font-bold text-sm text-text-warm">本週練習時數 (分鐘)</h3>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="time" fill="#f27d26" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-accent-warm" />
            <h3 className="font-bold text-sm text-text-warm">目標達成率</h3>
          </div>
          <div className="h-48 w-full flex items-center justify-center">
            {goals.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={goals.map(g => ({ name: g.title, value: Math.min(100, (g.current / g.target) * 100) }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {goals.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-text-muted italic">尚未設定目標</p>
            )}
          </div>
        </div>
      </div>

      {/* Goals List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-text-warm flex items-center gap-2">
            <Target size={20} className="text-accent-warm" />
            練習目標
          </h3>
          <button 
            onClick={() => setShowAddGoal(true)}
            className="p-2 bg-accent-warm text-white rounded-xl hover:opacity-90 transition-all active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {goals.map(goal => (
            <div key={goal.id} className="bg-white/5 p-4 rounded-2xl border border-white/10 group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    goal.current >= goal.target ? "bg-emerald-500/20 text-emerald-500" : "bg-white/10 text-text-muted"
                  )}>
                    {goal.current >= goal.target ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-text-warm">{goal.title}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">
                      {goal.type === 'time' ? '練習時數' : goal.type === 'sessions' ? '練習次數' : '曲目熟練'} • {goal.period === 'weekly' ? '每週' : '每日'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => deleteGoal(goal.id)}
                  className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  刪除
                </button>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-text-muted">{goal.current} / {goal.target} {goal.type === 'time' ? '分鐘' : '次'}</span>
                  <span className={cn(
                    goal.current >= goal.target ? "text-emerald-500" : "text-accent-warm"
                  )}>
                    {Math.round((goal.current / goal.target) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      goal.current >= goal.target ? "bg-emerald-500" : "bg-accent-warm"
                    )}
                    style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}

          {goals.length === 0 && !showAddGoal && (
            <div className="text-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/10">
              <Target size={48} className="mx-auto text-text-muted mb-4 opacity-20" />
              <p className="text-sm text-text-muted">設定你的第一個練習目標吧！</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-warm w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10">
            <h3 className="text-xl font-bold text-text-warm mb-6">新增練習目標</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-2">目標名稱</label>
                <input 
                  type="text"
                  value={newGoal.title || ''}
                  onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                  placeholder="例如：每週練習時數"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-warm focus:outline-none focus:border-accent-warm transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-2">類型</label>
                  <select 
                    value={newGoal.type}
                    onChange={e => setNewGoal({ ...newGoal, type: e.target.value as any })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-warm focus:outline-none focus:border-accent-warm transition-all"
                  >
                    <option value="time">練習時數</option>
                    <option value="sessions">練習次數</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-2">目標數值</label>
                  <input 
                    type="number"
                    value={newGoal.target || ''}
                    onChange={e => setNewGoal({ ...newGoal, target: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-warm focus:outline-none focus:border-accent-warm transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAddGoal(false)}
                  className="flex-1 py-3 bg-white/5 text-text-warm rounded-2xl font-bold hover:bg-white/10 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleAddGoal}
                  className="flex-1 py-3 bg-accent-warm text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent-warm/20"
                >
                  儲存目標
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
