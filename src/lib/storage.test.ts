// 必須在匯入 storage 之前載入，才能把 indexedDB 這個全域塞進測試環境
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clear } from 'idb-keyval';
import {
  processPracticeReward,
  getRewards,
  saveRewards,
  addPracticeSession,
  getPracticeHistory,
  updateTempoHistory,
  getAllRecordings,
  saveRecording,
  assignRecordingToScore,
  isUnassigned,
  UNASSIGNED_SCORE_ID,
  getScores,
  saveScores,
  Score,
} from './storage';

const THIRTY_MIN = 1800;

beforeEach(async () => {
  await clear();
  // 元件靠 window 事件同步，node 環境沒有 window 就補一個最小替身
  if (typeof globalThis.window === 'undefined') {
    (globalThis as unknown as { window: unknown }).window = {
      dispatchEvent: vi.fn(),
      CustomEvent: class {},
    };
  }
  if (typeof globalThis.CustomEvent === 'undefined') {
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
      constructor(public type: string) {}
    };
  }
});

describe('processPracticeReward — 集點卡規則', () => {
  it('每練滿 30 分鐘得到 1 個音符', async () => {
    const result = await processPracticeReward(THIRTY_MIN);
    expect(result.earnedNotes).toBe(1);
  });

  it('不滿 30 分鐘不給音符，但會把時間累積起來', async () => {
    const first = await processPracticeReward(THIRTY_MIN - 60);
    expect(first.earnedNotes).toBe(0);

    // 再練 60 秒就湊滿 30 分鐘
    const second = await processPracticeReward(60);
    expect(second.earnedNotes).toBe(1);
  });

  it('一次練很久會一次給多個音符', async () => {
    const result = await processPracticeReward(THIRTY_MIN * 3);
    expect(result.earnedNotes).toBe(3);
  });

  it('累積滿 10 個音符時獲得 1 片拼圖，音符歸零重算', async () => {
    const result = await processPracticeReward(THIRTY_MIN * 10);
    expect(result.earnedNotes).toBe(10);
    expect(result.earnedPieces).toHaveLength(1);

    const state = await getRewards();
    expect(state.currentNotes).toBe(0);
    expect(state.totalNotes).toBe(10);
  });

  it('totalNotes 會持續累加，不會被歸零', async () => {
    await processPracticeReward(THIRTY_MIN * 10);
    await processPracticeReward(THIRTY_MIN * 5);
    const state = await getRewards();
    expect(state.totalNotes).toBe(15);
  });

  it('拼圖不會重複發放（36 片發完就停）', async () => {
    // 36 片 = 360 個音符 = 180 小時
    await processPracticeReward(THIRTY_MIN * 400);
    const state = await getRewards();
    expect(state.pieces.length).toBe(36);
    expect(new Set(state.pieces).size).toBe(36); // 無重複
  });

  it('集滿 36 片解鎖「首席演奏家」徽章', async () => {
    const result = await processPracticeReward(THIRTY_MIN * 360);
    expect(result.unlockedConcertmaster).toBe(true);

    const state = await getRewards();
    expect(state.concertmasterUnlocked).toBe(true);
  });

  it('徽章只會解鎖一次，之後練習不會再回報解鎖', async () => {
    await processPracticeReward(THIRTY_MIN * 360);
    const again = await processPracticeReward(THIRTY_MIN * 10);
    expect(again.unlockedConcertmaster).toBe(false);
  });

  it('未滿一個音符的秒數會保留為餘數，不會被丟掉', async () => {
    await processPracticeReward(THIRTY_MIN + 600); // 多出 10 分鐘
    const state = await getRewards();
    expect(state.unrewardedSeconds).toBe(600);
  });

  it('從既有進度繼續累積時行為正確', async () => {
    await saveRewards({
      currentNotes: 9,
      totalNotes: 9,
      pieces: [],
      concertmasterUnlocked: false,
      unrewardedSeconds: 0,
    });
    const result = await processPracticeReward(THIRTY_MIN);
    expect(result.earnedNotes).toBe(1);
    expect(result.earnedPieces).toHaveLength(1); // 第 10 個音符湊滿一片拼圖
  });
});

describe('addPracticeSession — 練習紀錄', () => {
  it('會新增一筆紀錄', async () => {
    await addPracticeSession(600, '今天練音階');
    const history = await getPracticeHistory();
    expect(history).toHaveLength(1);
    expect(history[0].durationSeconds).toBe(600);
    expect(history[0].note).toBe('今天練音階');
  });

  it('時長為 0 或負數時不會寫入', async () => {
    await addPracticeSession(0);
    await addPracticeSession(-100);
    expect(await getPracticeHistory()).toHaveLength(0);
  });

  it('日期使用本地時區的 YYYY-MM-DD（不是 UTC，否則跨時區會記到前一天）', async () => {
    await addPracticeSession(600);
    const [session] = await getPracticeHistory();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(session.date).toBe(expected);
  });

  it('多筆紀錄會累積而不是覆蓋', async () => {
    await addPracticeSession(600);
    await addPracticeSession(300);
    expect(await getPracticeHistory()).toHaveLength(2);
  });

  it('每筆紀錄的 id 不重複（會被當成 React key）', async () => {
    for (let i = 0; i < 20; i++) await addPracticeSession(60);
    const history = await getPracticeHistory();
    expect(new Set(history.map(h => h.id)).size).toBe(history.length);
  });
});

