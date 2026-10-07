import React, { useMemo } from 'react';
import { Target, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import {
  toRelativeSeries,
  bucketize,
  summarize,
  findWorstSegments,
  formatSeconds,
  DEFAULT_TOLERANCE_CENTS,
  IntonationSample,
} from '../lib/intonation';
import { cn } from '../lib/utils';

interface IntonationChartProps {
  samples?: IntonationSample[];
  /** 錄影開始的時刻；舊錄影沒有這個欄位時會退而用第一筆取樣 */
  startedAt?: number;
  /** 影片目前的播放位置（秒），用來畫播放游標 */
  currentTime?: number;
  /** 點擊圖表時跳轉到該時間點 */
  onSeek?: (seconds: number) => void;
  className?: string;
}

const CHART_HEIGHT = 120;
const CENTS_RANGE = 50; // 上下各顯示 ±50 音分

/**
 * 音準回放圖表。
 *
 * 錄影時 App 一直在偵測音高並存起來，但在此之前那些資料從未被讀出來過。
 * 這個元件把它畫成可以回顧的曲線：哪一段偏高、哪一段不穩，一眼看得到，
 * 點下去還能跳到影片的那一秒。
 *
 * 用原生 SVG 而不是圖表函式庫：資料量大（一次錄影可達上萬點，已先經過
 * bucketize 歸納），而且需要和影片播放位置做低延遲同步，自己畫比較好控制。
 */
export const IntonationChart: React.FC<IntonationChartProps> = ({
  samples,
  startedAt,
  currentTime,
  onSeek,
  className,
}) => {
  const points = useMemo(() => toRelativeSeries(samples, startedAt), [samples, startedAt]);
  const buckets = useMemo(() => bucketize(points, 160), [points]);
  const stats = useMemo(() => summarize(points), [points]);
  const worst = useMemo(() => findWorstSegments(points), [points]);

  if (points.length === 0) {
    return (
      <div className={cn('text-[11px] text-text-muted text-center py-4 leading-relaxed', className)}>
        這段錄影沒有音準資料。
        <br />
        （錄製當下沒有偵測到穩定的音高，或是舊版本錄的）
      </div>
    );
  }

  const startT = points[0].t;
  const endT = points[points.length - 1].t;
  const span = Math.max(0.001, endT - startT);

  const xOf = (t: number) => ((t - startT) / span) * 100;
  const yOf = (cents: number) => {
    const clamped = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, cents));
    return ((CENTS_RANGE - clamped) / (CENTS_RANGE * 2)) * CHART_HEIGHT;
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(startT + ratio * span);
  };

  const accuracyPercent = Math.round(stats.accurateRatio * 100);
  // 整體偏高或偏低超過 5 音分才值得提醒（例如整把琴把位偏了）
  const bias = stats.averageSignedCents;
  const biasIsNotable = Math.abs(bias) >= 5;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* 摘要 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Target size={14} className={accuracyPercent >= 80 ? 'text-emerald-400' : 'text-accent-warm'} />
          <span className="text-xs font-bold text-text-warm">
            準確率 {accuracyPercent}%
          </span>
          <span className="text-[10px] text-text-muted">
            （±{DEFAULT_TOLERANCE_CENTS} 音分內）
          </span>
        </div>
        <div className="text-[10px] text-text-muted">
          平均偏差 {stats.averageAbsCents.toFixed(1)} 音分
        </div>
        {biasIsNotable && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            {bias > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            整體偏{bias > 0 ? '高' : '低'} {Math.abs(bias).toFixed(0)} 音分
          </div>
        )}
      </div>

      {/* 曲線 */}
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className={cn('w-full rounded-lg bg-black/30', onSeek && 'cursor-pointer')}
        style={{ height: CHART_HEIGHT }}
        onClick={handleClick}
        role="img"
        aria-label={`音準曲線，準確率 ${accuracyPercent}%`}
      >
        {/* 容許範圍帶：落在這個區間內聽起來是準的 */}
        <rect
          x="0"
          y={yOf(DEFAULT_TOLERANCE_CENTS)}
          width="100"
          height={yOf(-DEFAULT_TOLERANCE_CENTS) - yOf(DEFAULT_TOLERANCE_CENTS)}
          className="fill-emerald-500/15"
        />
        {/* 標準音高基準線 */}
        <line x1="0" y1={yOf(0)} x2="100" y2={yOf(0)} className="stroke-emerald-400/50" strokeWidth="0.3" />
        {[-25, 25].map((c) => (
          <line
            key={c}
            x1="0"
            y1={yOf(c)}
            x2="100"
            y2={yOf(c)}
            className="stroke-white/10"
            strokeWidth="0.2"
            strokeDasharray="1 1"
          />
        ))}

        {/* 每一格的擺動範圍（最小到最大）—— 只畫平均值會把「音不穩」藏起來 */}
        {buckets.map((b, i) => (
          <line
            key={`r${i}`}
            x1={xOf(b.t)}
            y1={yOf(b.maxCents)}
            x2={xOf(b.t)}
            y2={yOf(b.minCents)}
            className={
              Math.abs(b.avgCents) <= DEFAULT_TOLERANCE_CENTS
                ? 'stroke-emerald-400/50'
                : Math.abs(b.avgCents) <= 25
                  ? 'stroke-amber-400/60'
                  : 'stroke-red-400/70'
            }
            strokeWidth="0.55"
            strokeLinecap="round"
          />
        ))}

        {/* 播放游標 */}
        {typeof currentTime === 'number' && currentTime >= startT && currentTime <= endT && (
          <line
            x1={xOf(currentTime)}
            y1="0"
            x2={xOf(currentTime)}
            y2={CHART_HEIGHT}
            className="stroke-white"
            strokeWidth="0.4"
          />
        )}
      </svg>

      <div className="flex justify-between text-[9px] text-text-muted font-mono">
        <span>{formatSeconds(startT)}</span>
        <span className="text-emerald-400/70">準 ±{DEFAULT_TOLERANCE_CENTS}</span>
        <span>{formatSeconds(endT)}</span>
      </div>

      {/* 最需要加強的片段 —— 這是整個功能最實用的部分：
          知道「準確率 78%」沒什麼用，知道「第 42 秒那個 F# 低了 28 音分」才能拿去練 */}
      {worst.length > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            最需要注意的片段
          </div>
          {worst.map((seg, i) => (
            <button
              key={i}
              onClick={() => onSeek?.(seg.startT)}
              disabled={!onSeek}
              className={cn(
                'flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white/5 text-left transition-colors',
                onSeek && 'hover:bg-white/10'
              )}
            >
              <span className="text-[11px] font-mono text-text-muted shrink-0">
                {formatSeconds(seg.startT)}
              </span>
              <span className="text-[11px] font-bold text-text-warm flex-1 truncate">
                {seg.note}
              </span>
              <span
                className={cn(
                  'text-[11px] font-mono font-bold shrink-0',
                  seg.avgAbsCents > 25 ? 'text-red-400' : 'text-amber-400'
                )}
              >
                {seg.avgCents > 0 ? '+' : ''}
                {seg.avgCents.toFixed(0)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
          <CheckCircle2 size={14} />
          沒有持續偏離的片段，音準很穩定
        </div>
      )}
    </div>
  );
};
