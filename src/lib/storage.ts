import { get, set } from 'idb-keyval';
import type { ScoreSection } from './scoreSections';

export type { ScoreSection };

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
  mastery?: number; // 0-100 percentage
  tempoHistory?: { bpm: number; date: number }[];
  cropData?: { x: number; y: number; width: number; height: number }[]; // Per page crop
  /** 框起來做循環練習的段落（例如「第 45-52 小節的換弦」） */
  sections?: ScoreSection[];
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
  /**
   * 這次練的是哪一首（可留空）。
   * 沒有這個欄位時答不出「我這個月在這首曲子花了多少時間」——
   * 練習紀錄與樂譜之間原本完全沒有關聯。
   */
  scoreId?: string;
}

export interface Recording {
  id: string;
  scoreId: string;
  timestamp: number;
  type: 'video' | 'audio';
  blob: Blob;
  durationSeconds?: number;
  /**
   * 開始錄影的時刻（Date.now()）。
   * intonationData 的 time 存的是絕對時間戳，要把音準曲線對齊到影片的播放
   * 位置就需要這個基準點。舊的錄影沒有這個欄位，讀取時會退而用第一筆取樣的
   * 時間，此時若開頭有靜音，時間軸會整段偏移。
   */
  startedAt?: number;
  intonationData?: { time: number; pitch: number; cents: number }[];
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

export interface PracticeGoal {
  id: string;
  title: string;
  type: 'time' | 'sessions' | 'score';
  target: number;
  current: number;
  period: 'daily' | 'weekly';
}

const SCORES_KEY = 'viola-scores-idb';
const FOLDERS_KEY = 'viola-folders-idb';
const HISTORY_KEY = 'viola-practice-history';
const RECORDINGS_KEY = 'viola-recordings-idb';
const ROUTINES_KEY = 'viola-routines-idb';
const REWARDS_KEY = 'viola-rewards-idb';
const GOALS_KEY = 'viola-goals-idb';

// --- 儲存失敗的處理 ---
//
// 原本所有讀寫失敗都只有 console.error。對一個「累積練習紀錄」的 App 來說，
// 這是會掉資料的：寫入失敗時使用者以為存好了，其實沒有；而配額用盡
// （平板裝滿樂譜照片與錄影時很實際）正是最可能發生的情況。

/** 讓 UI 顯示儲存問題用的事件名稱 */
export const STORAGE_ERROR_EVENT = 'storage-error';

export interface StorageErrorDetail {
  message: string;
  /** 'write' 代表資料沒存進去；'read' 代表畫面上看到的可能不完整 */
  kind: 'read' | 'write';
}

/**
 * 判斷是不是配額用盡。
 *
 * 瀏覽器之間不一致：有的丟 DOMException 名稱 QuotaExceededError，
 * Firefox 舊版用 NS_ERROR_DOM_QUOTA_REACHED，所以兩種都認。
 */
function isQuotaExceeded(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name ?? '';
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

function emitStorageError(detail: StorageErrorDetail) {
  // 測試環境（node）沒有 window，不要因此整個失敗
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail }));
}

/** 寫入失敗：一定要讓使用者知道這次的變更沒有保留下來 */
function reportWriteFailure(what: string, error: unknown) {
  console.error(`Failed to save ${what}:`, error);
  emitStorageError({
    kind: 'write',
    message: isQuotaExceeded(error)
      ? `裝置儲存空間不足，${what}沒有存起來。請刪掉一些樂譜或錄影後再試一次。`
      : `${what}儲存失敗，這次的變更沒有保留下來。`,
  });
}

/** 讀取失敗：畫面會顯示成空的，必須說清楚那不代表資料不見了 */
function reportReadFailure(what: string, error: unknown) {
  console.error(`Failed to read ${what}:`, error);
  emitStorageError({
    kind: 'read',
    message: `讀取${what}失敗，畫面上看到的可能不完整。請重新整理頁面，先不要覆蓋或刪除資料。`,
  });
}

/**
 * 讀取；失敗時往外丟，不回傳預設值。
 *
 * 給「讀出來改一改再寫回去」的路徑用。這類路徑若把讀取失敗當成「資料是空的」，
 * 接著寫回去就會把既有資料整個覆蓋掉——這正是先前
 * `addPracticeSession`（會清空整部練習史）與 `processPracticeReward`
 * （會把集點卡歸零）的真實行為。
 */
async function readOrThrow<T>(key: string): Promise<T | undefined> {
  return await get<T>(key);
}

// --- Folders ---

export async function getFolders(): Promise<Folder[]> {
  try {
    const folders = await get<Folder[]>(FOLDERS_KEY);
    return folders || [];
  } catch (error) {
    reportReadFailure('資料夾', error);
    return [];
  }
}

export async function saveFolders(folders: Folder[]): Promise<void> {
  try {
    await set(FOLDERS_KEY, folders);
  } catch (error) {
    reportWriteFailure('資料夾', error);
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
    reportReadFailure('樂譜', error);
    return [];
  }
}