describe('updateTempoHistory — 速度紀錄', () => {
  const makeScore = (id: string): Score => ({
    id,
    name: '測試曲目',
    type: 'file',
    data: 'data:image/png;base64,xxx',
    date: Date.now(),
  });

  it('會記錄該曲目的練習速度', async () => {
    await saveScores([makeScore('s1')]);
    await updateTempoHistory('s1', 100);

    const [score] = await getScores();
    expect(score.tempoHistory).toHaveLength(1);
    expect(score.tempoHistory![0].bpm).toBe(100);
  });

  it('同一天只保留最高速度', async () => {
    await saveScores([makeScore('s1')]);
    await updateTempoHistory('s1', 100);
    await updateTempoHistory('s1', 120);
    await updateTempoHistory('s1', 110); // 比較慢，不應覆蓋

    const [score] = await getScores();
    expect(score.tempoHistory).toHaveLength(1);
    expect(score.tempoHistory![0].bpm).toBe(120);
  });

  it('找不到對應曲目時不會爆掉', async () => {
    await saveScores([makeScore('s1')]);
    await expect(updateTempoHistory('不存在的id', 100)).resolves.not.toThrow();
  });

  it('只保留最近 30 筆', async () => {
    const score = makeScore('s1');
    // 塞 40 天份的歷史資料
    score.tempoHistory = Array.from({ length: 40 }, (_, i) => ({
      bpm: 60 + i,
      date: Date.now() - (40 - i) * 24 * 60 * 60 * 1000,
    }));
    await saveScores([score]);

    await updateTempoHistory('s1', 200);

    const [updated] = await getScores();
    expect(updated.tempoHistory!.length).toBeLessThanOrEqual(30);
    // 最新那筆應該被保留
    expect(updated.tempoHistory![updated.tempoHistory!.length - 1].bpm).toBe(200);
  });

  it('不會影響其他曲目的資料', async () => {
    await saveScores([makeScore('s1'), makeScore('s2')]);
    await updateTempoHistory('s1', 100);

    const scores = await getScores();
    const s2 = scores.find(s => s.id === 's2')!;
    expect(s2.tempoHistory).toBeUndefined();
  });
});


describe('錄影的歸屬曲目', () => {
  const makeRecording = (id: string, scoreId: string, timestamp: number) => ({
    id,
    scoreId,
    timestamp,
    type: 'audio' as const,
    blob: new Blob(['x']),
  });

  it('未指定曲目的錄影會被判定為 unassigned', () => {
    expect(isUnassigned(makeRecording('a', UNASSIGNED_SCORE_ID, 1))).toBe(true);
    expect(isUnassigned(makeRecording('b', 's1', 1))).toBe(false);
  });

  it('getAllRecordings 會依時間新到舊排序', async () => {
    await saveRecording(makeRecording('old', 's1', 1000));
    await saveRecording(makeRecording('new', 's1', 3000));
    await saveRecording(makeRecording('mid', 's1', 2000));

    const all = await getAllRecordings();
    expect(all.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('可以把未指定的錄影事後指定給某份樂譜', async () => {
    await saveRecording(makeRecording('r1', UNASSIGNED_SCORE_ID, 1000));
    await assignRecordingToScore('r1', 'score-123');

    const [r] = await getAllRecordings();
    expect(r.scoreId).toBe('score-123');
    expect(isUnassigned(r)).toBe(false);
  });

  it('可以把已指定的錄影改回未指定', async () => {
    await saveRecording(makeRecording('r1', 'score-123', 1000));
    await assignRecordingToScore('r1', null);

    const [r] = await getAllRecordings();
    expect(isUnassigned(r)).toBe(true);
  });

  it('指定歸屬時不會動到其他錄影', async () => {
    await saveRecording(makeRecording('r1', UNASSIGNED_SCORE_ID, 1000));
    await saveRecording(makeRecording('r2', 'other', 2000));

    await assignRecordingToScore('r1', 'score-123');

    const all = await getAllRecordings();
    expect(all.find((r) => r.id === 'r2')!.scoreId).toBe('other');
  });

  it('指定一個不存在的錄影 id 不會爆掉也不會新增資料', async () => {
    await saveRecording(makeRecording('r1', 's1', 1000));
    await expect(assignRecordingToScore('不存在', 's2')).resolves.not.toThrow();
    expect(await getAllRecordings()).toHaveLength(1);
  });
});
