import { get, set, del } from 'idb-keyval';

export interface Score {
  id: string;
  name: string;
  type: 'file' | 'link';
  data: string | string[];
  date: number;
}

export interface PracticeSession {
  id: string;
  date: string; // YYYY-MM-DD
  durationSeconds: number;
  timestamp: number;
}

const SCORES_KEY = 'viola-scores-idb';
const HISTORY_KEY = 'viola-practice-history';

// --- Scores ---

export async function getScores(): Promise<Score[]> {
  try {
    // 1. Try to get from IndexedDB
    let scores = await get<Score[]>(SCORES_KEY);
    
    // 2. Migration: If empty, check localStorage (old 5MB limit storage)
    if (!scores || scores.length === 0) {
      const oldScores = localStorage.getItem('viola-scores');
      if (oldScores) {
        scores = JSON.parse(oldScores);
        // Save to IndexedDB
        if (scores && scores.length > 0) {
          await set(SCORES_KEY, scores);
          // Optional: clear localStorage to free up space, but we can keep it as backup for now
          // localStorage.removeItem('viola-scores');
        }
      }
    }
    
    return scores || [];
  } catch (error) {
    console.error('Failed to get scores from storage:', error);
    return [];
  }
}

export async function saveScores(scores: Score[]): Promise<void> {
  try {
    await set(SCORES_KEY, scores);
  } catch (error) {
    console.error('Failed to save scores to storage:', error);
    throw new Error('儲存失敗：設備空間可能不足。');
  }
}

// --- Practice History ---

export async function getPracticeHistory(): Promise<PracticeSession[]> {
  try {
    const history = await get<PracticeSession[]>(HISTORY_KEY);
    return history || [];
  } catch (error) {
    console.error('Failed to get practice history:', error);
    return [];
  }
}

export async function addPracticeSession(durationSeconds: number): Promise<PracticeSession[]> {
  if (durationSeconds <= 0) return getPracticeHistory();

  try {
    const history = await getPracticeHistory();
    const today = new Date();
    // Local YYYY-MM-DD string
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const newSession: PracticeSession = {
      id: Math.random().toString(36).substring(2, 9),
      date: dateStr,
      durationSeconds,
      timestamp: Date.now()
    };
    
    const updatedHistory = [...history, newSession];
    await set(HISTORY_KEY, updatedHistory);
    
    // Dispatch a custom event so other components can update
    window.dispatchEvent(new CustomEvent('practice-history-updated'));
    
    return updatedHistory;
  } catch (error) {
    console.error('Failed to add practice session:', error);
    return await getPracticeHistory();
  }
}
