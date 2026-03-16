import React, { useState, useEffect } from 'react';
import { Plus, Play, Trash2, Edit2, Check, X, Clock, Music } from 'lucide-react';
import { PracticeRoutine, getRoutines, saveRoutines } from '../lib/storage';
import { cn } from '../lib/utils';

interface PracticeRoutinesProps {
  onStartRoutine: (routine: PracticeRoutine) => void;
  className?: string;
}

export const PracticeRoutines: React.FC<PracticeRoutinesProps> = ({ onStartRoutine, className }) => {
  const [routines, setRoutines] = useState<PracticeRoutine[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newSteps, setNewSteps] = useState<{ id: string; name: string; duration: number }[]>([]);

  useEffect(() => {
    loadRoutines();
  }, []);

  const loadRoutines = async () => {
    const loaded = await getRoutines();
    setRoutines(loaded);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setNewRoutineName('');
    setNewSteps([{ id: Math.random().toString(36).substr(2, 9), name: '', duration: 5 }]);
  };

  const handleAddStep = () => {
    setNewSteps([...newSteps, { id: Math.random().toString(36).substr(2, 9), name: '', duration: 5 }]);
  };

  const handleUpdateStep = (id: string, field: 'name' | 'duration', value: string | number) => {
    setNewSteps(newSteps.map(step => 
      step.id === id ? { ...step, [field]: value } : step
    ));
  };

  const handleRemoveStep = (id: string) => {
    setNewSteps(newSteps.filter(step => step.id !== id));
  };

  const handleSaveRoutine = async () => {
    if (!newRoutineName.trim() || newSteps.length === 0) return;
    
    // Validate steps
    const validSteps = newSteps.filter(s => s.name.trim() && s.duration > 0);
    if (validSteps.length === 0) return;

    const newRoutine: PracticeRoutine = {
      id: editingId || Math.random().toString(36).substr(2, 9),
      name: newRoutineName.trim(),
      steps: validSteps
    };

    let updatedRoutines;
    if (editingId) {
      updatedRoutines = routines.map(r => r.id === editingId ? newRoutine : r);
    } else {
      updatedRoutines = [...routines, newRoutine];
    }

    await saveRoutines(updatedRoutines);
    setRoutines(updatedRoutines);
    setIsCreating(false);
    setEditingId(null);
  };

  const handleEdit = (routine: PracticeRoutine) => {
    setEditingId(routine.id);
    setNewRoutineName(routine.name);
    setNewSteps(routine.steps);
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除這個練習計畫嗎？')) {
      const updated = routines.filter(r => r.id !== id);
      await saveRoutines(updated);
      setRoutines(updated);
    }
  };

  const calculateTotalDuration = (steps: { duration: number }[]) => {
    return steps.reduce((total, step) => total + step.duration, 0);
  };

  if (isCreating) {
    return (
      <div className={cn("bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5 flex flex-col gap-6", className)}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-text-warm">
            {editingId ? '編輯練習計畫' : '新增練習計畫'}
          </h2>
          <button 
            onClick={() => { setIsCreating(false); setEditingId(null); }}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-warm"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={newRoutineName}
            onChange={(e) => setNewRoutineName(e.target.value)}
            placeholder="計畫名稱 (例如：每日暖身)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-warm focus:outline-none focus:border-accent-warm transition-all"
          />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text-muted">練習步驟</span>
              <span className="text-xs font-bold text-accent-warm">
                總時長: {calculateTotalDuration(newSteps)} 分鐘
              </span>
            </div>
            
            {newSteps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                <span className="text-xs font-bold text-text-muted w-6 text-center">{index + 1}.</span>
                <input
                  type="text"
                  value={step.name}
                  onChange={(e) => handleUpdateStep(step.id, 'name', e.target.value)}
                  placeholder="步驟名稱 (例如：音階練習)"
                  className="flex-1 bg-transparent border-none text-sm text-text-warm focus:outline-none px-2 min-w-0"
                />
                <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1 shrink-0">
                  <input
                    type="number"
                    min="1"
                    value={step.duration}
                    onChange={(e) => handleUpdateStep(step.id, 'duration', parseInt(e.target.value) || 0)}
                    className="w-12 bg-transparent border-none text-sm text-center text-text-warm focus:outline-none"
                  />
                  <span className="text-xs text-text-muted">分鐘</span>
                </div>
                <button 
                  onClick={() => handleRemoveStep(step.id)}
                  className="p-1.5 text-text-muted hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            <button 
              onClick={handleAddStep}
              className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-white/10 hover:border-accent-warm/50 rounded-xl text-sm font-bold text-text-muted hover:text-accent-warm transition-all"
            >
              <Plus size={16} />
              新增步驟
            </button>
          </div>

          <button 
            onClick={handleSaveRoutine}
            disabled={!newRoutineName.trim() || newSteps.length === 0}
            className="w-full py-3 bg-accent-warm hover:bg-accent-warm/90 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            儲存計畫
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5 flex flex-col gap-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music size={20} className="text-accent-warm" />
          <h2 className="text-lg font-bold tracking-tight text-text-warm">練習計畫</h2>
        </div>
        <button 
          onClick={handleCreateNew}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-warm"
          title="新增練習計畫"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {routines.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            尚未建立任何練習計畫
          </div>
        ) : (
          routines.map(routine => (
            <div 
              key={routine.id}
              className="group flex flex-col gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-accent-warm/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-text-warm">{routine.name}</span>
                  <span className="text-xs text-text-muted flex items-center gap-1 mt-1">
                    <Clock size={12} />
                    總時長: {calculateTotalDuration(routine.steps)} 分鐘 ({routine.steps.length} 個步驟)
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onStartRoutine(routine)}
                    className="p-2 bg-accent-warm/10 text-accent-warm hover:bg-accent-warm hover:text-white rounded-xl transition-all"
                    title="開始練習"
                  >
                    <Play size={16} className="ml-0.5" />
                  </button>
                  <button 
                    onClick={() => handleEdit(routine)}
                    className="p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(routine.id)}
                    className="p-2 text-text-muted hover:text-red-400 hover:bg-white/5 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-1">
                {routine.steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-1 text-[10px] bg-black/20 px-2 py-1 rounded-md">
                    <span className="text-text-muted">{idx + 1}.</span>
                    <span className="text-text-warm font-medium">{step.name}</span>
                    <span className="text-accent-warm ml-1">{step.duration}m</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
