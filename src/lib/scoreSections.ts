/**
 * 樂譜段落（循環練習）的純計算邏輯。
 *
 * 「段落」是在樂譜上框出來的一塊區域（例如第 45–52 小節那段換弦），
 * 練習時把畫面對焦到它、並記錄練了幾遍、練到多快。
 *
 * 這裡只放計算，不碰 DOM 與 React，才能用單元測試驗證。
 */

export interface SectionRect {
  /** 以樂譜頁面框為基準的比例（0~1），不是像素 —— 縮放與換裝置都不會跑掉 */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScoreSection {
  id: string;
  name: string;
  /** 0-based 頁碼 */
  page: number;
  rect: SectionRect;
  createdAt: number;
  /** 累計練習遍數 */
  reps: number;
  /** 這個段落練到過的最高速度 */
  bestBpm?: number;
}

/**
 * 段落至少要有這麼大（佔頁面的比例）。
 * 沒有下限的話，手滑點一下就會建立一個看不見也點不到的段落。
 */
export const MIN_SECTION_RATIO = 0.03;

export const DEFAULT_BARS_PER_REP = 4;
export const MIN_BARS_PER_REP = 1;
export const MAX_BARS_PER_REP = 64;

interface BoundsLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 把畫面上的座標換算成元素「未旋轉前」的比例座標（0~1）。
 *
 * 樂譜容器上有 transform: rotate()，而 getBoundingClientRect() 回傳的是
 * 旋轉後的軸對齊外框。直接用外框等比例換算，在旋轉 90/270 度時 x 與 y
 * 其實要互換，位置會完全對不上。這裡先平移到中心、反向旋轉回去再換算。
 *
 * 回傳值刻意不夾在 0~1：畫筆需要知道有沒有畫出界，框選則自己夾。
 */
export function toLocalRatio(
  bounds: BoundsLike,
  rotation: number,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const angle = (((rotation % 360) + 360) % 360);

  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;

  const rad = (-angle * Math.PI) / 180;
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

  // 旋轉 90/270 度時，元素未旋轉前的寬高正好是外框的高與寬
  const isQuarterTurn = angle === 90 || angle === 270;
  const unrotatedWidth = isQuarterTurn ? bounds.height : bounds.width;
  const unrotatedHeight = isQuarterTurn ? bounds.width : bounds.height;
  if (!unrotatedWidth || !unrotatedHeight) return { x: 0, y: 0 };

  return {
    x: (localX + unrotatedWidth / 2) / unrotatedWidth,
    y: (localY + unrotatedHeight / 2) / unrotatedHeight,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * 由拖曳的起點與終點算出段落矩形。
 *
 * 往左上拖也要能框（起點不一定是左上角），超出頁面的部分直接切掉。
 */
export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number }
): SectionRect {
  const x1 = clamp01(a.x);
  const y1 = clamp01(a.y);
  const x2 = clamp01(b.x);
  const y2 = clamp01(b.y);

  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** 太小的框不算數（多半是手滑點到，不是真的要建立段落） */
export function isRectUsable(rect: SectionRect): boolean {
  return rect.width >= MIN_SECTION_RATIO && rect.height >= MIN_SECTION_RATIO;
}

/** 把比例矩形變成 CSS 的百分比字串，給高亮框用 */
export function rectToPercentStyle(rect: SectionRect): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

export function clampBarsPerRep(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BARS_PER_REP;
  return Math.min(MAX_BARS_PER_REP, Math.max(MIN_BARS_PER_REP, Math.round(value)));
}

export interface RepProgress {
  /** 這一遍已經跑掉的小節數 */
  bars: number;
  /** 完成的遍數 */
  reps: number;
}

/**
 * 節拍器又跑完幾個小節後，更新「練了幾遍」。
 *
 * 分頁切到背景再切回來時，可能一次補上好幾個小節，所以要能一次跨過
 * 不只一遍，而不是只加一遍就把剩下的丟掉。
 */
export function accumulateReps(
  progress: RepProgress,
  completedBars: number,
  barsPerRep: number
): RepProgress {
  const perRep = clampBarsPerRep(barsPerRep);
  const added = Number.isFinite(completedBars) ? Math.max(0, Math.floor(completedBars)) : 0;

  const totalBars = Math.max(0, progress.bars) + added;
  const gainedReps = Math.floor(totalBars / perRep);

  return {
    bars: totalBars % perRep,
    reps: Math.max(0, progress.reps) + gainedReps,
  };
}

/**
 * 記錄這個段落練到的最高速度。
 *
 * 只在真的更快時才更新 —— 練完一遍慢的不該把紀錄往下拉。
 */
export function withBestBpm(section: ScoreSection, bpm: number): ScoreSection {
  if (!Number.isFinite(bpm) || bpm <= 0) return section;
  if (section.bestBpm !== undefined && section.bestBpm >= bpm) return section;
  return { ...section, bestBpm: Math.round(bpm) };
}