export async function saveScores(scores: Score[]): Promise<void> {
  try {
    await set(SCORES_KEY, scores);
    window.dispatchEvent(new CustomEvent('scores-updated'));
  } catch (error) {
    reportWriteFailure('樂譜', error);
    // 仍然往外丟：呼叫端可能需要回復畫面狀態。廣播只保證使用者一定看得到。
    throw new Error('儲存失敗：設備空間可能不足。', { cause: error });
  }
}

// --- Practice History ---

export async function getPracticeHistory(): Promise<PracticeSession[]> {
  try {
    const history = await get<PracticeSession[]>(HISTORY_KEY);
    return history || [];
  } catch (error) {
    reportReadFailure('練習紀錄', error);
    return [];
  }
}

export async function saveHistory(history: PracticeSession[]): Promise<void> {
  try {
    await set(HISTORY_KEY, history);
  } catch (error) {
    reportWriteFailure('練習紀錄', error);
  }
}

export async function addPracticeSession(
  durationSeconds: number,
  note?: string,
  scoreId?: string
): Promise<PracticeSession[]> {
  if (durationSeconds <= 0) return getPracticeHistory();

  try {
    // 刻意不用 getPracticeHistory()：它在讀取失敗時會回傳空陣列，
    // 接著下面寫入 [...history, newSession] 就會把整部練習史覆蓋成只剩這一筆。
    const history = (await readOrThrow<PracticeSession[]>(HISTORY_KEY)) ?? [];
    const today = new Date();
    // Local YYYY-MM-DD string
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const newSession: PracticeSession = {
      // 這個 id 會被當成 React key 使用，統一改用 crypto.randomUUID()
      // （原本的 7 碼亂數有碰撞機率，碰撞時清單會出現重複 key）
      id: crypto.randomUUID(),
      date: dateStr,
      durationSeconds,
      timestamp: Date.now(),
      note,
      // 空字串代表使用者刻意清除了歸屬，不要存成空字串
      scoreId: scoreId || undefined
    };
    
    const updatedHistory = [...history, newSession];
    await set(HISTORY_KEY, updatedHistory);
    
    // Dispatch a custom event so other components can update
    window.dispatchEvent(new CustomEvent('practice-history-updated'));
    
    return updatedHistory;
  } catch (error) {
    // 讀取或寫入任一步失敗，都不要嘗試補寫 —— 寧可這次沒記錄到，
    // 也不要把既有的練習史覆蓋掉。
    reportWriteFailure('練習紀錄', error);
    return [];
  }
}

/**
 * 依曲目彙總練習總時數（秒）。
 *
 * 未指定曲目的紀錄不計入任何一首 —— 它們仍然算在總練習時間裡，
 * 只是無法歸到特定曲目。
 */
export async function getPracticeTotalsByScore(): Promise<Record<string, number>> {
  const history = await getPracticeHistory();
  const totals: Record<string, number> = {};
  for (const session of history) {
    if (!session.scoreId) continue;
    if (!Number.isFinite(session.durationSeconds) || session.durationSeconds <= 0) continue;
    totals[session.scoreId] = (totals[session.scoreId] ?? 0) + session.durationSeconds;
  }
  return totals;
}

/** 單一曲目的累計練習秒數 */
export async function getPracticeTotalForScore(scoreId: string): Promise<number> {
  const totals = await getPracticeTotalsByScore();
  return totals[scoreId] ?? 0;
}

// --- Recordings ---

/**
 * 尚未指定曲目的錄影所使用的 scoreId。
 *
 * 從「樂譜與紀錄」分頁直接錄影時並沒有對應的樂譜（例如只是想拉音階看音準），
 * 這類錄影會標成這個值。之後可以用 assignRecordingToScore() 補指定。
 */
export const UNASSIGNED_SCORE_ID = 'unknown';

export function isUnassigned(recording: Recording): boolean {
  return !recording.scoreId || recording.scoreId === UNASSIGNED_SCORE_ID;
}

/** 依時間新到舊排序的全部錄影 */
export async function getAllRecordings(): Promise<Recording[]> {
  try {
    const recordings = await get<Recording[]>(RECORDINGS_KEY);
    return (recordings || []).slice().sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    reportReadFailure('錄影清單', error);
    return [];
  }
}

export async function getRecordingsByScoreId(scoreId: string): Promise<Recording[]> {
  try {
    const recordings = await get<Recording[]>(RECORDINGS_KEY);
    if (!recordings) return [];
    return recordings.filter(r => r.scoreId === scoreId).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    reportReadFailure('錄影清單', error);
    return [];
  }
}

export async function saveRecording(recording: Recording): Promise<void> {
  try {
    const recordings = await get<Recording[]>(RECORDINGS_KEY) || [];
    await set(RECORDINGS_KEY, [...recordings, recording]);
  } catch (error) {
    reportWriteFailure('錄影', error);
    throw new Error('儲存錄音/錄影失敗：設備空間可能不足。', { cause: error });
  }
}

