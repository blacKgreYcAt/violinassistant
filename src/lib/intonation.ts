import { noteNumberFromPitch, noteNameFromNoteNumber } from './pitch';

/**
 * 音準資料的分析。
 *
 * 錄影時 App 一直在偵測音高並存進 Recording.intonationData，但在這個模組出現之前，
 * 那些資料存進 IndexedDB 後從來沒有被讀出來過 —— 只在錄影當下畫一條即時小曲線，
 * 錄完就等於消失。這裡把它變成可以回顧的東西。
 *
 * 一個必須說清楚的限制：cents 衡量的是「離最接近的半音有多遠」，
 * 不是「離應該拉的那個音有多遠」。如果整個音拉錯成隔壁的音，cents 仍然會接近 0。
 * 但實務上絕大多數音準問題是偏高或偏低 10～40 音分，這種情況會直接反映出來，
 * 對練習診斷是夠用的。
 */

/** 存在 Recording 裡的原始取樣（time 是 Date.now() 的絕對毫秒） */
export interface IntonationSample {
  time: number;
  pitch: number;
  cents: number;
}

/** 轉換成相對時間後的資料點 */
export interface IntonationPoint {
  /** 從錄影開始算起的秒數 */
  t: number;
  cents: number;
  pitch: number;
  note: string;
}

export interface IntonationBucket {
  /** 這一格的中心時間（秒） */
  t: number;
  avgCents: number;
  minCents: number;
  maxCents: number;
  count: number;
}

export interface IntonationSegment {
  startT: number;
  endT: number;
  /** 這段期間的平均偏差（帶正負號，正=偏高） */
  avgCents: number;
  /** 偏離程度的絕對值平均，用來排序嚴重度 */
  avgAbsCents: number;
  note: string;
}

export interface IntonationSummary {
  sampleCount: number;
  /** 有偵測到音高的總時長（秒）；靜音與休止不計入 */
  analysedSeconds: number;
  /** 落在容許範圍內的比例，0～1 */
  accurateRatio: number;
  averageAbsCents: number;
  /** 帶正負號的平均：持續為正代表整體偏高（例如把位偏高） */
  averageSignedCents: number;
}

/** 一般認為 ±10 音分以內聽起來是準的 */
export const DEFAULT_TOLERANCE_CENTS = 10;

/**
 * 把絕對時間戳換算成「從錄影開始的秒數」。
 *
 * startedAt 是錄影開始的時刻。舊的錄影沒有存這個欄位，
 * 這時退而求其次用第一筆取樣的時間當基準 —— 若開頭有一段靜音，
 * 時間軸會整段往前偏移，但相對關係仍然正確。
 */
export function toRelativeSeries(
  samples: IntonationSample[] | undefined,
  startedAt?: number
): IntonationPoint[] {
  if (!samples || samples.length === 0) return [];

  const base = startedAt ?? samples[0].time;

  return samples
    .filter((s) => Number.isFinite(s.pitch) && Number.isFinite(s.cents))
    .map((s) => {
      const noteNum = noteNumberFromPitch(s.pitch);
      return {
        t: Math.max(0, (s.time - base) / 1000),
        cents: s.cents,
        pitch: s.pitch,
        note: noteNameFromNoteNumber(noteNum),
      };
    })
    .sort((a, b) => a.t - b.t);
}

/**
 * 把資料點歸納成固定數量的時間格，供繪圖使用。
 *
 * 一次錄影可能有上萬個點，直接畫成 SVG 會卡住。
 * 每一格同時保留平均與最大／最小值 —— 只取平均會把「音不穩、上下飄」
 * 這種最該被看到的問題平均掉。
 * 沒有取樣的格子（靜音、休止）會被略過，圖上會呈現為空白，這是刻意的。
 */
