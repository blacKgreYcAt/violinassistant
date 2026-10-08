import { describe, it, expect } from 'vitest';
import {
  toLocalRatio,
  rectFromPoints,
  isRectUsable,
  rectToPercentStyle,
  clampBarsPerRep,
  accumulateReps,
  withBestBpm,
  ScoreSection,
  DEFAULT_BARS_PER_REP,
  MAX_BARS_PER_REP,
} from './scoreSections';

/** 一個 200×400 的頁面框，左上角在 (100, 50) */
const BOUNDS = { left: 100, top: 50, width: 200, height: 400 };

describe('toLocalRatio — 旋轉後的座標換算', () => {
  it('未旋轉時就是單純的等比例換算', () => {
    expect(toLocalRatio(BOUNDS, 0, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(toLocalRatio(BOUNDS, 0, 300, 450)).toEqual({ x: 1, y: 1 });
    expect(toLocalRatio(BOUNDS, 0, 200, 250)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('旋轉 180 度時座標上下左右對調', () => {
    const p = toLocalRatio(BOUNDS, 180, 100, 50);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(1);
  });

  it('旋轉 90 度時用的是外框的高當寬（這正是原本畫筆會偏掉的地方）', () => {
    // 旋轉 90 度後，外框 200×400 代表的是未旋轉前 400×200 的頁面。
    // 外框正中央在任何角度下都還是頁面正中央。
    const center = toLocalRatio(BOUNDS, 90, 200, 250);
    expect(center.x).toBeCloseTo(0.5);
    expect(center.y).toBeCloseTo(0.5);

    // rotate(90deg) 是順時針，所以外框的上緣中點，
    // 在未旋轉的頁面上是「左緣」中點
    const topMiddle = toLocalRatio(BOUNDS, 90, 200, 50);
    expect(topMiddle.x).toBeCloseTo(0);
    expect(topMiddle.y).toBeCloseTo(0.5);

    // 外框下緣中點則對應頁面右緣中點
    const bottomMiddle = toLocalRatio(BOUNDS, 90, 200, 450);
    expect(bottomMiddle.x).toBeCloseTo(1);
    expect(bottomMiddle.y).toBeCloseTo(0.5);
  });

  it('旋轉 270 度與 -90 度結果相同', () => {
    expect(toLocalRatio(BOUNDS, 270, 200, 50)).toEqual(toLocalRatio(BOUNDS, -90, 200, 50));
  });

  it('角度超過一圈也要正規化', () => {
    expect(toLocalRatio(BOUNDS, 450, 200, 50)).toEqual(toLocalRatio(BOUNDS, 90, 200, 50));
  });

  it('寬高為 0 時回傳原點而不是 NaN', () => {
    expect(toLocalRatio({ left: 0, top: 0, width: 0, height: 0 }, 0, 10, 10)).toEqual({ x: 0, y: 0 });
  });

  it('超出範圍時不夾住（畫筆需要知道畫出界了）', () => {
    const p = toLocalRatio(BOUNDS, 0, 400, 50);
    expect(p.x).toBeGreaterThan(1);
  });
});

describe('rectFromPoints — 拖曳框選', () => {
  it('左上拖到右下', () => {
    const rect = rectFromPoints({ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.5 });
    expect(rect.x).toBeCloseTo(0.2);
    expect(rect.y).toBeCloseTo(0.3);
    expect(rect.width).toBeCloseTo(0.4);
    expect(rect.height).toBeCloseTo(0.2);
  });

  it('反方向拖曳也要框得出來', () => {
    // 從右下往左上拖是很自然的動作，不能只支援一個方向
    const rect = rectFromPoints({ x: 0.6, y: 0.5 }, { x: 0.2, y: 0.3 });
    expect(rect.x).toBeCloseTo(0.2);
    expect(rect.y).toBeCloseTo(0.3);
    expect(rect.width).toBeCloseTo(0.4);
    expect(rect.height).toBeCloseTo(0.2);
  });

  it('拖出頁面外的部分會被切掉', () => {
    const rect = rectFromPoints({ x: -0.5, y: 0.5 }, { x: 1.8, y: 2 });
    expect(rect).toEqual({ x: 0, y: 0.5, width: 1, height: 0.5 });
  });

  it('NaN 不會污染出一個壞掉的矩形', () => {
    const rect = rectFromPoints({ x: NaN, y: 0.2 }, { x: 0.5, y: 0.6 });
    expect(Number.isFinite(rect.x)).toBe(true);
    expect(Number.isFinite(rect.width)).toBe(true);
  });
});

describe('isRectUsable', () => {
  it('正常大小的框可用', () => {
    expect(isRectUsable({ x: 0.1, y: 0.1, width: 0.5, height: 0.2 })).toBe(true);
  });

  it('手滑點一下產生的極小框不算數', () => {
    expect(isRectUsable({ x: 0.1, y: 0.1, width: 0, height: 0 })).toBe(false);
  });

  it('只有一邊太細也不算（框到一條線沒有意義）', () => {
    expect(isRectUsable({ x: 0.1, y: 0.1, width: 0.8, height: 0.001 })).toBe(false);
  });
});

describe('rectToPercentStyle', () => {
  it('換算成百分比字串', () => {
    expect(rectToPercentStyle({ x: 0.25, y: 0.5, width: 0.5, height: 0.1 })).toEqual({
      left: '25%',
      top: '50%',
      width: '50%',
      height: '10%',
    });
  });
});

describe('clampBarsPerRep', () => {
  it('一般值原樣保留', () => {
    expect(clampBarsPerRep(8)).toBe(8);
  });

  it('小於 1 會被拉回 1（0 會讓每個小節都算無限多遍）', () => {
    expect(clampBarsPerRep(0)).toBe(1);
    expect(clampBarsPerRep(-5)).toBe(1);
  });

  it('上限 64', () => {
    expect(clampBarsPerRep(1000)).toBe(MAX_BARS_PER_REP);
  });

  it('小數會四捨五入成整數小節', () => {
    expect(clampBarsPerRep(4.4)).toBe(4);
    expect(clampBarsPerRep(4.6)).toBe(5);
  });

  it('NaN 退回預設值而不是 1', () => {
    // 輸入框清空時會拿到 NaN，這時應該維持預設，而不是突然變成每小節一遍
    expect(clampBarsPerRep(NaN)).toBe(DEFAULT_BARS_PER_REP);
  });
});

describe('accumulateReps', () => {
  it('不滿一遍時只累積小節', () => {
    expect(accumulateReps({ bars: 0, reps: 0 }, 2, 4)).toEqual({ bars: 2, reps: 0 });
  });

  it('剛好跑滿就加一遍', () => {
    expect(accumulateReps({ bars: 2, reps: 1 }, 2, 4)).toEqual({ bars: 0, reps: 2 });
  });

  it('一次補很多小節時要加好幾遍，不能只加一遍', () => {
    // 分頁切到背景再切回來，畫面迴圈會一次補上一整批小節
    expect(accumulateReps({ bars: 0, reps: 0 }, 10, 4)).toEqual({ bars: 2, reps: 2 });
  });

  it('負數或 NaN 不會讓遍數倒退', () => {
    expect(accumulateReps({ bars: 1, reps: 3 }, -5, 4)).toEqual({ bars: 1, reps: 3 });
    expect(accumulateReps({ bars: 1, reps: 3 }, NaN, 4)).toEqual({ bars: 1, reps: 3 });
  });

  it('barsPerRep 為 0 時不會無限加遍數', () => {
    const result = accumulateReps({ bars: 0, reps: 0 }, 3, 0);
    expect(result.reps).toBe(3);
    expect(Number.isFinite(result.reps)).toBe(true);
  });

  it('壞掉的既有進度會被當成 0 而不是往下算', () => {
    expect(accumulateReps({ bars: -3, reps: -2 }, 4, 4)).toEqual({ bars: 0, reps: 1 });
  });
});

describe('withBestBpm', () => {
  const base: ScoreSection = {
    id: 's1',
    name: '第 45-52 小節',
    page: 0,
    rect: { x: 0, y: 0, width: 0.5, height: 0.2 },
    createdAt: 0,
    reps: 0,
  };

  it('第一次就記下來', () => {
    expect(withBestBpm(base, 72).bestBpm).toBe(72);
  });

  it('更快時才更新', () => {
    expect(withBestBpm({ ...base, bestBpm: 80 }, 92).bestBpm).toBe(92);
  });

  it('練慢的不會把紀錄拉低', () => {
    // 慢練是常態，若每次都覆蓋，這個數字就失去「最高速度」的意義
    expect(withBestBpm({ ...base, bestBpm: 80 }, 60).bestBpm).toBe(80);
  });

  it('無效的 BPM 不會寫入', () => {
    expect(withBestBpm(base, NaN).bestBpm).toBeUndefined();
    expect(withBestBpm(base, 0).bestBpm).toBeUndefined();
  });

  it('不會就地修改原本的物件', () => {
    const next = withBestBpm(base, 72);
    expect(base.bestBpm).toBeUndefined();
    expect(next).not.toBe(base);
  });
});
