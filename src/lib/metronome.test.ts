import { describe, it, expect } from 'vitest';
import {
  clickSpecFor,
  clampBpm,
  clampSubdivision,
  secondsPerTick,
  advanceTick,
  MIN_BPM,
  MAX_BPM,
  isSilentBar,
  remainingSilentBars,
} from './metronome';

describe('clickSpecFor', () => {
  it('小節第一拍是重音', () => {
    const spec = clickSpecFor(0, 0);
    expect(spec.isAccent).toBe(true);
    expect(spec.isMainBeat).toBe(true);
    expect(spec.frequency).toBe(1200);
    expect(spec.gain).toBe(1);
  });

  it('其他正拍不是重音，但音量仍是滿的', () => {
    const spec = clickSpecFor(2, 0);
    expect(spec.isAccent).toBe(false);
    expect(spec.isMainBeat).toBe(true);
    expect(spec.gain).toBe(1);
  });

  it('細分出來的點比較輕、音高比較高', () => {
    const main = clickSpecFor(0, 0);
    const sub = clickSpecFor(0, 1);
    expect(sub.isMainBeat).toBe(false);
    // 慢練時要能聽出正拍在哪裡，所以細分點必須明顯比正拍輕
    expect(sub.gain).toBeLessThan(main.gain);
    expect(sub.frequency).toBeGreaterThan(main.frequency);
  });

  it('第一拍的細分點不會被誤判為重音', () => {
    expect(clickSpecFor(0, 1).isAccent).toBe(false);
    expect(clickSpecFor(0, 2).isAccent).toBe(false);
  });
});

describe('clampBpm', () => {
  it('範圍內的值原樣回傳', () => {
    expect(clampBpm(100)).toBe(100);
  });

  it('超出範圍會被夾住', () => {
    expect(clampBpm(10)).toBe(MIN_BPM);
    expect(clampBpm(500)).toBe(MAX_BPM);
  });

  it('【關鍵防護】0、負數、NaN、Infinity 都回落到下限', () => {
    // 這幾個值若流進排程器會造成無聲或整個分頁凍結
    expect(clampBpm(0)).toBe(MIN_BPM);
    expect(clampBpm(-50)).toBe(MIN_BPM);
    expect(clampBpm(NaN)).toBe(MIN_BPM);
    expect(clampBpm(Infinity)).toBe(MAX_BPM);
    expect(clampBpm(-Infinity)).toBe(MIN_BPM);
  });
});

describe('clampSubdivision', () => {
  it('合法值原樣回傳', () => {
    expect(clampSubdivision(1)).toBe(1);
    expect(clampSubdivision(3)).toBe(3);
  });

  it('不合法的值回落到不細分', () => {
    expect(clampSubdivision(0)).toBe(1);
    expect(clampSubdivision(5)).toBe(1);
    expect(clampSubdivision(-2)).toBe(1);
    expect(clampSubdivision(NaN)).toBe(1);
  });
});

describe('secondsPerTick', () => {
  it('不細分時就是一拍的長度', () => {
    expect(secondsPerTick(120, 1)).toBeCloseTo(0.5, 6);
    expect(secondsPerTick(60, 1)).toBeCloseTo(1, 6);
  });

  it('八分音符是半拍', () => {
    expect(secondsPerTick(120, 2)).toBeCloseTo(0.25, 6);
  });

  it('三連音是三分之一拍', () => {
    expect(secondsPerTick(120, 3)).toBeCloseTo(0.5 / 3, 6);
  });

  it('十六分音符是四分之一拍', () => {
    expect(secondsPerTick(120, 4)).toBeCloseTo(0.125, 6);
  });

  it('【關鍵防護】永遠是正的有限值', () => {
    // 回傳 0 或負數會讓排程迴圈永遠跑不完而凍結分頁；
    // 回傳 Infinity 則節拍器會無聲死掉
    for (const bpm of [0, -100, NaN, Infinity, -Infinity]) {
      for (const sub of [1, 2, 3, 4, 0, -1, NaN]) {
        const result = secondsPerTick(bpm, sub);
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBeGreaterThan(0);
      }
    }
  });
});

