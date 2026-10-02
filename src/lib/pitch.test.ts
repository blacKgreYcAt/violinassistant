import { describe, it, expect } from 'vitest';
import {
  detectPitch,
  noteNumberFromPitch,
  frequencyFromNoteNumber,
  centsOffFromPitch,
  noteNameFromNoteNumber,
  MIN_DETECTABLE_FREQ,
  MAX_DETECTABLE_FREQ,
} from './pitch';

const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048; // 與 AnalyserNode.fftSize 一致

/** 產生一段指定頻率的正弦波，模擬 getFloatTimeDomainData 的輸出 */
function sineWave(frequency: number, sampleRate = SAMPLE_RATE, length = FFT_SIZE, amplitude = 0.5) {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buf;
}

/** 疊加泛音，比較接近真實樂器的波形（弦樂器泛音很強） */
function harmonicWave(fundamental: number, sampleRate = SAMPLE_RATE, length = FFT_SIZE) {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    buf[i] =
      0.5 * Math.sin(2 * Math.PI * fundamental * t) +
      0.25 * Math.sin(2 * Math.PI * fundamental * 2 * t) +
      0.12 * Math.sin(2 * Math.PI * fundamental * 3 * t);
  }
  return buf;
}

describe('detectPitch', () => {
  // 小提琴四條空弦 + 中提琴/大提琴的低音弦
  const strings: [string, number][] = [
    ['大提琴 C2', 65.41],
    ['中提琴 C3', 130.81],
    ['小提琴 G3', 196.0],
    ['小提琴 D4', 293.66],
    ['小提琴 A4', 440.0],
    ['小提琴 E5', 659.25],
  ];

  it.each(strings)('能辨識 %s (%f Hz) 的純正弦波，誤差在 1%% 以內', (_name, freq) => {
    const detected = detectPitch(sineWave(freq), SAMPLE_RATE);
    expect(detected).toBeGreaterThan(0);
    expect(Math.abs(detected - freq) / freq).toBeLessThan(0.01);
  });

  it.each(strings)('能辨識 %s (%f Hz) 的含泛音波形（更接近真實琴聲）', (_name, freq) => {
    const detected = detectPitch(harmonicWave(freq), SAMPLE_RATE);
    expect(detected).toBeGreaterThan(0);
    // 含泛音時容忍度放寬，但必須鎖在基頻而不是跳到二倍音
    expect(Math.abs(detected - freq) / freq).toBeLessThan(0.02);
  });

  it('無聲時回傳 -1，不會回傳 NaN 或 Infinity', () => {
    const silence = new Float32Array(FFT_SIZE);
    expect(detectPitch(silence, SAMPLE_RATE)).toBe(-1);
  });

  it('音量極小（低於門檻）時回傳 -1', () => {
    expect(detectPitch(sineWave(440, SAMPLE_RATE, FFT_SIZE, 0.001), SAMPLE_RATE)).toBe(-1);
  });

  it('低於可偵測範圍的頻率不會被誤判成別的音', () => {
    const detected = detectPitch(sineWave(30), SAMPLE_RATE);
    // 要嘛判定失敗，要嘛至少落在合法範圍內（絕不能回傳 30 這種超出範圍的值）
    if (detected !== -1) {
      expect(detected).toBeGreaterThanOrEqual(MIN_DETECTABLE_FREQ);
      expect(detected).toBeLessThanOrEqual(MAX_DETECTABLE_FREQ);
    }
  });

  it('白噪音不會回傳超出合法範圍的值', () => {
    const noise = new Float32Array(FFT_SIZE);
    let seed = 42;
    for (let i = 0; i < noise.length; i++) {
      // 固定種子的偽亂數，確保測試可重現
      seed = (seed * 1103515245 + 12345) % 2147483648;
      noise[i] = (seed / 2147483648) * 2 - 1;
    }
    const detected = detectPitch(noise, SAMPLE_RATE);
    if (detected !== -1) {
      expect(Number.isFinite(detected)).toBe(true);
      expect(detected).toBeGreaterThanOrEqual(MIN_DETECTABLE_FREQ);
      expect(detected).toBeLessThanOrEqual(MAX_DETECTABLE_FREQ);
    }
  });

  it('回傳值永遠是有限數（不會是 Infinity / NaN）', () => {
    for (const freq of [70, 100, 440, 1000, 1500]) {
      const detected = detectPitch(sineWave(freq), SAMPLE_RATE);
      expect(Number.isFinite(detected)).toBe(true);
    }
  });

  it('在 48kHz 取樣率下同樣準確', () => {
    const detected = detectPitch(sineWave(440, 48000), 48000);
    expect(Math.abs(detected - 440) / 440).toBeLessThan(0.01);
  });

  it('極短的輸入不會爆掉', () => {
    expect(() => detectPitch(new Float32Array(2), SAMPLE_RATE)).not.toThrow();
  });
});

describe('音高與音名換算', () => {
  it('A4 = 440Hz 對應 MIDI 69', () => {
    expect(noteNumberFromPitch(440)).toBe(69);
  });

  it('MIDI 69 換回 440Hz', () => {
    expect(frequencyFromNoteNumber(69)).toBeCloseTo(440, 5);
  });

  it('音準正確時 cents 接近 0', () => {
    expect(Math.abs(centsOffFromPitch(440, 69))).toBeLessThanOrEqual(1);
  });

  it('偏高時 cents 為正、偏低時為負', () => {
    expect(centsOffFromPitch(445, 69)).toBeGreaterThan(0);
    expect(centsOffFromPitch(435, 69)).toBeLessThan(0);
  });

  it('常見音名對應正確', () => {
    expect(noteNameFromNoteNumber(69)).toBe('A');
    expect(noteNameFromNoteNumber(60)).toBe('C');
    expect(noteNameFromNoteNumber(61)).toBe('C#');
    expect(noteNameFromNoteNumber(71)).toBe('B');
  });

  it('負數音高編號不會回傳 undefined（JS 的 -3 % 12 是 -3）', () => {
    // 這是原本實作的 bug：noteStrings[noteNum % 12] 在負數時會取到 undefined，
    // 畫面上的音名就會變成空白
    for (let n = -24; n < 0; n++) {
      const name = noteNameFromNoteNumber(n);
      expect(name).toBeDefined();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('偵測出的頻率換算成音名後與預期相符', () => {
    const detected = detectPitch(sineWave(440), SAMPLE_RATE);
    const noteNum = noteNumberFromPitch(detected);
    expect(noteNameFromNoteNumber(noteNum)).toBe('A');
  });
});
