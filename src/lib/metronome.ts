/**
 * 節拍器的純計算邏輯。
 *
 * 從 Metronome.tsx 的排程器裡抽出來，目的是讓它可以被測試 ——
 * 原本這些判斷埋在 useCallback 與 Web Audio 的排程迴圈裡，
 * 沒有任何方式驗證「三連音的第二下該用什麼音高、音量」這類規則算得對不對。
 */

/** BPM 的合法範圍。排程器也用這兩個值做防護，避免算出 0、負數或 Infinity 的拍長。 */
export const MIN_BPM = 30;
export const MAX_BPM = 300;

/** 可選的細分方式：1=不細分、2=八分音符、3=三連音、4=十六分音符 */
export const SUBDIVISIONS = [1, 2, 3, 4] as const;
export type Subdivision = (typeof SUBDIVISIONS)[number];

export const SUBDIVISION_LABELS: Record<Subdivision, string> = {
  1: '不細分',
  2: '八分',
  3: '三連音',
  4: '十六分',
};

export interface ClickSpec {
  frequency: number;
  /** 0～1 的音量 */
  gain: number;
  /** 是否為正拍（細分出來的點不算） */
  isMainBeat: boolean;
  /** 是否為小節的第一拍（重音） */
  isAccent: boolean;
}

/**
 * 決定某一下該發出什麼聲音。
 *
 * 細分出來的點刻意做得又輕又高：慢練時要能清楚聽出正拍在哪裡，
 * 如果每一下都一樣響，反而會失去拍子的骨架。
 */
export function clickSpecFor(beatIndex: number, subIndex: number): ClickSpec {
  const isMainBeat = subIndex === 0;
  const isAccent = isMainBeat && beatIndex === 0;

  if (isAccent) return { frequency: 1200, gain: 1, isMainBeat, isAccent };
  if (isMainBeat) return { frequency: 1000, gain: 1, isMainBeat, isAccent };
  return { frequency: 1500, gain: 0.35, isMainBeat, isAccent };
}

/**
 * 把任意輸入夾到合法的 BPM 範圍。
 *
 * 只有 NaN 會回落到下限 —— 它沒有「快」或「慢」的語意，無從夾起。
 * ±Infinity 則照一般的夾法處理（Infinity → 上限、-Infinity → 下限），
 * 這比一律回落到下限更符合直覺。
 */
export function clampBpm(bpm: number): number {
  if (Number.isNaN(bpm)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

export function clampSubdivision(value: number): Subdivision {
  return (SUBDIVISIONS as readonly number[]).includes(value) ? (value as Subdivision) : 1;
}

/**
 * 每一下之間的間隔秒數。
 *
 * 一定是正的有限值：若 bpm 變成 0 會得到 Infinity（節拍器無聲死掉），
 * 變成負數則排程用的時間會不斷倒退，排程迴圈永遠跑不完而凍結整個分頁。
 */
export function secondsPerTick(bpm: number, subdivision: number): number {
  return 60.0 / clampBpm(bpm) / clampSubdivision(subdivision);
}

export interface TickPosition {
  beatIndex: number;
  subIndex: number;
}

/** 推進到下一下。回傳新的位置，以及是否跨過了小節線。 */
export function advanceTick(
  position: TickPosition,
  beatsPerMeasure: number,
  subdivision: number
): TickPosition & { crossedBarline: boolean } {
  const subs = clampSubdivision(subdivision);
  const beats = Math.max(1, Math.floor(beatsPerMeasure) || 1);

  const nextSub = position.subIndex + 1;
  if (nextSub < subs) {
    return { beatIndex: position.beatIndex, subIndex: nextSub, crossedBarline: false };
  }

  const nextBeat = (position.beatIndex + 1) % beats;
  return { beatIndex: nextBeat, subIndex: 0, crossedBarline: nextBeat === 0 };
}

/**
 * 判斷某一小節是否該靜音。
 *
 * 「靜音小節」是常見的節奏訓練方式：節拍器響幾小節後刻意停幾小節，
 * 讓演奏者自己維持速度，再用重新響起的拍子檢驗有沒有跑掉。
 * 老師很常要求用這個方式練。
 *
 * @param barIndex 從開始播放算起的小節序號（0 起算）
 * @param playBars 連續發聲幾小節
 * @param silentBars 接著靜音幾小節；0 代表不啟用
 */
export function isSilentBar(barIndex: number, playBars: number, silentBars: number): boolean {
  if (!Number.isFinite(barIndex) || barIndex < 0) return false;
  const play = Math.floor(playBars);
  const silent = Math.floor(silentBars);
  // 任一邊不合法就視為停用，不要讓節拍器整個靜掉
  if (!Number.isFinite(play) || !Number.isFinite(silent) || play < 1 || silent < 1) return false;

  return barIndex % (play + silent) >= play;
}

/** 靜音期間還剩幾小節（供畫面顯示倒數）；非靜音期間回傳 0 */
export function remainingSilentBars(
  barIndex: number,
  playBars: number,
  silentBars: number
): number {
  if (!isSilentBar(barIndex, playBars, silentBars)) return 0;
  const play = Math.floor(playBars);
  const silent = Math.floor(silentBars);
  const positionInCycle = barIndex % (play + silent);
  return play + silent - positionInCycle;
}
