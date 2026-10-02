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