/**
 * 把錄影指定給某一份樂譜（或改回未指定）。
 *
 * 讓使用者可以先自由錄，事後再歸類 —— 練音階時通常不會先去開一份譜。
 */
export async function assignRecordingToScore(
  recordingId: string,
  scoreId: string | null
): Promise<void> {
  try {
    const recordings = (await get<Recording[]>(RECORDINGS_KEY)) || [];
    const updated = recordings.map((r) =>
      r.id === recordingId ? { ...r, scoreId: scoreId ?? UNASSIGNED_SCORE_ID } : r
    );
    await set(RECORDINGS_KEY, updated);
  } catch (error) {
    reportWriteFailure('錄影的歸屬曲目', error);
    throw new Error('指定曲目失敗，請重試。', { cause: error });
  }
}

export async function deleteRecording(id: string): Promise<void> {
  try {
    const recordings = await get<Recording[]>(RECORDINGS_KEY) || [];
    await set(RECORDINGS_KEY, recordings.filter(r => r.id !== id));
  } catch (error) {
    reportWriteFailure('錄影清單', error);
  }
}

// --- Routines ---

export async function getRoutines(): Promise<PracticeRoutine[]> {
  try {
    const routines = await get<PracticeRoutine[]>(ROUTINES_KEY);
    return routines || [];
  } catch (error) {
    reportReadFailure('練習計畫', error);
    return [];
  }
}

export async function saveRoutines(routines: PracticeRoutine[]): Promise<void> {
  try {
    await set(ROUTINES_KEY, routines);
  } catch (error) {
    reportWriteFailure('練習計畫', error);
  }
}

// --- Rewards ---

export async function getRewards(): Promise<RewardsState> {
  try {
    const state = await get<RewardsState>(REWARDS_KEY);
    return state || { currentNotes: 0, totalNotes: 0, pieces: [], concertmasterUnlocked: false, unrewardedSeconds: 0 };
  } catch (error) {
    reportReadFailure('集點卡', error);
    return { currentNotes: 0, totalNotes: 0, pieces: [], concertmasterUnlocked: false, unrewardedSeconds: 0 };
  }
}

export async function saveRewards(state: RewardsState): Promise<void> {
  try {
    await set(REWARDS_KEY, state);
  } catch (error) {
    reportWriteFailure('集點卡', error);
  }
}

export async function processPracticeReward(seconds: number): Promise<RewardResult> {
  try {
    // 同樣不能用 getRewards()：它讀取失敗時會回傳「全新的集點卡」，
    // 接著寫回去就把使用者累積的音符、拼圖與徽章全部歸零。
    const state = (await readOrThrow<RewardsState>(REWARDS_KEY)) ?? {
      currentNotes: 0,
      totalNotes: 0,
      pieces: [],
      concertmasterUnlocked: false,
      unrewardedSeconds: 0,
    };
    
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

    const newNotes = state.currentNotes + earnedNotes;
    const piecesToAward = Math.floor(newNotes / 10);
    
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
    reportWriteFailure('集點卡', error);
    return { earnedNotes: 0, earnedPieces: [], unlockedConcertmaster: false };
  }
}

// --- Goals ---

export async function getGoals(): Promise<PracticeGoal[]> {
  try {
    const goals = await get<PracticeGoal[]>(GOALS_KEY);
    return goals || [];
  } catch {
    return [];
  }
}

export async function saveGoals(goals: PracticeGoal[]): Promise<void> {
  await set(GOALS_KEY, goals);
}

// --- Tempo History ---

export async function updateTempoHistory(scoreId: string, bpm: number): Promise<void> {
  const scores = await getScores();
  const score = scores.find(s => s.id === scoreId);
  if (!score) return;

  const history = score.tempoHistory || [];
  const today = new Date().setHours(0, 0, 0, 0);
  
  // Only keep the highest BPM per day
  const existingIndex = history.findIndex(h => new Date(h.date).setHours(0, 0, 0, 0) === today);
  
  if (existingIndex >= 0) {
    if (bpm > history[existingIndex].bpm) {
      history[existingIndex].bpm = bpm;
    } else {
      return; // No improvement today
    }
  } else {
    history.push({ bpm, date: Date.now() });
  }

  // Keep last 30 entries
  const updatedHistory = history.sort((a, b) => a.date - b.date).slice(-30);
  
  const newScores = scores.map(s => s.id === scoreId ? { ...s, tempoHistory: updatedHistory } : s);
  await saveScores(newScores);
}

/**
 * 覆寫某份樂譜的段落清單。
 *
 * 讀回最新的樂譜再寫，不要拿畫面上那份舊的整包蓋回去 ——
 * 否則同時在別處改到的標註或旋轉會被無聲地還原。
 */
export async function updateScoreSections(
  scoreId: string,
  sections: ScoreSection[]
): Promise<void> {
  const scores = await getScores();
  if (!scores.some(s => s.id === scoreId)) return;
  await saveScores(scores.map(s => (s.id === scoreId ? { ...s, sections } : s)));
}