export function bucketize(points: IntonationPoint[], bucketCount: number): IntonationBucket[] {
  if (points.length === 0 || bucketCount <= 0) return [];

  const start = points[0].t;
  const end = points[points.length - 1].t;
  const span = end - start;

  if (span <= 0) {
    const cents = points.map((p) => p.cents);
    return [
      {
        t: start,
        avgCents: cents.reduce((a, b) => a + b, 0) / cents.length,
        minCents: Math.min(...cents),
        maxCents: Math.max(...cents),
        count: cents.length,
      },
    ];
  }

  const width = span / bucketCount;
  const buckets: { sum: number; min: number; max: number; count: number }[] = Array.from(
    { length: bucketCount },
    () => ({ sum: 0, min: Infinity, max: -Infinity, count: 0 })
  );

  for (const p of points) {
    const idx = Math.min(bucketCount - 1, Math.floor((p.t - start) / width));
    const b = buckets[idx];
    b.sum += p.cents;
    b.min = Math.min(b.min, p.cents);
    b.max = Math.max(b.max, p.cents);
    b.count++;
  }

  return buckets
    .map((b, i) => ({
      t: start + (i + 0.5) * width,
      avgCents: b.count ? b.sum / b.count : 0,
      minCents: b.count ? b.min : 0,
      maxCents: b.count ? b.max : 0,
      count: b.count,
    }))
    .filter((b) => b.count > 0);
}

export function summarize(
  points: IntonationPoint[],
  toleranceCents: number = DEFAULT_TOLERANCE_CENTS
): IntonationSummary {
  if (points.length === 0) {
    return {
      sampleCount: 0,
      analysedSeconds: 0,
      accurateRatio: 0,
      averageAbsCents: 0,
      averageSignedCents: 0,
    };
  }

  let absSum = 0;
  let signedSum = 0;
  let accurate = 0;

  for (const p of points) {
    absSum += Math.abs(p.cents);
    signedSum += p.cents;
    if (Math.abs(p.cents) <= toleranceCents) accurate++;
  }

  return {
    sampleCount: points.length,
    analysedSeconds: points[points.length - 1].t - points[0].t,
    accurateRatio: accurate / points.length,
    averageAbsCents: absSum / points.length,
    averageSignedCents: signedSum / points.length,
  };
}

/**
 * 找出偏離最嚴重的幾個片段，讓使用者可以直接跳過去聽。
 *
 * 這是整個功能最實用的部分：知道「準確率 78%」沒什麼用，
 * 知道「第 42 秒那個 F# 低了 28 音分」才能拿去練。
 *
 * @param minDurationSeconds 太短的瞬間偏差（換弦、換把位的過渡）不算問題，予以忽略
 * @param gapSeconds 兩段問題之間若間隔小於此值，視為同一段
 */
export function findWorstSegments(
  points: IntonationPoint[],
  {
    toleranceCents = DEFAULT_TOLERANCE_CENTS,
    minDurationSeconds = 0.25,
    gapSeconds = 0.35,
    limit = 5,
  }: {
    toleranceCents?: number;
    minDurationSeconds?: number;
    gapSeconds?: number;
    limit?: number;
  } = {}
): IntonationSegment[] {
  const runs: IntonationPoint[][] = [];
  let current: IntonationPoint[] = [];

  for (const p of points) {
    const offPitch = Math.abs(p.cents) > toleranceCents;
    if (!offPitch) {
      if (current.length) runs.push(current);
      current = [];
      continue;
    }
    // 與前一點間隔太久就視為另一段（中間有休止或靜音）
    if (current.length && p.t - current[current.length - 1].t > gapSeconds) {
      runs.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) runs.push(current);

  return runs
    .map((run) => {
      const startT = run[0].t;
      const endT = run[run.length - 1].t;
      const signed = run.reduce((a, p) => a + p.cents, 0) / run.length;
      const abs = run.reduce((a, p) => a + Math.abs(p.cents), 0) / run.length;
      // 取這段裡出現最多次的音名，比只取第一個穩定
      const counts = new Map<string, number>();
      for (const p of run) counts.set(p.note, (counts.get(p.note) ?? 0) + 1);
      const note = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { startT, endT, avgCents: signed, avgAbsCents: abs, note };
    })
    .filter((seg) => seg.endT - seg.startT >= minDurationSeconds)
    // 嚴重度 = 偏差大小 × 持續時間，長時間小偏差和短時間大偏差都會被看到
    .sort(
      (a, b) =>
        b.avgAbsCents * (b.endT - b.startT) - a.avgAbsCents * (a.endT - a.startT)
    )
    .slice(0, limit);
}

/** 把秒數格式化成 m:ss，供圖表與清單顯示 */
export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
