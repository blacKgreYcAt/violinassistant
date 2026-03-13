import React from 'react';
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
  UploadCloud
} from 'lucide-react';
import { cn } from '../lib/utils';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuide: React.FC<UserGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = [
    {
      icon: <Library className="text-accent-warm" />,
      title: "樂譜圖書館",
      content: "您可以上傳 JPG 或 PNG 格式的樂譜照片。若您的樂譜是 PDF，建議先截圖後再上傳。點擊樂譜即可進入「閱覽模式」。"
    },
    {
      icon: <Edit2 className="text-accent-warm" />,
      title: "編輯樂譜名稱",
      content: "上傳照片後，點擊樂譜右側的「鉛筆圖示」即可自訂樂譜名稱，方便您快速分類與尋找。"
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
      title: "錄影存檔功能",
      content: "在練習時錄製影片。錄製完成後可即時預覽，並支援下載或直接分享至相簿。"
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
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-surface-warm/50 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-warm rounded-2xl flex items-center justify-center text-bg-warm">
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">使用說明指南</h2>
              <p className="text-text-muted text-xs uppercase tracking-widest font-bold mt-1">User Manual v1.7.4</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-warm"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
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
