/**
 * 自相關法 (auto-correlation) 音高偵測。
 *
 * 原本 Tuner.tsx 與 VideoRecorder.tsx 各自有一份幾乎相同的實作，
 * 這裡抽成共用模組，避免兩邊各自修改而行為分歧。
 *
 * 相對於原始版本的改動：
 * 1. 只計算「樂器音域對應的延遲範圍」的自相關，而不是全部 2048 個延遲。
 *    原本是 O(n²) 全掃（約 200 萬次乘加），每秒跑 60 次會讓手機發燙、掉幀。
 * 2. 回傳值會驗證是有限數且落在合理音域內。原本在無聲或極端輸入下
 *    可能回傳 Infinity / NaN / 負數，一路傳到畫面上變成「Infinity Hz」或空白音名。
 */

/** 低於大提琴最低音 C2 (約 65Hz) 一點，留一些餘裕 */
export const MIN_DETECTABLE_FREQ = 60;
/** 高於小提琴常用音域上限，足以涵蓋泛音以外的基頻 */
export const MAX_DETECTABLE_FREQ = 1600;

/** 音量低於這個 RMS 就視為沒有在演奏 */
const SILENCE_RMS_THRESHOLD = 0.01;

/**
 * @returns 偵測到的頻率 (Hz)，若無法判定則回傳 -1
 */
export function detectPitch(buf: Float32Array, sampleRate: number): number {
  let size = buf.length;

  // 先用 RMS 判斷是不是根本沒有聲音
  let rms = 0;
  for (let i = 0; i < size; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / size);
  if (rms < SILENCE_RMS_THRESHOLD) return -1;

  // 裁掉頭尾接近靜音的部分，提高自相關的可靠度
  let r1 = 0;
  let r2 = size - 1;
  const trimThreshold = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buf[i]) < trimThreshold) { r1 = i; break; }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buf[size - i]) < trimThreshold) { r2 = size - i; break; }
  }

  const trimmed = buf.slice(r1, r2);
  size = trimmed.length;
  if (size < 4) return -1;

  // 只搜尋樂器音域對應的延遲（lag）範圍：
  // 延遲 = 取樣率 / 頻率，所以高頻對應小延遲、低頻對應大延遲。
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_DETECTABLE_FREQ));
  const maxLag = Math.min(size - 2, Math.ceil(sampleRate / MIN_DETECTABLE_FREQ));
  if (maxLag <= minLag) return -1;

  const c = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let j = 0; j < size - lag; j++) {
      sum += trimmed[j] * trimmed[j + lag];
    }
    c[lag] = sum;
  }

  // 先跳過 lag=0 那個峰的下坡段，再開始找最大值。
  //
  // 這一步不能省：自相關值沒有除以項數，lag 越大相加的項數越少、數值自然越小。
  // 低音的週期很長（例如大提琴 C2 在 44.1kHz 下是 674 個取樣），在 lag 很小的地方
  // 波形幾乎還沒偏移、相關性仍然很高，而且項數更多 —— 最大值就會落在那裡，
  // 換算出來變成一千多 Hz 的假音高。（這正是只保留 minLag 下限時低音會偵測失敗的原因。）
  let searchStart = minLag;
  while (searchStart < maxLag && c[searchStart] > c[searchStart + 1]) {
    searchStart++;
  }

  // 找出相關性最高的延遲
  let maxVal = -1;
  let maxPos = -1;
  for (let lag = searchStart; lag <= maxLag; lag++) {
    if (c[lag] > maxVal) {
      maxVal = c[lag];
      maxPos = lag;
    }
  }
  if (maxPos <= 0 || maxVal <= 0) return -1;

  // 用拋物線內插取得次取樣精度，讓讀數不會一格一格跳
  let period = maxPos;
  if (maxPos > searchStart && maxPos < maxLag) {
    const x1 = c[maxPos - 1];
    const x2 = c[maxPos];
    const x3 = c[maxPos + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) period = maxPos - b / (2 * a);
  }

  if (!Number.isFinite(period) || period <= 0) return -1;

  const frequency = sampleRate / period;
  if (!Number.isFinite(frequency) || frequency < MIN_DETECTABLE_FREQ || frequency > MAX_DETECTABLE_FREQ) {
    return -1;
  }

  return frequency;
}

const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 由頻率換算成 MIDI 音高編號 (A4 = 440Hz = 69) */
export function noteNumberFromPitch(frequency: number): number {
  return Math.round(12 * (Math.log(frequency / 440) / Math.log(2))) + 69;
}

export function frequencyFromNoteNumber(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export function centsOffFromPitch(frequency: number, note: number): number {
  return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));
}

/**
 * 取得音名。用取餘數的方式要小心負數：
 * JavaScript 的 -3 % 12 會得到 -3 而不是 9，直接拿去索引會得到 undefined，
 * 畫面上音名就會變成空白。
 */
export function noteNameFromNoteNumber(note: number): string {
  const index = ((note % 12) + 12) % 12;
  return NOTE_STRINGS[index];
}

export { NOTE_STRINGS };
