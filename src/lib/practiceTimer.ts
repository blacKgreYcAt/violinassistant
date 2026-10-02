/**
 * 練習計時器的純計算邏輯。
 *
 * 從 Timer.tsx 的 useEffect 裡抽出來，目的是讓它可以被測試 ——
 * 這是整個 App 最關鍵的計算（練習時間記錄、集點卡獎勵都依賴它），
 * 但原本埋在元件的 effect 裡，沒有任何方式驗證它算得對不對。
 */

export interface TimerTickInput {
  /** 按下「開始／繼續」當下的 Date.now() */
  startTimestamp: number;
  /** 按下「開始／繼續」當下的剩餘秒數 */
  remainingAtStart: number;
  /** 按下「開始／繼續」當下已累積的練習秒數 */
  practicedAtStart: number;
  /** 目前的 Date.now() */
  now: number;
}

export interface TimerTickResult {
  remaining: number;
  practiced: number;
  finished: boolean;
}

/**
 * 以時間戳差值計算目前狀態，而不是累加 tick 次數。
 *
 * 會這樣設計是因為瀏覽器在分頁切到背景或螢幕關閉時會節流（甚至暫停）
 * setInterval —— 用計次的話練習時間會嚴重少算，而「把平板放在一旁開始練琴」
 * 正是這個 App 最主要的使用情境。
 */
export function computeTimerTick({
  startTimestamp,
  remainingAtStart,
  practicedAtStart,
  now,
}: TimerTickInput): TimerTickResult {
  // 時鐘被往回調、或傳入異常值時，elapsed 不應為負
  const elapsed = Math.max(0, Math.floor((now - startTimestamp) / 1000));
  const safeRemainingAtStart = Math.max(0, remainingAtStart);

  const remaining = Math.max(0, safeRemainingAtStart - elapsed);
  // 練習時間不應超過這一段原本設定的長度（背景被節流很久後一次補回時尤其重要）
  const countedElapsed = Math.min(elapsed, safeRemainingAtStart);

  return {
    remaining,
    practiced: practicedAtStart + countedElapsed,
    finished: remaining === 0,
  };
}

/**
 * 取得練習步驟的時長（分鐘）。
 *
 * 舊版資料用的是 durationSeconds 欄位，新版是 duration。
 * v2.1.0 修「舊練習計畫導致白畫面」時只改了一部分呼叫點，
 * 其他地方仍會讀到 undefined 而算出 NaN，所以統一成一個函式。
 */
export function getStepDuration(
  step: { duration?: number; durationSeconds?: number } | undefined | null
): number {
  if (!step) return 30;
  const value = step.duration ?? step.durationSeconds;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 30;
}
