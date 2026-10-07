import React, { useRef, useState, useCallback } from 'react';
import { Trash2, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { Recording } from '../lib/storage';
import { IntonationChart } from './IntonationChart';
import { cn } from '../lib/utils';

interface RecordingPlayerProps {
  recording: Recording;
  /** 播放用的 object URL，由父層建立與回收 */
  url?: string;
  onDelete: (id: string) => void;
}

/**
 * 單筆錄影：播放器 + 音準回放分析。
 *
 * 拆成獨立元件是因為每一筆都需要自己的 media ref 與播放位置狀態，
 * 直接寫在清單的 map 裡沒辦法為每一項各自保存。
 */
export const RecordingPlayer: React.FC<RecordingPlayerProps> = ({ recording, url, onDelete }) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showChart, setShowChart] = useState(true);

  const hasIntonation = (recording.intonationData?.length ?? 0) > 0;

  // 播放位置用於畫音準圖上的游標。
  // timeupdate 的觸發頻率約 4Hz，不需要額外節流。
  const handleTimeUpdate = useCallback(() => {
    if (mediaRef.current) setCurrentTime(mediaRef.current.currentTime);
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = seconds;
    setCurrentTime(seconds);
    // 點了音準圖上的某個時間點，意圖通常是「我要聽那一段」
    void el.play().catch(() => {
      /* 瀏覽器可能因為沒有使用者手勢而拒絕播放，忽略即可 */
    });
  }, []);

  return (
    <div className="bg-white/5 p-3 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted font-bold">
          {new Date(recording.timestamp).toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          {hasIntonation && (
            <button
              onClick={() => setShowChart((v) => !v)}
              className={cn(
                'p-1.5 rounded-lg transition-colors flex items-center gap-1',
                showChart ? 'text-emerald-400 bg-emerald-400/10' : 'text-text-muted hover:text-text-warm'
              )}
              title={showChart ? '收起音準分析' : '展開音準分析'}
            >
              <Activity size={14} />
              {showChart ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          <button
            onClick={() => onDelete(recording.id)}
            className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            title="刪除這段錄影"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {url &&
        (recording.type === 'audio' ? (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={url}
            controls
            className="w-full"
            onTimeUpdate={handleTimeUpdate}
          />
        ) : (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={url}
            controls
            playsInline
            className="w-full rounded-lg bg-black"
            onTimeUpdate={handleTimeUpdate}
          />
        ))}

      {hasIntonation && showChart && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <IntonationChart
            samples={recording.intonationData}
            startedAt={recording.startedAt}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
        </div>
      )}
    </div>
  );
};
