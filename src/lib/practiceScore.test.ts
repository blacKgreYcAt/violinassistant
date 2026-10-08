// 必須在匯入 storage 之前載入，才能把 indexedDB 這個全域塞進測試環境
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clear } from 'idb-keyval';
import {
  addPracticeSession,
  getPracticeHistory,
  getPracticeTotalsByScore,
  getPracticeTotalForScore,
} from './storage';
import { formatPracticeTotal } from './practiceTimer';

beforeEach(async () => {
  await clear();
  if (typeof globalThis.window === 'undefined') {
    (globalThis as unknown as { window: unknown }).window = {
      dispatchEvent: vi.fn(),
      CustomEvent: class {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }
  if (typeof globalThis.CustomEvent === 'undefined') {
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
      constructor(public type: string) {}
    };
  }
});

describe('練習紀錄的曲目歸屬', () => {
  it('記錄練習時可以帶上曲目', async () => {
    await addPracticeSession(600, undefined, 'score-a');
    const history = await getPracticeHistory();
    expect(history[0].scoreId).toBe('score-a');
  });

  it('沒有指定曲目時不會留下空字串', async () => {
    // 空字串代表使用者把選擇清掉了，不應該變成一個查不到的假 id
    await addPracticeSession(600, undefined, '');
    const history = await getPracticeHistory();
    expect(history[0].scoreId).toBeUndefined();
  });

  it('筆記與曲目可以同時記錄', async () => {
    await addPracticeSession(600, '第 45 小節換弦', 'score-a');
    const history = await getPracticeHistory();
    expect(history[0].note).toBe('第 45 小節換弦');
    expect(history[0].scoreId).toBe('score-a');
  });

  it('依曲目累加練習時間', async () => {
    await addPracticeSession(600, undefined, 'score-a');
    await addPracticeSession(900, undefined, 'score-a');
    await addPracticeSession(300, undefined, 'score-b');

    const totals = await getPracticeTotalsByScore();
    expect(totals['score-a']).toBe(1500);
    expect(totals['score-b']).toBe(300);
  });

  it('未指定曲目的紀錄不會被歸到任何一首', async () => {
    await addPracticeSession(600, undefined, 'score-a');
    await addPracticeSession(1200); // 未指定

    const totals = await getPracticeTotalsByScore();
    expect(totals['score-a']).toBe(600);
    // 這是整個功能的重點：不能把未歸屬的時間誤算到某一首上
    expect(Object.keys(totals)).toEqual(['score-a']);
  });

  it('查詢沒有紀錄的曲目回傳 0 而不是 undefined', async () => {
    // 回傳 undefined 會讓畫面顯示 NaN
    await expect(getPracticeTotalForScore('never-practised')).resolves.toBe(0);
  });

  it('單首查詢與彙總結果一致', async () => {
    await addPracticeSession(600, undefined, 'score-a');
    await addPracticeSession(900, undefined, 'score-a');
    await expect(getPracticeTotalForScore('score-a')).resolves.toBe(1500);
  });

  it('沒有任何紀錄時彙總回傳空物件', async () => {
    await expect(getPracticeTotalsByScore()).resolves.toEqual({});
  });
});

describe('formatPracticeTotal', () => {
  it('完全沒練過時說「尚未記錄」而不是 0 分鐘', () => {
    expect(formatPracticeTotal(0)).toBe('尚未記錄');
  });

  it('不足一分鐘不顯示 0 分鐘', () => {
    expect(formatPracticeTotal(30)).toBe('不到 1 分鐘');
  });

  it('一小時以內只顯示分鐘', () => {
    expect(formatPracticeTotal(45 * 60)).toBe('45 分鐘');
  });

  it('整小時不顯示 0 分', () => {
    expect(formatPracticeTotal(2 * 3600)).toBe('2 小時');
  });

  it('時分並存', () => {
    expect(formatPracticeTotal(2 * 3600 + 15 * 60)).toBe('2 小時 15 分');
  });

  it('秒數被捨去而不是四捨五入到多算一分鐘', () => {
    expect(formatPracticeTotal(59 + 60)).toBe('1 分鐘');
  });

  it('異常值不會顯示 NaN', () => {
    expect(formatPracticeTotal(NaN)).toBe('尚未記錄');
    expect(formatPracticeTotal(-100)).toBe('尚未記錄');
    expect(formatPracticeTotal(Infinity)).toBe('尚未記錄');
  });
});
