import { describe, it, expect } from 'vitest';
import {
  toRelativeSeries,
  bucketize,
  summarize,
  findWorstSegments,
  formatSeconds,
  IntonationSample,
  IntonationPoint,
} from './intonation';

const T0 = 1_700_000_000_000;

/** 產生一段取樣：每 40ms 一筆（與錄影時的實際取樣頻率一致） */
function samples(centsSeq: number[], startAt = T0, pitch = 440): IntonationSample[] {
  return centsSeq.map((cents, i) => ({
    time: startAt + i * 40,
    pitch,
    cents,
  }));
}

function points(centsSeq: number[], stepSeconds = 0.04): IntonationPoint[] {
  return centsSeq.map((cents, i) => ({
    t: i * stepSeconds,
    cents,
    pitch: 440,
    note: 'A',
  }));
}

describe('toRelativeSeries', () => {
  it('以錄影開始時刻為基準換算成秒', () => {
    const result = toRelativeSeries(samples([0, 5, -5]), T0);
    expect(result.map((p) => p.t)).toEqual([0, 0.04, 0.08]);
  });

  it('沒有 startedAt 時（舊錄影）退而用第一筆取樣當基準', () => {
    // 開頭有 2 秒靜音，所以第一筆取樣在 T0+2000
    const result = toRelativeSeries(samples([0, 5], T0 + 2000));
    expect(result[0].t).toBe(0);
    expect(result[1].t).toBeCloseTo(0.04, 5);
  });

  it('有 startedAt 時，開頭的靜音會正確反映成時間偏移', () => {
    const result = toRelativeSeries(samples([0], T0 + 2000), T0);
    expect(result[0].t).toBe(2);
  });

  it('附上音名', () => {
    const result = toRelativeSeries(samples([0], T0, 440), T0);
    expect(result[0].note).toBe('A');
  });

  it('沒有資料時回傳空陣列，不會爆掉', () => {
    expect(toRelativeSeries(undefined)).toEqual([]);
    expect(toRelativeSeries([])).toEqual([]);
  });

  it('濾掉 NaN / Infinity 的髒資料', () => {
    const dirty: IntonationSample[] = [
      { time: T0, pitch: 440, cents: 0 },
      { time: T0 + 40, pitch: NaN, cents: 5 },
      { time: T0 + 80, pitch: 440, cents: Infinity },
    ];
    expect(toRelativeSeries(dirty, T0)).toHaveLength(1);
  });

  it('時間順序錯亂的資料會被排序', () => {
    const unordered: IntonationSample[] = [
      { time: T0 + 80, pitch: 440, cents: 0 },
      { time: T0, pitch: 440, cents: 0 },
    ];
    const result = toRelativeSeries(unordered, T0);
    expect(result[0].t).toBeLessThan(result[1].t);
  });

  it('時間不會是負數（取樣早於宣稱的開始時刻時）', () => {
    const result = toRelativeSeries(samples([0], T0 - 500), T0);
    expect(result[0].t).toBe(0);
  });
});

describe('summarize', () => {
  it('全部在容許範圍內時準確率為 1', () => {
    const s = summarize(points([0, 3, -4, 8, -9]));
    expect(s.accurateRatio).toBe(1);
  });

  it('一半超出容許範圍時準確率為 0.5', () => {
    const s = summarize(points([0, 0, 30, 30]));
    expect(s.accurateRatio).toBe(0.5);
  });

  it('平均絕對偏差不受正負抵銷影響', () => {
    // +20 與 -20 的帶號平均是 0，但絕對平均是 20
    const s = summarize(points([20, -20]));
    expect(s.averageSignedCents).toBe(0);
    expect(s.averageAbsCents).toBe(20);
  });

  it('整體偏高時帶號平均為正（例如把位偏高）', () => {
    const s = summarize(points([15, 18, 22]));
    expect(s.averageSignedCents).toBeGreaterThan(0);
  });

  it('容許範圍可調整', () => {
    const p = points([15, 15, 15, 15]);
    expect(summarize(p, 10).accurateRatio).toBe(0);
    expect(summarize(p, 20).accurateRatio).toBe(1);
  });

  it('沒有資料時回傳 0 而不是 NaN', () => {
    const s = summarize([]);
    expect(s.accurateRatio).toBe(0);
    expect(Number.isNaN(s.averageAbsCents)).toBe(false);
  });
});

