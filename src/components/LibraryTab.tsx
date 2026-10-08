import React from 'react';
import { ScoreLibrary } from './ScoreLibrary';
import { VideoRecorder } from './VideoRecorder';
import { PracticeHistory } from './PracticeHistory';
import { PracticeDashboard } from './PracticeDashboard';
import { PracticeRoutine, Score } from '../lib/storage';

/**
 *「樂譜與紀錄」分頁的內容。
 *
 * 從 App.tsx 抽出來只有一個目的：讓它能被 lazy 載入。
 * 這一頁連帶拉進 recharts（練習紀錄與目標的圖表），是主 bundle 裡最大的一塊，
 * 但第一次打開 App 看到的是「練習工具」分頁，用不到它。
 *
 * App 第一次切到這一頁後就會持續掛著（用 display:none 隱藏），
 * 所以捲動位置、展開狀態這些都不會因為切分頁而重置。
 */
interface LibraryTabProps {
  onSelectScore: (score: Score) => void;
  onStartRoutine: (routine: PracticeRoutine) => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({ onSelectScore, onStartRoutine }) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 min-h-[500px]">
      <ScoreLibrary onSelectScore={onSelectScore} />
      {/* 這個區塊只在沒有選取樂譜時才會渲染，所以不會有可關聯的樂譜；
          原本傳的 activeScoreName={activeScore?.name} 必定是 undefined。
          要把錄影歸到某一份樂譜底下，請從樂譜檢視器裡的錄影模式錄製。 */}
      <VideoRecorder className="h-full" />
    </div>
    {/* 「練習計畫 / 練習目標」放在「練習紀錄」旁邊 ——
        這正是使用說明所描述的位置（「在『練習紀錄』旁的『練習計畫』分頁」）。
        PracticeDashboard 這個容器元件先前完全沒有被掛載，
        導致 activeRoutine 永遠是 null、Timer 裡整套計畫執行邏輯變成死碼。 */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0 min-h-[400px]">
      <PracticeHistory className="lg:col-span-2 h-full" />
      <PracticeDashboard onStartRoutine={onStartRoutine} className="h-full" />
    </div>
  </>
);
