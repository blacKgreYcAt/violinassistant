import React, { useState } from 'react';
import { 
  Music, 
  Library, 
  LayoutDashboard, 
  Video, 
  Timer as TimerIcon, 
  Share2, 
  Download, 
  Plus, 
  X,
  BookOpen,
  Settings,
  Smartphone,
  Edit2,
  UploadCloud,
  Calendar,
  History,
  Smile,
  ArrowRight,
  Eye,
  Star
} from 'lucide-react';
import { cn } from '../lib/utils';

const HeadIcon = ({ type }: { type: 'center' | 'right' | 'left' | 'down' | 'up' }) => {
  return (
    <svg viewBox="0 0 24 24" className="w-10 h-10 text-text-warm" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Base Head */}
      <circle cx="12" cy="12" r="8" />
      
      {type === 'center' && (
        <>
          <path d="M9 11h.01M15 11h.01" strokeWidth="2" />
          <path d="M12 13v1" />
          <path d="M10 16a2 2 0 0 0 4 0" />
        </>
      )}
      {type === 'right' && (
        <>
          <path d="M13 11h.01M17 11h.01" strokeWidth="2" />
          <path d="M15 13v1" />
          <path d="M13 16a2 2 0 0 0 3 -0.5" />
          {/* Arrow indicating looking right */}
          <path d="M22 12l-3-3m3 3l-3 3m3-3H18" className="text-accent-warm" strokeWidth="2" />
        </>
      )}
      {type === 'left' && (
        <>
          <path d="M7 11h.01M11 11h.01" strokeWidth="2" />
          <path d="M9 13v1" />
          <path d="M11 16a2 2 0 0 1 -3 -0.5" />
          {/* Arrow indicating looking left */}
          <path d="M2 12l3-3m-3 3l3 3m-3-3h4" className="text-accent-warm" strokeWidth="2" />
        </>
      )}
      {type === 'down' && (
        <>
          <path d="M9 13h.01M15 13h.01" strokeWidth="2" />
          <path d="M12 15v1" />
          <path d="M10 18a2 2 0 0 0 4 0" />
          {/* Arrow indicating looking down */}
          <path d="M12 22l-3-3m3 3l3-3m-3-3v-4" className="text-accent-warm" strokeWidth="2" />
        </>
      )}
      {type === 'up' && (
        <>
          <path d="M9 9h.01M15 9h.01" strokeWidth="2" />
          <path d="M12 11v1" />
          <path d="M10 14a2 2 0 0 0 4 0" />
          {/* Arrow indicating looking up */}
          <path d="M12 2l-3 3m3-3l3 3m-3-3v4" className="text-accent-warm" strokeWidth="2" />
        </>
      )}
    </svg>
  );
};

