import { describe, it, expect } from 'vitest';
import { applyPlaybackSpeed, PLAYBACK_SPEEDS } from '../components/PlaybackSpeedControl';

/** 最小的 media 元素替身：只需要這兩個屬性 */
function fakeMedia(withPreservesPitch = true) {
  const media: Record<string, unknown> = { playbackRate: 1 };
  if (withPreservesPitch) media.preservesPitch = false;
  return media as unknown as HTMLMediaElement;
}

describe('applyPlaybackSpeed', () => {
  it('設定播放速度', () => {
    const media = fakeMedia();
    applyPlaybackSpeed(media, 0.5);
    expect(media.playbackRate).toBe(0.5);
  });

  it('開啟 preservesPitch', () => {
    const media = fakeMedia();
    applyPlaybackSpeed(media, 0.5);
    // 慢速播放若不保留音高，聽起來會像錄音帶轉慢、音準整個跑掉，
    // 對聽辨練習反而有害
    expect((media as unknown as { preservesPitch: boolean }).preservesPitch).toBe(true);
  });

  it('瀏覽器不支援 preservesPitch 時不會爆掉', () => {
    const media = fakeMedia(false);
    expect(() => applyPlaybackSpeed(media, 0.5)).not.toThrow();
    expect(media.playbackRate).toBe(0.5);
  });

  it('media 為 null / undefined 時安全忽略', () => {
    expect(() => applyPlaybackSpeed(null, 0.5)).not.toThrow();
    expect(() => applyPlaybackSpeed(undefined, 0.5)).not.toThrow();
  });

  it('所有提供的速度選項都能套用', () => {
    for (const speed of PLAYBACK_SPEEDS) {
      const media = fakeMedia();
      applyPlaybackSpeed(media, speed);
      expect(media.playbackRate).toBe(speed);
    }
  });

  it('速度選項偏重慢速（學習時主要是為了看清楚動作）', () => {
    const slow = PLAYBACK_SPEEDS.filter((s) => s < 1).length;
    const fast = PLAYBACK_SPEEDS.filter((s) => s > 1).length;
    expect(slow).toBeGreaterThan(fast);
    expect(PLAYBACK_SPEEDS).toContain(0.5);
  });
});
