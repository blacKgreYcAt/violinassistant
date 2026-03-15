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
  Smile
} from 'lucide-react';
import { cn } from '../lib/utils';

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
      title: "大容量樂譜圖書館",
      content: "全新升級大容量儲存空間！您可以上傳大量 JPG 或 PNG 格式的樂譜照片。若您的樂譜是 PDF，建議先截圖後再上傳。"
    },
    {
      icon: <Edit2 className="text-accent-warm" />,
      title: "編輯樂譜名稱",
      content: "上傳照片後，點擊樂譜右側的「鉛筆圖示」即可自訂樂譜名稱，方便您快速分類與尋找。"
    },
    {
      icon: <Calendar className="text-accent-warm" />,
      title: "練習紀錄與統計",
      content: "計時器結束後會自動記錄練習時間，您也可以手動補登。系統會繪製近七天的練習圖表，並支援將紀錄透過郵件分享。"
    },
    {
      icon: <UploadCloud className="text-accent-warm" />,
      title: "備份與還原",
      content: "提供「下載備份」與「分享/郵件」功能，可將所有樂譜存成一個檔案備份。更換裝置時，使用「匯入備份」即可還原所有內容。"
    },
    {
      icon: <Music className="text-accent-warm" />,
      title: "專業節拍器",
      content: "支援 30-300 BPM。您可以調整拍號（如 4/4, 3/4），並透過滑桿或加減按鈕精準控制節奏。"
    },
    {
      icon: <TimerIcon className="text-accent-warm" />,
      title: "練習倒數計時",
      content: "設定您的練習目標時間。提供 15/30/45/60 分鐘快選，時間結束時會有視覺提醒。"
    },
    {
      icon: <Video className="text-accent-warm" />,
      title: "錄影與相機自訂",
      content: "錄影時可自由拖曳相機畫面至「四個角落」。點擊相機畫面還能「切換大小」，確保不遮擋樂譜重要部分。"
    },
    {
      icon: <Smile className="text-accent-warm" />,
      title: "智能翻頁 (頭部姿態)",
      content: "開啟樂譜後，點擊上方工具列的「智能翻頁」按鈕。透過鏡頭偵測，向右歪頭即可翻到下一頁，向左歪頭翻回上一頁，完全解放雙手！"
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
      version: "v1.9.0",
      date: "2026-03-15",
      changes: [
        "✨ 新增「智能翻頁」功能：透過相機偵測頭部傾斜（向左/向右歪頭）自動翻頁，完全解放雙手。",
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
                <p className="text-text-muted text-xs uppercase tracking-widest font-bold mt-1">User Manual v1.9.0</p>
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
                    <p className="text-text-muted text-sm leading-relaxed">{section.content}</p>
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
