import { describe, it, expect } from 'vitest';
import { computeTimerTick, getStepDuration } from './practiceTimer';

const T0 = 1_700_000_000_000; // 固定基準時間，確保測試可重現

describe('computeTimerTick', () => {
  it('經過 10 秒後，剩餘減少 10、已練習增加 10', () => {
    const r = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 1800,
      practicedAtStart: 0,
      now: T0 + 10_000,
    });
    expect(r.remaining).toBe(1790);
    expect(r.practiced).toBe(10);
    expect(r.finished).toBe(false);
  });

  it('剛開始（尚未經過時間）時數值不變', () => {
    const r = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 1800,
      practicedAtStart: 0,
      now: T0,
    });
    expect(r.remaining).toBe(1800);
    expect(r.practiced).toBe(0);
  });

  it('時間到時 remaining 為 0 且 finished 為 true', () => {
    const r = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 60,
      practicedAtStart: 0,
      now: T0 + 60_000,
    });
    expect(r.remaining).toBe(0);
    expect(r.finished).toBe(true);
    expect(r.practiced).toBe(60);
  });

  it('【核心情境】分頁被背景節流很久後，時間不會少算', () => {
    // 這正是改用時間戳的原因：setInterval 在背景可能整整 10 分鐘只跑幾次，
    // 用計次會嚴重少算；用時間戳則完全不受影響。
    const r = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 1800,
      practicedAtStart: 0,
      now: T0 + 600_000, // 實際過了 10 分鐘
    });
    expect(r.remaining).toBe(1200);
    expect(r.practiced).toBe(600);
  });

  it('背景時間超過設定長度時，練習時間不會灌水', () => {
    // 設定 1 分鐘，但使用者把平板丟著 1 小時才回來 ——
    // 只能記 1 分鐘，不能記 1 小時
    const r = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 60,
      practicedAtStart: 0,
      now: T0 + 3_600_000,
    });
    expect(r.remaining).toBe(0);
    expect(r.practiced).toBe(60);
    expect(r.finished).toBe(true);
  });

  it('暫停後繼續，練習時間會接續累加而不是歸零', () => {
    // 第一段：練了 10 秒後暫停
    const first = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 1800,
      practicedAtStart: 0,
      now: T0 + 10_000,
    });
    expect(first.practiced).toBe(10);

    // 第二段：以暫停當下的狀態為新基準，再練 5 秒
    const second = computeTimerTick({
      startTimestamp: T0 + 100_000, // 中間暫停了一段時間
      remainingAtStart: first.remaining,
      practicedAtStart: first.practiced,
      now: T0 + 105_000,
    });
    expect(second.remaining).toBe(1785);
    expect(second.practiced).toBe(15); // 10 + 5，暫停期間不計入
  });

  it('多段練習計畫的步驟之間，已練習時間持續累加', () => {
    const step1 = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 600,
      practicedAtStart: 0,
      now: T0 + 600_000,
    });
    expect(step1.practiced).toBe(600);

    const step2 = computeTimerTick({
      startTimestamp: T0 + 600_000,
      remainingAtStart: 300,
      practicedAtStart: step1.practiced,
      now: T0 + 900_000,
    });
    expect(step2.practiced).toBe(900); // 10 分鐘 + 5 分鐘
  });

  it('系統時鐘被往回調時不會算出負數', () => {
    const r = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 1800,
      practicedAtStart: 100,
      now: T0 - 50_000,
    });
    expect(r.remaining).toBe(1800);
    expect(r.practiced).toBe(100);
    expect(r.remaining).toBeGreaterThanOrEqual(0);
  });

  it('不足 1 秒的零頭不會進位（避免每次 tick 都跳動）', () => {
    const r = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 1800,
      practicedAtStart: 0,
      now: T0 + 1_900, // 1.9 秒
    });
    expect(r.remaining).toBe(1799);
    expect(r.practiced).toBe(1);
  });

  it('remainingAtStart 為 0 時立即視為完成', () => {
    const r = computeTimerTick({
      startTimestamp: T0,
      remainingAtStart: 0,
      practicedAtStart: 500,
      now: T0 + 5_000,
    });
    expect(r.finished).toBe(true);
    expect(r.practiced).toBe(500); // 不會再增加
  });
});

describe('getStepDuration — 舊資料相容', () => {
  it('讀新版的 duration 欄位', () => {
    expect(getStepDuration({ duration: 15 })).toBe(15);
  });

  it('讀舊版的 durationSeconds 欄位', () => {
    expect(getStepDuration({ durationSeconds: 20 })).toBe(20);
  });

  it('兩個欄位都有時以新版 duration 為準', () => {
    expect(getStepDuration({ duration: 15, durationSeconds: 20 })).toBe(15);
  });

  it('【回歸測試】欄位缺失時回傳預設值而不是 NaN', () => {
    // v2.1.0 的「舊練習計畫導致白畫面」就是這裡算出 NaN 造成的，
    // 當時只修了部分呼叫點，其他路徑仍會壞掉
    expect(getStepDuration({})).toBe(30);
    expect(getStepDuration(undefined)).toBe(30);
    expect(getStepDuration(null)).toBe(30);
    expect(Number.isNaN(getStepDuration({}))).toBe(false);
  });

  it('異常值（0、負數、NaN、字串）都回退到預設值', () => {
    expect(getStepDuration({ duration: 0 })).toBe(30);
    expect(getStepDuration({ duration: -5 })).toBe(30);
    expect(getStepDuration({ duration: NaN })).toBe(30);
    expect(getStepDuration({ duration: Infinity })).toBe(30);
    expect(getStepDuration({ duration: '10' as unknown as number })).toBe(30);
  });
});