const WinkIcon = ({ type }: { type: 'right' | 'left' }) => {
  return (
    <svg viewBox="0 0 24 24" className="w-10 h-10 text-text-warm" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Base Head */}
      <circle cx="12" cy="12" r="8" />
      
      {type === 'right' ? (
        <>
          {/* Left eye open */}
          <path d="M8 11h.01" strokeWidth="2" />
          {/* Right eye closed (wink) */}
          <path d="M14 11.5c.5-1 1.5-1 2 0" />
          <path d="M10 16a2 2 0 0 0 4 0" />
        </>
      ) : (
        <>
          {/* Left eye closed (wink) */}
          <path d="M8 11.5c.5-1 1.5-1 2 0" />
          {/* Right eye open */}
          <path d="M16 11h.01" strokeWidth="2" />
          <path d="M10 16a2 2 0 0 0 4 0" />
        </>
      )}
    </svg>
  );
};

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuide: React.FC<UserGuideProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'changelog'>('guide');

  if (!isOpen) return null;

    const sections = [
    {
      icon: <Library className="text-accent-warm" />,
      title: "樂譜資料夾與標籤",
      content: "點擊「新增資料夾」按鈕建立分類。在樂譜清單中，點擊樂譜名稱旁的編輯按鈕，可同時修改名稱與新增「標籤 (Tag)」。上方搜尋列可快速搜尋名稱或標籤。"
    },
    {
      icon: <Edit2 className="text-accent-warm" />,
      title: "編輯樂譜與標註",
      content: "上傳照片後，點擊樂譜右側的「鉛筆圖示」即可自訂樂譜名稱。在閱覽模式中，您還可以使用「畫筆」在樂譜上自由標註重點，或「旋轉」方向錯誤的樂譜。"
    },
    {
      icon: <TimerIcon className="text-accent-warm" />,
      title: "練習計畫與計時",
      content: "在「練習紀錄」旁的「練習計畫」分頁，可建立包含多個步驟（如：音階 10m、曲目 20m）的練習清單。點擊播放按鈕即可開始執行計畫，計時器會自動引導您完成每個步驟。"
    },
    {
      icon: <Star className="text-accent-warm" />,
      title: "音樂集點卡與徽章",
      content: "點擊右上角的「星星」圖示開啟集點卡！每完成 30 分鐘的練習即可獲得 1 個音符 🎵。集滿 10 個音符可獲得隨機的「樂器拼圖碎片」，集滿所有拼圖即可解鎖終極徽章「首席提琴手」！"
    },
    {
      icon: <Calendar className="text-accent-warm" />,
      title: "練習紀錄與筆記",
      content: "計時器結束後會自動記錄練習時間，您還可以填寫「練習筆記」記錄心得與目標。系統會繪製近七天的練習圖表，並支援將紀錄透過郵件分享。"
    },
    {
      icon: <UploadCloud className="text-accent-warm" />,
      title: "備份與還原",
      content: "提供「下載備份」與「分享/郵件」功能，可將所有樂譜存成一個檔案備份。更換裝置時，使用「匯入備份」即可還原所有內容。"
    },
    {
      icon: <Music className="text-accent-warm" />,
      title: "節拍器、調音器與持續音",
      content: "節拍器支援 30-300 BPM 與拍號設定。「調音器」可即時偵測音準與音名。「持續音 (Drone Tone)」可發出指定音高的長音，輔助音準練習。"
    },
    {
      icon: <Video className="text-accent-warm" />,
      title: "錄影、純錄音與分割畫面",
      content: "錄影時可自由拖曳相機畫面至「四個角落」或縮小。若不需畫面，可切換至「純錄音模式」以節省設備儲存空間。\n\n點擊工具列的「分割畫面」按鈕，可將畫面左右對半切。在右側的錄影區塊中，您可以點擊「開啟相簿影片」來播放平板內的示範影片，方便一邊看譜一邊對照練習。"
    },
    {
      icon: <Smile className="text-accent-warm" />,
      title: "智能翻頁 (雙模式切換)",
      content: "開啟樂譜後點擊上方「智能翻頁」。旁邊的小按鈕可切換「頭部動作」或「眨眼」模式。為避免連續誤觸，每次翻頁後有「2 秒鐘冷卻時間」。",
      customContent: (
        <div className="mt-4 space-y-3">
          <div className="bg-bg-warm/50 p-3 rounded-xl border border-white/5">
            <div className="text-xs font-bold text-accent-warm mb-2 flex items-center gap-2">
              <Smile size={14} /> 頭部組合動作模式
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-text-muted w-10">下一頁</span>
                <div className="flex flex-col items-center gap-1">
                  <HeadIcon type="right" />
                  <span className="text-[10px] text-text-muted">1. 向右看</span>
                </div>
                <ArrowRight className="text-white/20 w-4 h-4" />
                <div className="flex flex-col items-center gap-1">
                  <HeadIcon type="down" />
                  <span className="text-[10px] text-text-muted">2. 向下點頭</span>
                </div>
                <ArrowRight className="text-white/20 w-4 h-4" />
                <div className="flex flex-col items-center gap-1">
                  <HeadIcon type="center" />
                  <span className="text-[10px] text-text-muted">3. 頭回正</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-1 pt-2 border-t border-white/5">
                <span className="text-[10px] text-text-muted w-10">上一頁</span>
                <div className="flex flex-col items-center gap-1">
                  <HeadIcon type="left" />
                  <span className="text-[10px] text-text-muted">1. 向左看</span>
                </div>
                <ArrowRight className="text-white/20 w-4 h-4" />
                <div className="flex flex-col items-center gap-1">
                  <HeadIcon type="up" />
                  <span className="text-[10px] text-text-muted">2. 向上抬頭</span>
                </div>
                <ArrowRight className="text-white/20 w-4 h-4" />
                <div className="flex flex-col items-center gap-1">
                  <HeadIcon type="center" />
                  <span className="text-[10px] text-text-muted">3. 頭回正</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-bg-warm/50 p-3 rounded-xl border border-white/5">
            <div className="text-xs font-bold text-accent-warm mb-2 flex items-center gap-2">
              <Eye size={14} /> 眨眼模式 (提琴手推薦)
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1 bg-white/5 p-2 rounded-lg text-center flex flex-col items-center gap-1">
                <WinkIcon type="right" />
                <div className="text-[10px] text-text-muted">下一頁</div>
                <div className="text-sm font-bold text-text-warm">單眨右眼</div>
              </div>
              <div className="flex-1 bg-white/5 p-2 rounded-lg text-center flex flex-col items-center gap-1">
                <WinkIcon type="left" />
                <div className="text-[10px] text-text-muted">上一頁</div>
                <div className="text-sm font-bold text-text-warm">單眨左眼</div>
              </div>
            </div>
            <ul className="text-[10px] text-text-muted space-y-1 pl-3 list-disc">
              <li>為避免正常雙眼眨眼誤觸，請確實做出<strong className="text-accent-warm font-normal">「單眼眨眼 (Wink)」</strong>動作。</li>
              <li>相機需清楚捕捉到眼睛，建議在光線充足處使用，並避免鏡片嚴重反光。</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      icon: <BookOpen className="text-accent-warm" />,
      title: "多頁樂譜切換",
      content: "若上傳多張照片，閱覽模式下方會出現「頁碼提示」。點擊數字或左右滑動即可快速切換不同頁面。"
    },
    {
      icon: <Share2 className="text-accent-warm" />,
      title: "存入相簿 (iOS/Android)",
      content: "錄影結束後點擊「分享/存入相簿」，在系統選單選擇「儲存影片」，即可直接存入手機相簿。"
    }
  ];

  const changelog = [
    {
      version: "v2.1.0",
      date: "2026-03-17",
      changes: [
        "✨ 新增「分割畫面」功能：在樂譜檢視器中，可將畫面左右對半切，方便一邊看譜一邊錄影。",
        "✨ 新增「開啟相簿影片」功能：在錄影區塊中，可直接開啟並播放裝置相簿內的影片（如老師的示範影片），支援與樂譜並排顯示。",
        "🎨 優化樂譜檢視器上方工具列：在小螢幕裝置上會自動換行顯示，確保所有按鈕（包含分割畫面）都能直接點擊，無需滑動。",
        "🎨 樂譜檢視器工具列新增獨立「分割畫面」按鈕，操作更直覺。",
        "🐛 修正舊版練習計畫資料導致的白畫面問題。",
        "🐛 修正 iPad 等平板裝置在「符合頁面」模式下，樂譜無法完整全螢幕顯示的跑版問題。",
        "📝 新增 iOS 裝置錄影分享至 LINE 的防黑畫面提示（建議先儲存至相簿再分享）。"
      ]
    },
    {
      version: "v2.0.0",
      date: "2026-03-16",
      changes: [
        "✨ 新增「樂譜資料夾」與「標籤搜尋」管理功能，輕鬆分類大量樂譜。",
        "✨ 新增「練習計畫」功能，可自訂暖身、音階、曲目等練習步驟與時長。",
        "✨ 新增「音樂集點卡」功能，每練習 30 分鐘可獲得音符，集滿解鎖樂器拼圖與終極徽章！",
        "✨ 樂譜檢視器新增「畫筆標註」與「頁面旋轉」功能，並可永久儲存變更。",
        "✨ 新增「練習筆記」功能，計時結束後可記錄練習心得與目標。",
        "✨ 新增「調音器」與「持續音 (Drone Tone) 產生器」功能，即時偵測音準與輔助練習。",
        "✨ 影像紀錄新增「純錄音模式」，節省設備儲存空間。",
        "🐛 修正連續錄影時，部分裝置（如 iOS Safari）會出現黑畫面或無畫面的問題。",
        "⚡ 優化影片存檔機制，確保錄影檔案完整合併後再進行下載或分享。"
      ]
    },
    {
      version: "v1.9.0",
      date: "2026-03-15",
      changes: [
        "✨ 新增「智能翻頁雙模式」：支援「頭部組合動作」與「眨單眼」兩種模式自由切換，滿足不同樂器演奏需求。",
        "🎨 樂譜清單介面優化：移除圖示釋放空間，支援長檔名兩行顯示。",
      ]
    },
    {
      version: "v1.8.0",
      date: "2026-03-13",
      changes: [
        "🎨 頁尾版權資訊更新，新增「聯繫我們」按鈕。",
        "🚀 樂譜上傳影像強化：自動增加對比度與壓縮大小，解決儲存空間不足問題。",
      ]
    },
    {
      version: "v1.7.0",
      date: "2026-03-10",
      changes: [
        "✨ 錄影功能優化：支援相機畫面拖曳至四個角落與縮小顯示，避免遮擋樂譜。",
      ]
    },
    {
      version: "v1.6.0",
      date: "2026-03-05",
      changes: [
        "📊 新增「練習紀錄與統計」功能：支援近七天圖表顯示與郵件分享。",
        "⏱️ 練習倒數計時器優化：新增 15/30/45/60 分鐘快選按鈕。",
      ]
    },
    {
      version: "v1.5.0",
      date: "2026-02-28",
      changes: [
        "🎵 節拍器功能強化：支援拍號設定（如 4/4, 3/4）與精準滑桿控制。",
        "💾 備份與還原功能：支援將所有樂譜匯出為 JSON 備份檔。",
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
      <div 
        className="absolute inset-0 bg-bg-warm/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-2xl bg-surface-warm rounded-[32px] border border-white/5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-white/5 flex flex-col gap-6 bg-surface-warm/50 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent-warm rounded-2xl flex items-center justify-center text-bg-warm">
                <BookOpen size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">使用說明指南</h2>
                <p className="text-text-muted text-xs uppercase tracking-widest font-bold mt-1">User Manual v2.1.0</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-warm"
            >
              <X size={24} />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('guide')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'guide' 
                  ? "bg-accent-warm text-bg-warm shadow-md" 
                  : "text-text-muted hover:text-text-warm hover:bg-white/5"
              )}
            >
              <BookOpen size={16} />
              功能說明
            </button>
            <button
              onClick={() => setActiveTab('changelog')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'changelog' 
                  ? "bg-accent-warm text-bg-warm shadow-md" 
                  : "text-text-muted hover:text-text-warm hover:bg-white/5"
              )}
            >
              <History size={16} />
              版本更新紀錄
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          {activeTab === 'guide' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sections.map((section, index) => (
                  <div key={index} className="bg-white/5 p-6 rounded-2xl border border-white/5 hover:border-accent-warm/30 transition-all group">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      {section.icon}
                    </div>
                    <h3 className="font-bold text-lg mb-2">{section.title}</h3>
                    <p className="text-text-muted text-sm leading-relaxed whitespace-pre-line">{section.content}</p>
                    {section.customContent && section.customContent}
                  </div>
                ))}
              </div>

              {/* Quick Tips */}
              <div className="bg-accent-warm/10 p-6 rounded-2xl border border-accent-warm/20">
                <h3 className="flex items-center gap-2 font-bold text-accent-warm mb-3">
                  <Smartphone size={18} /> 行動裝置小技巧
                </h3>
                <ul className="text-sm space-y-2 text-text-warm/80">
                  <li className="flex gap-2">
                    <span className="text-accent-warm">•</span>
                    <span>在 iPad 上使用時，建議將網頁「加入主畫面」以獲得全螢幕體驗。</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent-warm">•</span>
                    <span>錄影時若遇到權限問題，請檢查瀏覽器的相機與麥克風設定。</span>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {changelog.map((release, index) => (
                <div key={index} className="relative pl-6 border-l-2 border-white/10 pb-6 last:pb-0">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-bg-warm border-2 border-accent-warm" />
                  <div className="flex items-baseline gap-3 mb-3">
                    <h3 className="text-lg font-bold text-accent-warm">{release.version}</h3>
                    <span className="text-xs text-text-muted font-bold tracking-widest">{release.date}</span>
                  </div>
                  <ul className="space-y-3">
                    {release.changes.map((change, cIndex) => (
                      <li key={cIndex} className="text-sm text-text-warm/90 leading-relaxed">
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white/5 flex items-center justify-center">
          <button 
            onClick={onClose}
            className="bg-accent-warm text-bg-warm px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95"
          >
            我知道了，開始練習！
          </button>
        </div>
      </div>
    </div>
  );
};
