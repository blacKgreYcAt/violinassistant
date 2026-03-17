import { get, set, del } from 'idb-keyval';

export interface Score {
  id: string;
  name: string;
  type: 'file' | 'link';
  data: string | string[];
  date: number;
  folderId?: string;
  tags?: string[];
  rotations?: number[]; // Array of rotation angles for each page
  annotations?: string[]; // Array of serialized canvas data for each page
}

export interface Folder {
  id: string;
  name: string;
  color: string;
}

export interface PracticeSession {
  id: string;
  date: string; // YYYY-MM-DD
  durationSeconds: number;
  timestamp: number;
  note?: string;
}

export interface Recording {
  id: string;
  scoreId: string;
  timestamp: number;
  type: 'video' | 'audio';
  blob: Blob;
  durationSeconds?: number;
}

export interface PracticeRoutine {
  id: string;
  name: string;
  steps: {
    id: string;
    name: string;
    duration: number;
  }[];
}

export interface RewardsState {
  currentNotes: number; // 0-9
  totalNotes: number;
  pieces: string[]; // e.g., 'violin-1', 'bow-6'
  concertmasterUnlocked: boolean;
  unrewardedSeconds?: number;
}

export interface RewardResult {
  earnedNotes: number;
  earnedPieces: string[];
  unlockedConcertmaster: boolean;
}

const SCORES_KEY = 'viola-scores-idb';
const FOLDERS_KEY = 'viola-folders-idb';
const HISTORY_KEY = 'viola-practice-history';
const RECORDINGS_KEY = 'viola-recordings-idb';
const ROUTINES_KEY = 'viola-routines-idb';
const REWARDS_KEY = 'viola-rewards-idb';

// --- Folders ---

export async function getFolders(): Promise<Folder[]> {
  try {
    const folders = await get<Folder[]>(FOLDERS_KEY);
    return folders || [];
  } catch (error) {
    console.error('Failed to get folders:', error);
    return [];
  }
}

export async function saveFolders(folders: Folder[]): Promise<void> {
  try {
    await set(FOLDERS_KEY, folders);
  } catch (error) {
    console.error('Failed to save folders:', error);
  }
}

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

export async function addPracticeSession(durationSeconds: number, note?: string): Promise<PracticeSession[]> {
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
      timestamp: Date.now(),
      note
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

// --- Recordings ---

export async function getRecordingsByScoreId(scoreId: string): Promise<Recording[]> {
  try {
    const recordings = await get<Recording[]>(RECORDINGS_KEY);
    if (!recordings) return [];
    return recordings.filter(r => r.scoreId === scoreId).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to get recordings:', error);
    return [];
  }
}

export async function saveRecording(recording: Recording): Promise<void> {
  try {
    const recordings = await get<Recording[]>(RECORDINGS_KEY) || [];
    await set(RECORDINGS_KEY, [...recordings, recording]);
  } catch (error) {
    console.error('Failed to save recording:', error);
    throw new Error('儲存錄音/錄影失敗：設備空間可能不足。');
  }
}

export async function deleteRecording(id: string): Promise<void> {
  try {
    const recordings = await get<Recording[]>(RECORDINGS_KEY) || [];
    await set(RECORDINGS_KEY, recordings.filter(r => r.id !== id));
  } catch (error) {
    console.error('Failed to delete recording:', error);
  }
}

// --- Routines ---

export async function getRoutines(): Promise<PracticeRoutine[]> {
  try {
    const routines = await get<PracticeRoutine[]>(ROUTINES_KEY);
    return routines || [];
  } catch (error) {
    console.error('Failed to get routines:', error);
    return [];
  }
}

export async function saveRoutines(routines: PracticeRoutine[]): Promise<void> {
  try {
    await set(ROUTINES_KEY, routines);
  } catch (error) {
    console.error('Failed to save routines:', error);
  }
}

// --- Rewards ---

export async function getRewards(): Promise<RewardsState> {
  try {
    const state = await get<RewardsState>(REWARDS_KEY);
    return state || { currentNotes: 0, totalNotes: 0, pieces: [], concertmasterUnlocked: false, unrewardedSeconds: 0 };
  } catch (error) {
    console.error('Failed to get rewards:', error);
    return { currentNotes: 0, totalNotes: 0, pieces: [], concertmasterUnlocked: false, unrewardedSeconds: 0 };
  }
}

export async function processPracticeReward(seconds: number): Promise<RewardResult> {
  try {
    let state = await getRewards();
    
    // Accumulate seconds
    const totalUnrewarded = (state.unrewardedSeconds || 0) + seconds;
    
    // 1 note per 30 minutes (1800 seconds)
    const earnedNotes = Math.floor(totalUnrewarded / 1800);
    
    // Update unrewarded seconds (keep the remainder)
    state.unrewardedSeconds = totalUnrewarded % 1800;

    if (earnedNotes === 0) {
      await set(REWARDS_KEY, state);
      return { earnedNotes: 0, earnedPieces: [], unlockedConcertmaster: false };
    }

    let newNotes = state.currentNotes + earnedNotes;
    let piecesToAward = Math.floor(newNotes / 10);
    
    state.currentNotes = newNotes % 10;
    state.totalNotes += earnedNotes;

    const earnedPieces: string[] = [];
    const categories = ['stand', 'bow', 'violin', 'viola', 'cello', 'bass'];
    const allPossiblePieces: string[] = [];
    for (const cat of categories) {
      for (let i = 1; i <= 6; i++) {
        allPossiblePieces.push(`${cat}-${i}`);
      }
    }

    let unlockedConcertmaster = false;

    for (let i = 0; i < piecesToAward; i++) {
      const uncollected = allPossiblePieces.filter(p => !state.pieces.includes(p));
      if (uncollected.length > 0) {
        const randomIndex = Math.floor(Math.random() * uncollected.length);
        const piece = uncollected[randomIndex];
        state.pieces.push(piece);
        earnedPieces.push(piece);
      }
    }

    if (state.pieces.length === 36 && !state.concertmasterUnlocked) {
      state.concertmasterUnlocked = true;
      unlockedConcertmaster = true;
    }

    await set(REWARDS_KEY, state);

    return { earnedNotes, earnedPieces, unlockedConcertmaster };
  } catch (error) {
    console.error('Failed to process rewards:', error);
    return { earnedNotes: 0, earnedPieces: [], unlockedConcertmaster: false };
  }
}
