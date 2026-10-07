import React from 'react';
import { Gauge } from 'lucide-react';
import { cn } from '../lib/utils';

/** 可選的播放速度。偏重慢速 —— 學習時主要是為了看清楚動作，很少需要加速。 */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.5] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

interface PlaybackSpeedControlProps {
  value: number;
  onChange: (speed: number) => void;
  className?: string;
}

/**
 * 播放速度控制。
 *
 * 用在兩個地方：看老師的示範影片，以及慢速回放自己的錄影。
 * 0.5 倍看運弓與換把是學習上的剛需，先前完全沒有這個功能。
 */
export const PlaybackSpeedControl: React.FC<PlaybackSpeedControlProps> = ({
  value,
  onChange,
  className,
}) => (
  <div className={cn('flex items-center gap-1 bg-black/30 rounded-xl p-1', className)}>
    <Gauge size={14} className="text-text-muted mx-1 shrink-0" aria-hidden="true" />
    {PLAYBACK_SPEEDS.map((speed) => (
      <button
        key={speed}
        onClick={() => onChange(speed)}
        aria-label={`播放速度 ${speed} 倍`}
        aria-pressed={value === speed}
        className={cn(
          'px-2 py-1 rounded-lg text-[11px] font-bold transition-all',
          value === speed
            ? 'bg-accent-warm text-bg-warm'
            : 'text-text-muted hover:text-text-warm hover:bg-white/5'
        )}
      >
        {speed}x
      </button>
    ))}
  </div>
);

/**
 * 套用播放速度到 media 元素。
 *
 * 一併開啟 preservesPitch：慢速播放時若不保留音高，聽起來會像錄音帶轉慢，
 * 音準完全跑掉 —— 對聽辨練習來說反而有害。
 */
export function applyPlaybackSpeed(
  media: HTMLMediaElement | null | undefined,
  speed: number
): void {
  if (!media) return;
  media.playbackRate = speed;
  // 這個屬性在舊版瀏覽器可能不存在，不能假設它一定可寫
  if ('preservesPitch' in media) {
    (media as HTMLMediaElement & { preservesPitch: boolean }).preservesPitch = true;
  }
}
