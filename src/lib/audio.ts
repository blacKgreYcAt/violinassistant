/**
 * 建立 AudioContext，相容舊版 Safari 的 webkitAudioContext。
 *
 * 原本這段 `new (window.AudioContext || (window as any).webkitAudioContext)()`
 * 在 Metronome、Tuner（兩處）、VideoRecorder、Timer 各複製了一份，
 * 每一份都用 any 繞過型別檢查。集中成一個函式後只要維護一處，也不需要 any。
 */
type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;

export function createAudioContext(): AudioContext {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;

  if (!Ctor) {
    throw new Error('此瀏覽器不支援 Web Audio API');
  }
  return new Ctor();
}

/**
 * 這個瀏覽器有沒有 Web Audio。
 *
 * 用來讓依賴音訊的功能「單獨停用」，而不是讓例外往上冒、害整個 App
 * 掛掉變成錯誤畫面。實際遇過：Playwright 的 WebKit 建置就沒有 Web Audio，
 * 節拍器一啟動整個 App 就被錯誤邊界接走。真正的 Safari 有，但舊版瀏覽器
 * 或精簡環境不保證。
 */
export function isAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AudioContext ??
      (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
  );
}
