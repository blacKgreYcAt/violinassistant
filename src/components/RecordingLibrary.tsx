import React, { useCallback, useEffect, useState } from 'react';
import { X, Video, Mic, ChevronDown, ChevronRight, Music, Activity } from 'lucide-react';
import {
  Recording,
  Score,
  getAllRecordings,
  getScores,
  deleteRecording,
  assignRecordingToScore,
  isUnassigned,
  UNASSIGNED_SCORE_ID,
} from '../lib/storage';
import { RecordingPlayer } from './RecordingPlayer';

interface RecordingLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 所有練習錄影的總覽。
 *
 * 為什麼需要這個：原本只有樂譜檢視器裡的「本曲錄影紀錄」能看到錄影，
 * 而它是用 getRecordingsByScoreId(score.id) 查的。從「樂譜與紀錄」分頁
 * 直接錄的影片沒有對應樂譜（scoreId 是 UNASSIGNED_SCORE_ID），
 * 等於存進去之後永遠看不到也刪不掉 —— 空間一直被佔用。
 *
 * 而且音準分析對「音階、練習曲」其實比對樂曲更有用，那種練習通常不會
 * 特地去上傳一份譜。所以錄影不應該被強制綁定樂譜。
 */
export const RecordingLibrary: React.FC<RecordingLibraryProps> = ({ isOpen, onClose }) => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 只有展開中的那一筆才會建立 object URL。
  // 一次把所有錄影都轉成 URL 會把每一段影片都釘在記憶體裡。
  const [expandedUrl, setExpandedUrl] = useState<string | undefined>();

  const load = useCallback(async () => {
    const [allRecordings, allScores] = await Promise.all([getAllRecordings(), getScores()]);
    setRecordings(allRecordings);
    setScores(allScores);
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  // 關閉時收合，避免下次打開還留著上次的 URL
  useEffect(() => {
    if (!isOpen) setExpandedId(null);
  }, [isOpen]);

  useEffect(() => {
    if (!expandedId) {
      setExpandedUrl(undefined);
      return;
    }
    const target = recordings.find((r) => r.id === expandedId);
    if (!target) return;

    const url = URL.createObjectURL(target.blob);
    setExpandedUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setExpandedUrl(undefined);
    };
  }, [expandedId, recordings]);

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這段錄影嗎？此動作無法復原。')) return;
    if (expandedId === id) setExpandedId(null);
    await deleteRecording(id);
    await load();
  };

  const handleAssign = async (recordingId: string, scoreId: string) => {
    await assignRecordingToScore(recordingId, scoreId === UNASSIGNED_SCORE_ID ? null : scoreId);
    await load();
  };

  const scoreName = (recording: Recording) => {
    if (isUnassigned(recording)) return null;
    return scores.find((s) => s.id === recording.scoreId)?.name ?? '（樂譜已刪除）';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-warm/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-surface-warm rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-warm rounded-2xl flex items-center justify-center text-bg-warm">
              <Video size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-warm">練習錄影</h2>
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mt-0.5">
                {recordings.length} 段紀錄
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-warm hover:bg-white/5 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2 min-h-0">
          {recordings.length === 0 ? (
            <div className="text-center py-16 text-text-muted">
              <Video size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm">尚無練習錄影</p>
              <p className="text-xs mt-2 leading-relaxed">
                在「樂譜與紀錄」分頁或樂譜檢視器裡錄製後，
                <br />
                按「儲存」就會留存在這裡。
              </p>
            </div>
          ) : (
            recordings.map((r) => {
              const expanded = expandedId === r.id;
              const name = scoreName(r);
              const hasIntonation = (r.intonationData?.length ?? 0) > 0;

              return (
                <div
                  key={r.id}
                  data-testid="recording-entry"
                  className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
                  >
                    {expanded ? (
                      <ChevronDown size={16} className="text-text-muted shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-text-muted shrink-0" />
                    )}
                    {r.type === 'audio' ? (
                      <Mic size={16} className="text-accent-warm shrink-0" />
                    ) : (
                      <Video size={16} className="text-accent-warm shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-text-warm truncate">
                        {name ?? '未指定曲目'}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {new Date(r.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {hasIntonation && (
                      <span
                        className="flex items-center gap-1 text-[10px] text-emerald-400 shrink-0"
                        title="有音準分析資料"
                      >
                        <Activity size={12} />
                        音準
                      </span>
                    )}
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 space-y-3">
                      {/* 事後指定曲目：讓使用者可以先自由錄、之後再歸類 */}
                      <label className="flex items-center gap-2 text-[11px] text-text-muted">
                        <Music size={12} className="shrink-0" />
                        <span className="shrink-0">歸屬曲目</span>
                        <select
                          value={isUnassigned(r) ? UNASSIGNED_SCORE_ID : r.scoreId}
                          onChange={(e) => handleAssign(r.id, e.target.value)}
                          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-text-warm focus:outline-none focus:border-accent-warm"
                        >
                          <option value={UNASSIGNED_SCORE_ID} className="bg-bg-warm">
                            未指定
                          </option>
                          {scores.map((s) => (
                            <option key={s.id} value={s.id} className="bg-bg-warm">
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <RecordingPlayer recording={r} url={expandedUrl} onDelete={handleDelete} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-white/5 shrink-0">
          <p className="text-[10px] text-text-muted text-center leading-relaxed">
            指定曲目後，該段錄影也會出現在樂譜檢視器的「本曲錄影紀錄」中。
            <br />
            展開錄影即可查看音準分析。
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecordingLibrary;