describe('bucketize', () => {
  it('把大量資料點歸納成指定數量的格子', () => {
    const buckets = bucketize(points(new Array(1000).fill(0)), 50);
    expect(buckets.length).toBeLessThanOrEqual(50);
    expect(buckets.length).toBeGreaterThan(0);
  });

  it('保留每一格的最大與最小值（音不穩時不會被平均掉）', () => {
    // 在 -30 和 +30 之間劇烈擺動，平均接近 0 但實際很不穩
    const wobble = points(Array.from({ length: 100 }, (_, i) => (i % 2 ? 30 : -30)));
    const [bucket] = bucketize(wobble, 1);
    expect(Math.abs(bucket.avgCents)).toBeLessThan(5); // 平均被抵銷
    expect(bucket.minCents).toBe(-30); // 但擺動幅度被保留
    expect(bucket.maxCents).toBe(30);
  });

  it('沒有取樣的時間區間不會產生格子（呈現為圖上的空白）', () => {
    const withGap: IntonationPoint[] = [
      { t: 0, cents: 0, pitch: 440, note: 'A' },
      { t: 0.1, cents: 0, pitch: 440, note: 'A' },
      // 中間 10 秒完全沒有聲音
      { t: 10, cents: 0, pitch: 440, note: 'A' },
    ];
    const buckets = bucketize(withGap, 10);
    expect(buckets.length).toBeLessThan(10);
    expect(buckets.every((b) => b.count > 0)).toBe(true);
  });

  it('只有一個資料點時不會除以零', () => {
    const buckets = bucketize(points([12]), 10);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].avgCents).toBe(12);
  });

  it('沒有資料時回傳空陣列', () => {
    expect(bucketize([], 10)).toEqual([]);
  });
});

describe('findWorstSegments', () => {
  it('找出持續偏離的片段', () => {
    // 前 1 秒準，接著 1 秒偏高 30 音分，再回到準
    const seq = [...new Array(25).fill(0), ...new Array(25).fill(30), ...new Array(25).fill(0)];
    const segments = findWorstSegments(points(seq));

    expect(segments).toHaveLength(1);
    expect(segments[0].avgCents).toBeCloseTo(30, 1);
    expect(segments[0].startT).toBeCloseTo(1.0, 1);
  });

  it('忽略過於短暫的瞬間偏差（換弦、換把位的過渡）', () => {
    // 只有兩個取樣（80ms）偏掉，不該被當成問題
    const seq = [...new Array(25).fill(0), 40, 40, ...new Array(25).fill(0)];
    expect(findWorstSegments(points(seq))).toHaveLength(0);
  });

  it('依嚴重度排序（偏差大小 × 持續時間）', () => {
    const seq = [
      ...new Array(10).fill(0),
      ...new Array(20).fill(15), // 輕微但較久
      ...new Array(10).fill(0),
      ...new Array(20).fill(45), // 嚴重且一樣久
      ...new Array(10).fill(0),
    ];
    const segments = findWorstSegments(points(seq));
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments[0].avgAbsCents).toBeGreaterThan(segments[1].avgAbsCents);
  });

  it('中間有長間隔時會切成兩段，而不是連成一段', () => {
    const seq: IntonationPoint[] = [
      ...Array.from({ length: 20 }, (_, i) => ({ t: i * 0.04, cents: 30, pitch: 440, note: 'A' })),
      // 中間隔了 5 秒沒有聲音
      ...Array.from({ length: 20 }, (_, i) => ({ t: 6 + i * 0.04, cents: 30, pitch: 440, note: 'A' })),
    ];
    expect(findWorstSegments(seq)).toHaveLength(2);
  });

  it('全部都在容許範圍內時回傳空陣列', () => {
    expect(findWorstSegments(points(new Array(100).fill(3)))).toEqual([]);
  });

  it('回傳數量受 limit 限制', () => {
    const seq: IntonationPoint[] = [];
    for (let block = 0; block < 10; block++) {
      for (let i = 0; i < 20; i++) {
        seq.push({ t: block * 5 + i * 0.04, cents: 30, pitch: 440, note: 'A' });
      }
    }
    expect(findWorstSegments(seq, { limit: 3 })).toHaveLength(3);
  });

  it('片段的音名取該段出現最多次的音', () => {
    const seq: IntonationPoint[] = Array.from({ length: 20 }, (_, i) => ({
      t: i * 0.04,
      cents: 30,
      pitch: 440,
      note: i < 3 ? 'C' : 'F#', // 開頭幾筆是過渡音
    }));
    expect(findWorstSegments(seq)[0].note).toBe('F#');
  });
});

describe('formatSeconds', () => {
  it('格式化為 m:ss', () => {
    expect(formatSeconds(0)).toBe('0:00');
    expect(formatSeconds(9)).toBe('0:09');
    expect(formatSeconds(65)).toBe('1:05');
    expect(formatSeconds(600)).toBe('10:00');
  });

  it('負數與小數不會產生奇怪的輸出', () => {
    expect(formatSeconds(-5)).toBe('0:00');
    expect(formatSeconds(9.9)).toBe('0:09');
  });
});
