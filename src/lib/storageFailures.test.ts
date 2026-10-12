import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * 儲存失敗時的行為。
 *
 * 這一組測的是最糟的那種失敗：**默默掉資料**。
 * 原本 `addPracticeSession` 會先呼叫 `getPracticeHistory()`，而後者在讀取
 * 失敗時回傳空陣列；接著寫入 `[...history, newSession]`，等於把整部練習史
 * 覆蓋成只剩剛剛那一筆。`processPracticeReward` 同理，會把集點卡歸零。
 *
 * 用 mock 取代 idb-keyval 才能注入失敗；fake-indexeddb 不會自己壞掉。
 */

const get = vi.fn();
const set = vi.fn();
const clear = vi.fn();

vi.mock('idb-keyval', () => ({
  get: (...args: unknown[]) => get(...args),
  set: (...args: unknown[]) => set(...args),
  clear: (...args: unknown[]) => clear(...args),
}));

const HISTORY_KEY = 'viola-practice-history';
const REWARDS_KEY = 'viola-rewards-idb';

let events: { message: string; kind: string }[];

beforeEach(async () => {
  vi.clearAllMocks();
  events = [];
  if (typeof globalThis.window === 'undefined') {
    (globalThis as unknown as { window: unknown }).window = {};
  }
  // 攔下廣播出來的儲存錯誤
  (globalThis.window as unknown as Record<string, unknown>).dispatchEvent = (e: unknown) => {
    const ev = e as { type?: string; detail?: { message: string; kind: string } };
    if (ev.detail) events.push(ev.detail);
    return true;
  };
  if (typeof globalThis.CustomEvent === 'undefined') {
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
      detail: unknown;
      constructor(public type: string, init?: { detail?: unknown }) {
        this.detail = init?.detail;
      }
    };
  }
});

afterEach(() => {
  vi.resetModules();
});

/** 製造一個配額用盡的錯誤（瀏覽器實際會丟的形狀） */
function quotaError() {
  const err = new Error('The quota has been exceeded.');
  err.name = 'QuotaExceededError';
  return err;
}

describe('addPracticeSession — 讀取失敗不得覆蓋既有紀錄', () => {
  it('讀取失敗時完全不寫入', async () => {
    get.mockRejectedValue(new Error('IndexedDB unavailable'));
    const { addPracticeSession } = await import('./storage');

    const result = await addPracticeSession(1800);

    // 關鍵斷言：一次 set 都不能發生。
    // 寫了就等於把整部練習史換成只有這一筆。
    expect(set).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('讀取失敗時會告訴使用者', async () => {
    get.mockRejectedValue(new Error('IndexedDB unavailable'));
    const { addPracticeSession } = await import('./storage');

    await addPracticeSession(1800);

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('write');
    expect(events[0].message).toContain('練習紀錄');
  });

  it('讀取成功時照常把新紀錄接在既有紀錄後面', async () => {
    const existing = [
      { id: 'old', date: '2026-10-01', durationSeconds: 600, timestamp: 1 },
    ];
    get.mockResolvedValue(existing);
    set.mockResolvedValue(undefined);
    const { addPracticeSession } = await import('./storage');

    const result = await addPracticeSession(1800);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('old');
    const written = set.mock.calls.find((c) => c[0] === HISTORY_KEY)?.[1];
    expect(written).toHaveLength(2);
    expect(events).toHaveLength(0);
  });

  it('寫入失敗時回報，而且訊息要講明空間不足', async () => {
    get.mockResolvedValue([]);
    set.mockRejectedValue(quotaError());
    const { addPracticeSession } = await import('./storage');

    await addPracticeSession(1800);

    expect(events).toHaveLength(1);
    expect(events[0].message).toContain('空間不足');
    // 要給出可行的下一步，不能只說「失敗」
    expect(events[0].message).toMatch(/刪掉|再試/);
  });
});

describe('processPracticeReward — 讀取失敗不得把集點卡歸零', () => {
  it('讀取失敗時完全不寫入', async () => {
    get.mockRejectedValue(new Error('IndexedDB unavailable'));
    const { processPracticeReward } = await import('./storage');

    const result = await processPracticeReward(1800);

    // 寫了就等於把使用者累積的音符、拼圖與徽章全部清掉
    expect(set).not.toHaveBeenCalled();
    expect(result).toEqual({ earnedNotes: 0, earnedPieces: [], unlockedConcertmaster: false });
    expect(events[0].message).toContain('集點卡');
  });

  it('讀取成功時以既有狀態為基礎累加', async () => {
    get.mockResolvedValue({
      currentNotes: 5,
      totalNotes: 25,
      pieces: ['bow-1'],
      concertmasterUnlocked: false,
      unrewardedSeconds: 0,
    });
    set.mockResolvedValue(undefined);
    const { processPracticeReward } = await import('./storage');

    const result = await processPracticeReward(1800);

    expect(result.earnedNotes).toBe(1);
    const written = set.mock.calls.find((c) => c[0] === REWARDS_KEY)?.[1] as {
      currentNotes: number;
      totalNotes: number;
      pieces: string[];
    };
    // 既有的 5 個音符與 1 片拼圖都還在
    expect(written.currentNotes).toBe(6);
    expect(written.totalNotes).toBe(26);
    expect(written.pieces).toContain('bow-1');
  });
});

describe('讀取失敗的通報', () => {
  it('讀樂譜失敗時回傳空陣列，但要明確提醒不要覆蓋資料', async () => {
    get.mockRejectedValue(new Error('IndexedDB unavailable'));
    const { getScores } = await import('./storage');

    await expect(getScores()).resolves.toEqual([]);

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('read');
    // 畫面會看起來像資料不見了，必須說清楚那不代表真的不見
    expect(events[0].message).toMatch(/不要覆蓋|重新整理/);
  });

  it('讀練習計畫失敗也會通報', async () => {
    get.mockRejectedValue(new Error('boom'));
    const { getRoutines } = await import('./storage');

    await expect(getRoutines()).resolves.toEqual([]);
    expect(events[0].message).toContain('練習計畫');
  });
});

describe('寫入失敗的通報', () => {
  it('儲存練習計畫失敗會通報', async () => {
    set.mockRejectedValue(new Error('boom'));
    const { saveRoutines } = await import('./storage');

    await saveRoutines([]);
    expect(events[0].kind).toBe('write');
    expect(events[0].message).toContain('練習計畫');
  });

  it('指定錄影曲目失敗時，既會通報也會往外丟', async () => {
    get.mockResolvedValue([{ id: 'r1', scoreId: 'unknown', timestamp: 1, type: 'video' }]);
    set.mockRejectedValue(new Error('boom'));
    const { assignRecordingToScore } = await import('./storage');

    // 呼叫端若忘了 catch（RecordingLibrary 原本就沒有），
    // 廣播仍保證使用者看得到
    await expect(assignRecordingToScore('r1', 'score-1')).rejects.toThrow();
    expect(events[0].kind).toBe('write');
  });

  it('非配額錯誤不要謊稱空間不足', async () => {
    set.mockRejectedValue(new Error('something else'));
    const { saveRewards } = await import('./storage');

    await saveRewards({
      currentNotes: 0,
      totalNotes: 0,
      pieces: [],
      concertmasterUnlocked: false,
      unrewardedSeconds: 0,
    });
    expect(events[0].message).not.toContain('空間不足');
  });
});
