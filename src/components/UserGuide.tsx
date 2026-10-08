import React, { useState } from 'react';
import {
  Gauge,
  EyeOff,
 
  Music, 
  Library, 
  Video, 
  Timer as TimerIcon, 
  Share2, 
  X,
  BookOpen,
  Smartphone,
  Edit2,
  UploadCloud,
  Calendar,
  History,
  Smile,
  ArrowRight,
  Eye,
  Star,
  Moon,
  Activity,
  TrendingUp
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

    // 明確標註型別：只有部分項目有 className / customContent，
    // 不標的話 TS 會推出聯集型別，存取 className 就得靠 (section as any) 繞過。
    const sections: {
      icon: React.ReactNode;
      title: string;
      content: string;
      className?: string;
      customContent?: React.ReactNode;
    }[] = [
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
      content: "點擊右上角的「星星」圖示開啟集點卡！每完成 30 分鐘的練習即可獲得 1 個音符 🎵。集滿 10 個音符可獲得隨機的「樂器拼圖碎片」，集滿所有拼圖即可解鎖終極徽章「首席演奏家」！"
    },
    {
      icon: <Calendar className="text-accent-warm" />,
      title: "練習紀錄與筆記",
      content: "計時器結束後會自動記錄練習時間，您還可以填寫「練習筆記」記錄心得與目標，並指定這次練的是哪一首曲子（預設帶入最近開啟過的樂譜，可以改選別首或清成「未指定」）。累計時間會顯示在樂譜檢視器的「速度與節拍器」面板裡。系統也會繪製近七天的練習圖表，並支援將紀錄透過郵件分享。"
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
      icon: <Star className="text-accent-warm" />,
      title: "曲目熟練度管理",
      content: "在樂譜檢視器中，點擊星星圖示可設定該曲目的「熟練度」。從 0%（剛開始）到 100%（已精通），圖書館清單會同步顯示進度，幫助您掌握練習成效。"
    },
    {
      icon: <Gauge className="text-accent-warm" />,
      title: "影片慢速播放",
      content: "播放示範影片或回放自己的錄影時，下方會出現速度控制（0.25x～1.5x）。\n\n用 0.5 倍看老師的運弓與換把特別清楚；慢速播放會保留原本的音高，不會像錄音帶轉慢那樣整個走音。"
    },
    {
      icon: <EyeOff className="text-accent-warm" />,
      title: "靜音小節",
      content: "點節拍器上方的「靜音小節」開啟，可設定「響 N 小節、靜 M 小節」。\n\n靜音期間要靠自己維持速度，等拍子重新響起就能知道有沒有跑掉 —— 這是老師很常要求的節奏訓練方式。為了不洩漏拍子位置，靜音期間拍點燈號也會一起隱藏。"
    },
    {
      icon: <Activity className="text-accent-warm" />,
      title: "節拍器細分拍",
      content: "節拍器拍號旁邊的選單可以切換「不細分／八分／三連音／十六分」。\n\n細分出來的點會用比較輕、比較高的音色，和正拍明顯區分，慢練時才聽得出拍子的骨架在哪裡。"
    },
    {
      icon: <TrendingUp className="text-accent-warm" />,
      title: "曲目速度進展",
      content: "在樂譜檢視器右側點「速度與節拍器」，可以看到這首曲子的練習速度曲線。開啟節拍器練習時，停止後會自動記錄當天練到的最高速度（每天只留最高的一筆）。",
      className: "md:col-span-2"
    },
    {
      icon: <TrendingUp className="text-accent-warm" />,
      title: "進階節拍器 (速度漸進模式)",
      content: "點擊節拍器右上角的「漸進」按鈕，可設定「目標速度」、「每次增加量」及「間隔小節」。節拍器會隨練習自動提速，是練習快速樂段的最佳工具。"
    },
    {
      icon: <Moon className="text-accent-warm" />,
      title: "樂譜深色模式 (反相顯示)",
      content: "點擊工具列的「深色模式」按鈕，可將樂譜圖片直接反相顯示（變為黑底白字）。這在光線較暗的環境下練習非常實用，能有效減少眼睛疲勞。"
    },
    {
      icon: <Smile className="text-accent-warm" />,
      title: "智能翻頁 (水平/橫放模式)",
      content: "開啟樂譜後點擊上方「智能翻頁」。支援「水平」與「橫放」兩種模式，旁邊的小按鈕可切換「頭部動作」或「眨眼」模式。為避免連續誤觸，每次翻頁後有「2 秒鐘冷卻時間」。",
      className: "md:col-span-2",
      customContent: (
        <div className="mt-4 space-y-4">
          <div className="bg-bg-warm/50 p-4 rounded-2xl border border-white/5">
            <div className="text-sm font-bold text-accent-warm mb-3 flex items-center gap-2">
              <Smile size={16} /> 水平/橫放模式 (頭部動作)
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-muted w-12 font-bold">下一頁</span>
                <div className="flex flex-col items-center gap-2">
                  <HeadIcon type="right" />
                  <span className="text-xs text-text-muted font-bold">1. 向右看</span>
                </div>
                <ArrowRight className="text-white/20 w-5 h-5" />
                <div className="flex flex-col items-center gap-2">
                  <HeadIcon type="down" />
                  <span className="text-xs text-text-muted font-bold">2. 向下點頭</span>
                </div>
                <ArrowRight className="text-white/20 w-5 h-5" />
                <div className="flex flex-col items-center gap-2">
                  <HeadIcon type="center" />
                  <span className="text-xs text-text-muted font-bold">3. 頭回正</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-4 border-t border-white/5">
                <span className="text-xs text-text-muted w-12 font-bold">上一頁</span>
                <div className="flex flex-col items-center gap-2">
                  <HeadIcon type="left" />
                  <span className="text-xs text-text-muted font-bold">1. 向左看</span>
                </div>
                <ArrowRight className="text-white/20 w-5 h-5" />
                <div className="flex flex-col items-center gap-2">
                  <HeadIcon type="up" />
                  <span className="text-xs text-text-muted font-bold">2. 向上抬頭</span>
                </div>
                <ArrowRight className="text-white/20 w-5 h-5" />
                <div className="flex flex-col items-center gap-2">
                  <HeadIcon type="center" />
                  <span className="text-xs text-text-muted font-bold">3. 頭回正</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-bg-warm/50 p-4 rounded-2xl border border-white/5">
            <div className="text-sm font-bold text-accent-warm mb-3 flex items-center gap-2">
              <Eye size={16} /> 眨眼模式 (演奏者推薦)
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 bg-white/5 p-3 rounded-xl text-center flex flex-col items-center gap-2">
                <WinkIcon type="right" />
                <div className="text-xs text-text-muted font-bold">下一頁</div>
                <div className="text-base font-bold text-text-warm">單眨右眼</div>
              </div>
              <div className="flex-1 bg-white/5 p-3 rounded-xl text-center flex flex-col items-center gap-2">
                <WinkIcon type="left" />
                <div className="text-xs text-text-muted font-bold">上一頁</div>
                <div className="text-base font-bold text-text-warm">單眨左眼</div>
              </div>
            </div>
            <ul className="text-xs text-text-muted space-y-2 pl-4 list-disc leading-relaxed">
              <li>為避免正常雙眼眨眼誤觸，請確實做出<strong className="text-accent-warm font-bold">「單眼眨眼 (Wink)」</strong>動作。</li>
              <li>相機需清楚捕捉到眼睛，建議在光線充足處使用，並避免鏡片嚴重反光。</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      icon: <BookOpen className="text-accent-warm" />,
      title: "多頁樂譜切換",
      content: "若上傳多張照片，閱覽模式下方會出現「頁碼提示」。點擊數字或左右滑動即可快速切換不同頁面。",
      className: "md:col-span-2"
    },
    {
      icon: <Video className="text-accent-warm" />,
      title: "練習錄影總覽",
      content: "點右上角的「練習錄影」可以看到所有錄影，不必先開啟樂譜。\n\n錄製時沒有對應樂譜也沒關係（例如只是想拉音階看音準），之後在這裡用「歸屬曲目」下拉選單指定即可；指定後該段錄影也會出現在樂譜檢視器的「本曲錄影紀錄」中。"
    },
    {
      icon: <Activity className="text-accent-warm" />,
      title: "音準回放分析",
      content: "在樂譜檢視器右側點「本曲錄影紀錄」，可以看到每段錄影的音準曲線：綠色代表準、黃色是輕微偏離、紅色是明顯偏離，中間的綠色帶是 ±10 音分的容許範圍。\n\n下方的「最需要注意的片段」會列出偏離最久、最嚴重的幾個地方，點下去就會直接跳到影片的那一秒，可以馬上聽自己當時拉成什麼樣子。",
      className: "md:col-span-2"
    },
    {
      icon: <Share2 className="text-accent-warm" />,
      title: "存入相簿 (iOS/Android)",
      content: "錄影結束後點擊「分享/存入相簿」，在系統選單選擇「儲存影片」，即可直接存入手機相簿。"
    }
  ];

  const changelog = [
    {
      version: "v2.5.0",
      date: "2026-10-07",
      changes: [
        "🥁 節拍器新增「細分拍」：可切換八分音符、三連音、十六分音符。細分出來的點音量較輕、音高較高，與正拍明顯區分，是慢練時最常用到的功能之一。",
        "📈 「速度紀錄」改為進展圖：直接看出「幾天內從多少練到多少」與進步幅度，不再只是一張數字清單。",
        "♿ 樂譜檢視器側欄的按鈕補上名稱，螢幕閱讀器現在能正確辨識（原本有 6 顆只有圖示）。",
        "🔇 節拍器新增「靜音小節」：可設定響幾小節後停幾小節，由自己維持速度，再用重新響起的拍子檢驗有沒有跑掉。靜音期間拍點燈號也會一併隱藏。",
        "🐢 影片新增播放速度控制（0.25x～1.5x）：看老師的示範影片或回放自己的錄影都適用，慢速時會保留原本的音高。",
        "🎼 練習時間可以關聯到曲目：記錄練習時會預選最近開啟過的樂譜，可改選別首或清成「未指定」。樂譜檢視器的「速度與節拍器」面板會顯示該曲的累計練習時間。",
        "🐛 修正練習結束後的「練習筆記」與「獲得音符」彈窗位置錯誤的問題：原本是對齊計時器卡片而不是螢幕，在手機寬度下會整個跑到畫面外看不到。",
        "♿ 樂譜檢視器的「關閉」與面板收起按鈕補上名稱（先前只修了側欄那一排）。"
      ]
    },
    {
      version: "v2.4.0",
      date: "2026-10-07",
      changes: [
        "🎬 新增「練習錄影總覽」：點右上角即可查看所有錄影，不必先開啟樂譜。沒有指定曲目的錄影（例如單純練音階）之後也能在這裡補指定。",
        "🎯 新增「音準回放分析」：錄影時偵測到的音準資料現在會畫成曲線，可以看到整段練習哪裡準、哪裡偏高或偏低。",
        "🔎 分析結果會列出「最需要注意的片段」，點擊即可直接跳到影片的該時間點重聽。",
        "📊 同時顯示準確率、平均偏差，以及整體偏高／偏低的傾向（例如把位整體偏了）。",
        "♿ 修正「本曲錄影紀錄」按鈕在螢幕閱讀器下只會被念成數字的問題。"
      ]
    },
    {
      version: "v2.3.0",
      date: "2026-10-01",
      changes: [
        "🐛 修正節拍器速度被調到下限以下時，可能造成整個頁面卡住無回應的問題。",
        "🐛 修正「儲存至 App」的錄影無法在該樂譜中找到的問題；並新增「本曲錄影紀錄」面板，可直接播放與刪除過往錄影。",
        "🔒 修正關閉調音器後麥克風仍持續運作的問題（錄音指示燈不會再一直亮著）。",
        "⏱️ 練習計時器改以時間戳計算：螢幕關閉或切換到其他 App 時，不會再少算練習時間。",
        "🐛 修正錄影時「音準分析」圖表一片空白，以及長時間錄影會越來越卡頓的問題。",
        "🐛 修正節拍器播放中按「靜音」沒有反應的問題；節拍燈號現在會與聲音同步（原本最多會快 100 毫秒）。",
        "🐛 修正樂譜旋轉後，畫筆標註位置會偏掉的問題。",
        "🐛 修正以 ESC 離開全螢幕後，全螢幕按鈕狀態顯示錯誤的問題。",
        "⚡ 大幅優化調音器的音高偵測效能，改善手機發燙與畫面卡頓。",
        "🐛 修正樂譜較多時「下載備份」會失敗的問題。",
        "🐛 修正上傳樂譜失敗時沒有任何提示、以及遇到損壞檔案會一直卡在上傳中的問題。",
        "🛡️ 匯入備份時會先驗證檔案內容，避免選錯檔案就把整個圖書館覆蓋掉。",
        "📈 「速度紀錄」功能正式生效：節拍器停止後會自動記錄該曲練習到的最高速度。",
        "✨ 開場畫面可點擊直接跳過，不必每次等待。",
        "🔧 修復「練習計畫」與「練習目標」無法進入的問題：這兩個功能先前因改版而未被掛上畫面，現已恢復至「練習紀錄」旁。點擊計畫的「開始練習」會自動跳到練習工具分頁並載入計時器。",
        "🐛 修正平板上「練習紀錄」被切掉且無法捲動的問題（1024×768 時原本有近 380px 的內容完全看不到）。",
        "🐛 修正「本週練習時數」圖表誤把所有歷史紀錄都加總的問題，現在只統計本週。"
      ]
    },
    {
      version: "v2.2.1",
      date: "2026-03-18",
      changes: [
        "🐛 修復「分割畫面」模式下，錄影區塊與相簿影片無法正常顯示（黑畫面）的問題。",
        "🎨 優化「分割畫面」在大螢幕下的比例，讓左側樂譜能獲得更完整的顯示空間。",
        "🐛 修正「智能翻頁」邏輯，還原為說明書記載的標準動作（頭部組合動作與單眼眨眼），並恢復 2 秒防誤觸冷卻時間。"
      ]
    },
    {
      version: "v2.2.0",
      date: "2026-03-18",
      changes: [
        "🏆 新增「曲目熟練度管理」：在樂譜檢視器中設定熟練度（0-100%），圖書館會顯示星等與進度。",
        "📈 新增「進階節拍器：速度漸進模式」：可設定目標速度與增加間隔，自動隨練習進度提升 BPM。",
        "✨ 新增樂譜「深色模式」：支援將圖片樂譜反相顯示（黑底白字）。"
      ]
    },
    {
      version: "v2.1.2",
      date: "2026-03-18",
      changes: [
        "✨ 新增樂譜「深色模式」：支援將圖片樂譜反相顯示（黑底白字），減少長時間看譜的眼睛疲勞。",
        "🎨 優化工具列排版，新增深色模式切換按鈕。"
      ]
    },
    {
      version: "v2.1.1",
      date: "2026-03-18",
      changes: [
        "🎨 優化「使用說明」排版：將「智能翻頁」與「多頁樂譜切換」改為全寬顯示，消除排版空白。",
        "📝 更新「智能翻頁」說明，新增「水平」與「橫放」模式支援說明。"
      ]
    },
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
                <p className="text-text-muted text-xs uppercase tracking-widest font-bold mt-1">User Manual v2.5.0</p>
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
                  <div key={index} className={cn("bg-white/5 p-6 rounded-2xl border border-white/5 hover:border-accent-warm/30 transition-all group", section.className)}>
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
