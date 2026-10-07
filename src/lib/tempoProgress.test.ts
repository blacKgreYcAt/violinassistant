import { describe, it, expect } from 'vitest';
import { summarizeTempoProgress, TempoEntry } from './tempoProgress';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-09-01T10:00:00').getTime();

const entry = (bpm: number, dayOffset: number): TempoEntry => ({
  bpm,
  date: T0 + dayOffset * DAY,
});

describe('summarizeTempoProgress', () => {
  it('沒有紀錄時回傳 null', () => {
    expect(summarizeTempoProgress(undefined)).toBeNull();
    expect(summarizeTempoProgress([])).toBeNull();
  });

  it('計算起始、最新與最高速度', () => {
    const p = summarizeTempoProgress([entry(60, 0), entry(92, 20), entry(85, 25)])!;
    expect(p.firstBpm).toBe(60);
    expect(p.latestBpm).toBe(85);
    expect(p.bestBpm).toBe(92); // 最高不等於最新
  });

  it('進步量以最新相對最早計算', () => {
    const p = summarizeTempoProgress([entry(60, 0), entry(92, 20)])!;
    expect(p.improvement).toBe(32);
  });

  it('退步時進步量為負', () => {
    const p = summarizeTempoProgress([entry(100, 0), entry(80, 10)])!;
    expect(p.improvement).toBe(-20);
  });

  it('時間順序錯亂的紀錄會先被排序', () => {
    const p = summarizeTempoProgress([entry(92, 20), entry(60, 0), entry(75, 10)])!;
    expect(p.points.map((x) => x.bpm)).toEqual([60, 75, 92]);
    expect(p.firstBpm).toBe(60);
    expect(p.latestBpm).toBe(92);
  });

  it('過濾掉不合法的紀錄（舊版資料可能不乾淨）', () => {
    const dirty = [
      entry(60, 0),
      { bpm: NaN, date: T0 + DAY },
      { bpm: 0, date: T0 + 2 * DAY },
      { bpm: -50, date: T0 + 3 * DAY },
      { bpm: 90, date: NaN },
      entry(92, 5),
    ] as TempoEntry[];
    const p = summarizeTempoProgress(dirty)!;
    expect(p.sessionCount).toBe(2);
    expect(p.points.map((x) => x.bpm)).toEqual([60, 92]);
  });

  it('全部都不合法時回傳 null', () => {
    expect(summarizeTempoProgress([{ bpm: NaN, date: NaN }] as TempoEntry[])).toBeNull();
  });

  it('計算相隔天數', () => {
    const p = summarizeTempoProgress([entry(60, 0), entry(92, 21)])!;
    expect(p.daysSpan).toBe(21);
  });

  it('同一天的多筆紀錄相隔 0 天', () => {
    const p = summarizeTempoProgress([
      { bpm: 60, date: T0 },
      { bpm: 70, date: T0 + 60_000 },
    ])!;
    expect(p.daysSpan).toBe(0);
  });

  it('只有一筆紀錄時仍可用（起始=最新=最高，進步為 0）', () => {
    const p = summarizeTempoProgress([entry(72, 0)])!;
    expect(p.firstBpm).toBe(72);
    expect(p.latestBpm).toBe(72);
    expect(p.bestBpm).toBe(72);
    expect(p.improvement).toBe(0);
    expect(p.daysSpan).toBe(0);
  });

  it('產生圖表可用的日期標籤', () => {
    const p = summarizeTempoProgress([entry(60, 0)])!;
    expect(p.points[0].label).toBe('9/01');
  });

  it('sessionCount 等於有效紀錄筆數', () => {
    const p = summarizeTempoProgress([entry(60, 0), entry(70, 1), entry(80, 2)])!;
    expect(p.sessionCount).toBe(3);
  });
});
