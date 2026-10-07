/**
 * 曲目練習速度的進展分析。
 *
 * ScoreViewer 會在節拍器停止時記錄「這首今天練到的最高 BPM」（每天只留最高、
 * 最多 30 筆）。原本畫面上只是把這些數字列成一張平板清單，看不出有沒有進步 ——
 * 而「這首三週從 60 練到 92」正是練習者最需要看到的回饋。
 */

export interface TempoEntry {
  bpm: number;
  /** 記錄當下的時間戳 */
  date: number;
}

export interface TempoPoint {
  date: number;
  bpm: number;
  /** 給圖表 X 軸用的短標籤，例如 10/07 */
  label: string;
}

export interface TempoProgress {
  points: TempoPoint[];
  /** 最早一筆的速度 */
  firstBpm: number;
  /** 最新一筆的速度 */
  latestBpm: number;
  /** 期間內達到過的最高速度 */
  bestBpm: number;
  /** 相對於最早一筆的進步量（可能是負的） */
  improvement: number;
  /** 最早與最新之間相隔幾天 */
  daysSpan: number;
  /** 練習過的天數（= 紀錄筆數） */
  sessionCount: number;
}

function formatLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 整理成可直接餵給圖表的資料與摘要。
 *
 * 會過濾掉不合法的紀錄並依時間排序 —— 舊資料可能來自不同版本，
 * 不能假設它一定是乾淨且有序的。
 */
export function summarizeTempoProgress(history: TempoEntry[] | undefined): TempoProgress | null {
  const valid = (history ?? [])
    .filter(
      (h) =>
        h &&
        Number.isFinite(h.bpm) &&
        Number.isFinite(h.date) &&
        h.bpm > 0
    )
    .sort((a, b) => a.date - b.date);

  if (valid.length === 0) return null;

  const points: TempoPoint[] = valid.map((h) => ({
    date: h.date,
    bpm: h.bpm,
    label: formatLabel(h.date),
  }));

  const firstBpm = points[0].bpm;
  const latestBpm = points[points.length - 1].bpm;
  const bestBpm = Math.max(...points.map((p) => p.bpm));
  const spanMs = points[points.length - 1].date - points[0].date;

  return {
    points,
    firstBpm,
    latestBpm,
    bestBpm,
    improvement: latestBpm - firstBpm,
    // 取最接近的整數天。用無條件進位的話，同一天內相隔幾分鐘的兩筆紀錄
    // 會被算成「相隔 1 天」，顯示出來會很怪。
    daysSpan: Math.round(spanMs / (24 * 60 * 60 * 1000)),
    sessionCount: points.length,
  };
}