describe('advanceTick', () => {
  it('不細分時，每一下就推進一拍', () => {
    const next = advanceTick({ beatIndex: 0, subIndex: 0 }, 4, 1);
    expect(next).toEqual({ beatIndex: 1, subIndex: 0, crossedBarline: false });
  });

  it('細分時先走完細分點，才推進到下一拍', () => {
    let pos = { beatIndex: 0, subIndex: 0 };
    pos = advanceTick(pos, 4, 3);
    expect(pos).toMatchObject({ beatIndex: 0, subIndex: 1 });
    pos = advanceTick(pos, 4, 3);
    expect(pos).toMatchObject({ beatIndex: 0, subIndex: 2 });
    pos = advanceTick(pos, 4, 3);
    expect(pos).toMatchObject({ beatIndex: 1, subIndex: 0 });
  });

  it('走完一小節會回到第一拍並標示跨過小節線', () => {
    const next = advanceTick({ beatIndex: 3, subIndex: 0 }, 4, 1);
    expect(next).toEqual({ beatIndex: 0, subIndex: 0, crossedBarline: true });
  });

  it('細分時只有在真正跨過小節線才會標示（漸進模式靠它計算小節數）', () => {
    // 4/4 配三連音：一小節共 12 下，只有第 12 下之後才跨小節線
    let pos = { beatIndex: 0, subIndex: 0 };
    let crossings = 0;
    for (let i = 0; i < 12; i++) {
      const next = advanceTick(pos, 4, 3);
      if (next.crossedBarline) crossings++;
      pos = next;
    }
    expect(crossings).toBe(1);
    expect(pos).toMatchObject({ beatIndex: 0, subIndex: 0 });
  });

  it('一小節的總下數 = 拍數 × 細分數', () => {
    for (const [beats, subs] of [[4, 1], [3, 2], [6, 4], [2, 3]] as const) {
      let pos = { beatIndex: 0, subIndex: 0 };
      let ticks = 0;
      do {
        pos = advanceTick(pos, beats, subs);
        ticks++;
      } while (!(pos.beatIndex === 0 && pos.subIndex === 0));
      expect(ticks).toBe(beats * subs);
    }
  });

  it('異常的拍數不會造成除以零或無限迴圈', () => {
    expect(advanceTick({ beatIndex: 0, subIndex: 0 }, 0, 1)).toMatchObject({ beatIndex: 0 });
    expect(advanceTick({ beatIndex: 0, subIndex: 0 }, NaN, 1)).toMatchObject({ beatIndex: 0 });
  });
});

describe('isSilentBar', () => {
  it('前幾小節發聲、接著幾小節靜音，週期循環', () => {
    // 響 2 小節、靜 2 小節
    const pattern = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => isSilentBar(i, 2, 2));
    expect(pattern).toEqual([false, false, true, true, false, false, true, true]);
  });

  it('可以設定不對稱的長度（響 4 靜 1）', () => {
    const pattern = [0, 1, 2, 3, 4, 5].map((i) => isSilentBar(i, 4, 1));
    expect(pattern).toEqual([false, false, false, false, true, false]);
  });

  it('靜音小節設為 0 代表停用，永遠不靜音', () => {
    expect([0, 1, 2, 5, 10].every((i) => !isSilentBar(i, 2, 0))).toBe(true);
  });

  it('不合法的設定一律視為停用，不會讓節拍器整個靜掉', () => {
    for (const [play, silent] of [[0, 2], [-1, 2], [2, -1], [NaN, 2], [2, NaN]]) {
      expect(isSilentBar(1, play, silent)).toBe(false);
    }
  });

  it('異常的小節序號不會爆掉', () => {
    expect(isSilentBar(-1, 2, 2)).toBe(false);
    expect(isSilentBar(NaN, 2, 2)).toBe(false);
  });
});

describe('remainingSilentBars', () => {
  it('靜音期間回傳剩餘小節數並逐步遞減', () => {
    // 響 2 靜 2：第 2、3 小節靜音
    expect(remainingSilentBars(2, 2, 2)).toBe(2);
    expect(remainingSilentBars(3, 2, 2)).toBe(1);
  });

  it('非靜音期間回傳 0', () => {
    expect(remainingSilentBars(0, 2, 2)).toBe(0);
    expect(remainingSilentBars(1, 2, 2)).toBe(0);
  });

  it('停用時永遠回傳 0', () => {
    expect(remainingSilentBars(5, 2, 0)).toBe(0);
  });
});
