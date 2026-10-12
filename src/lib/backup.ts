import type {
  Score,
  Folder,
  PracticeSession,
  PracticeRoutine,
  RewardsState,
  PracticeGoal,
} from './storage';

/**
 * 備份檔的格式。
 *
 * 原本的備份只有 `JSON.stringify(scores)` —— 使用說明卻寫著「匯入備份即可
 * 還原所有內容」。換裝置的人會丟掉全部練習紀錄、集點卡進度、練習計畫與
 * 練習目標，資料夾消失還會讓樂譜失去分類。對一個核心價值就是「累積紀錄」
 * 的 App，這是最不能發生的事。
 *
 * **錄影刻意不含在備份裡**：影片是 Blob，一段幾分鐘的練習錄影就可能上百 MB，
 * 轉成 base64 塞進 JSON 會做出一個大到打不開、也分享不出去的檔案。
 * 要保存錄影請在錄影面板用「下載」個別存檔。
 */
export const BACKUP_FORMAT = 'violinassistant-backup';
export const BACKUP_VERSION = 1;

export interface BackupPayload {
  scores: Score[];
  folders: Folder[];
  practiceHistory: PracticeSession[];
  routines: PracticeRoutine[];
  rewards: RewardsState | null;
  goals: PracticeGoal[];
}

export interface BackupFile extends BackupPayload {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
}

export function createBackup(payload: BackupPayload, now = Date.now()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    ...payload,
  };
}

function isScore(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const s = item as Partial<Score>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    (typeof s.data === 'string' || Array.isArray(s.data))
  );
}

function asArray<T>(value: unknown, guard?: (item: unknown) => boolean): T[] {
  if (!Array.isArray(value)) return [];
  return (guard ? value.filter(guard) : value) as T[];
}

export type ParseResult =
  | { ok: true; backup: BackupFile; legacy: boolean }
  | { ok: false; reason: string };

/**
 * 解析備份檔。
 *
 * 必須同時吃得下舊格式（整個檔案就是一個 scores 陣列）—— 使用者手上可能
 * 還留著舊版匯出的備份，不能因為換了格式就讀不回來。
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: '這不是一個有效的 JSON 檔案。' };
  }

  // 舊格式：整個檔案就是樂譜陣列
  if (Array.isArray(raw)) {
    if (raw.length > 0 && !raw.every(isScore)) {
      return { ok: false, reason: '檔案內容看起來不是本 App 的備份。' };
    }
    return {
      ok: true,
      legacy: true,
      backup: createBackup({
        scores: raw as Score[],
        folders: [],
        practiceHistory: [],
        routines: [],
        rewards: null,
        goals: [],
      }),
    };
  }

  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: '檔案內容看起來不是本 App 的備份。' };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) {
    return { ok: false, reason: '檔案內容看起來不是本 App 的備份。' };
  }
  if (typeof obj.version === 'number' && obj.version > BACKUP_VERSION) {
    return {
      ok: false,
      reason: '這個備份檔來自更新版本的 App，請先更新後再匯入。',
    };
  }
  if (!Array.isArray(obj.scores)) {
    return { ok: false, reason: '備份檔缺少樂譜資料。' };
  }

  return {
    ok: true,
    legacy: false,
    backup: {
      format: BACKUP_FORMAT,
      version: typeof obj.version === 'number' ? obj.version : BACKUP_VERSION,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : 0,
      scores: asArray<Score>(obj.scores, isScore),
      folders: asArray<Folder>(obj.folders),
      practiceHistory: asArray<PracticeSession>(obj.practiceHistory),
      routines: asArray<PracticeRoutine>(obj.routines),
      rewards: (obj.rewards ?? null) as RewardsState | null,
      goals: asArray<PracticeGoal>(obj.goals),
    },
  };
}

/**
 * 匯入前給使用者看的摘要。
 *
 * 匯入會「完全取代」現有資料，所以必須講清楚即將換掉哪些東西 ——
 * 只說「確定要匯入嗎」等於沒有提供判斷依據。
 */
export function describeBackup(backup: BackupFile): string {
  const parts = [`${backup.scores.length} 份樂譜`];
  if (backup.folders.length) parts.push(`${backup.folders.length} 個資料夾`);
  if (backup.practiceHistory.length) parts.push(`${backup.practiceHistory.length} 筆練習紀錄`);
  if (backup.routines.length) parts.push(`${backup.routines.length} 個練習計畫`);
  if (backup.goals.length) parts.push(`${backup.goals.length} 個練習目標`);
  if (backup.rewards) parts.push('集點卡進度');
  return parts.join('、');
}

/** 備份檔名，含日期方便辨識 */
export function backupFileName(now = new Date()): string {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  return `violinassistant-backup-${date}.json`;
}
