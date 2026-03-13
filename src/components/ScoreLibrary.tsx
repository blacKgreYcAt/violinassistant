import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Music, FileText, Trash2, Edit2, Check, X, Camera, Wand2, Download, UploadCloud, Share2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Score {
  id: string;
  name: string;
  type: 'file' | 'link';
  data: string | string[]; // base64 for file, URL for link, or array for multi-page
  date: number;
}

interface ScoreLibraryProps {
  onSelectScore: (score: Score) => void;
  className?: string;
}

export const ScoreLibrary: React.FC<ScoreLibraryProps> = ({ onSelectScore, className }) => {
  const [scores, setScores] = useState<Score[]>(() => {
    const saved = localStorage.getItem('viola-scores');
    return saved ? JSON.parse(saved) : [];
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const saveScores = (newScores: Score[]) => {
    try {
      setScores(newScores);
      localStorage.setItem('viola-scores', JSON.stringify(newScores));
    } catch (error) {
      console.error("Failed to save scores:", error);
      alert("儲存失敗：可能是因為樂譜檔案太大，導致瀏覽器空間不足。請嘗試刪除一些舊樂譜或減少拍照張數。");
    }
  };

  // 影像處理：彩色對比強化 (Color Contrast Enhancement)
  const enhanceImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64);
          return;
        }

        // 縮小圖片尺寸以節省空間 (Max width 1600px)
        const MAX_WIDTH = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 對比度係數 (1.4 表示增加 40% 對比)
        const contrast = 1.4; 
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
          data[i] = factor * (data[i] - 128) + 128;     // R
          data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
          data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
        }

        ctx.putImageData(imageData, 0, 0);
        // 降低品質至 0.6 以顯著減少檔案大小
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = base64;
    });
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);

    try {
      const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      const filePromises = sortedFiles.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result as string;
            if (file.type.startsWith('image/')) {
              const enhanced = await enhanceImage(base64);
              resolve(enhanced);
            } else {
              resolve(base64);
            }
          };
          reader.readAsDataURL(file);
        });
      });

      const results = await Promise.all(filePromises);
      
      const newScore: Score = {
        id: Math.random().toString(36).substr(2, 9),
        name: sortedFiles.length > 1 
          ? sortedFiles[0].name.replace(/\.[^/.]+$/, "") + " (多頁)"
          : sortedFiles[0].name.replace(/\.[^/.]+$/, ""),
        type: 'file',
        data: results.length === 1 ? results[0] : results,
        date: Date.now(),
      };
      saveScores([newScore, ...scores]);
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    processFiles(acceptedFiles);
  }, [scores]);

  const exportLibrary = () => {
    try {
      const dataStr = JSON.stringify(scores);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `viola-scores-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error("Export failed:", error);
      alert("匯出失敗，請稍後再試。");
    }
  };

  const shareLibrary = async () => {
    try {
      const dataStr = JSON.stringify(scores);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const fileName = `viola-scores-backup-${new Date().toISOString().split('T')[0]}.json`;
      const file = new File([blob], fileName, { type: 'application/json' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '樂譜圖書館備份',
          text: '這是我的提琴練習小幫手樂譜備份檔案。',
        });
      } else {
        // Fallback to download if sharing is not supported
        exportLibrary();
      }
    } catch (error) {
      console.error("Share failed:", error);
      // If user cancels or error occurs, don't necessarily alert unless it's a real error
      if ((error as any).name !== 'AbortError') {
        exportLibrary();
      }
    }
  };

  const importLibrary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedScores = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedScores)) {
          if (confirm(`確定要匯入 ${importedScores.length} 份樂譜嗎？這將會取代目前的圖書館。`)) {
            saveScores(importedScores);
            alert("匯入成功！");
          }
        } else {
          alert("無效的備份檔案格式。");
        }
      } catch (error) {
        console.error("Import failed:", error);
        alert("匯入失敗：檔案格式錯誤。");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg']
    }
  });

  const startEditing = (e: React.MouseEvent, score: Score) => {
    e.stopPropagation();
    setEditingId(score.id);
    setEditingName(score.name);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingName('');
  };

  const saveRename = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    if (!editingName.trim()) return;
    
    const newScores = scores.map(s => 
      s.id === id ? { ...s, name: editingName.trim() } : s
    );
    saveScores(newScores);
    setEditingId(null);
    setEditingName('');
  };

  const deleteScore = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveScores(scores.filter(s => s.id !== id));
  };

  return (
    <div className={cn("flex flex-col gap-6 h-full", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-text-warm">樂譜圖書館</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-warm rounded-xl text-xs font-bold transition-all cursor-pointer">
            <UploadCloud size={16} />
            <span className="hidden lg:inline">匯入備份</span>
            <input type="file" accept=".json" onChange={importLibrary} className="hidden" />
          </label>
          <button 
            onClick={shareLibrary}
            className="flex items-center gap-2 px-4 py-2 bg-accent-warm/10 hover:bg-accent-warm/20 text-accent-warm rounded-xl text-xs font-bold transition-all"
            title="分享備份 (可發送郵件)"
          >
            <Share2 size={16} />
            <span>分享/郵件</span>
          </button>
          <button 
            onClick={exportLibrary}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-warm rounded-xl text-xs font-bold transition-all"
          >
            <Download size={16} />
            <span className="hidden lg:inline">下載備份</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* 檔案上傳區 */}
        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer",
            isDragActive ? "border-accent-warm bg-white/5" : "border-white/10 hover:border-accent-warm/50 hover:bg-white/5"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-text-muted group-hover:text-accent-warm transition-all">
            {isUploading ? (
              <div className="w-8 h-8 border-3 border-accent-warm border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={32} />
            )}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-text-warm">點擊或拖曳上傳樂譜照片</p>
            <p className="text-sm text-text-muted mt-1">支援 JPG、PNG 格式 (建議先將 PDF 截圖後上傳)</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted mt-2">您的樂譜</h3>
        {scores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
            <Music size={48} strokeWidth={1} />
            <p className="text-sm font-medium">圖書館中尚無樂譜</p>
          </div>
        ) : (
          scores.map(score => (
            <div 
              key={score.id}
              onClick={() => onSelectScore(score)}
              className="group flex items-center gap-4 p-4 bg-surface-warm border border-white/5 rounded-2xl hover:border-accent-warm hover:shadow-lg hover:shadow-accent-warm/5 transition-all cursor-pointer"
            >
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-text-muted group-hover:bg-accent-warm group-hover:text-bg-warm transition-colors">
                <FileText size={20} />
              </div>
              <div className="flex-1 min-w-0">
                {editingId === score.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(e, score.id);
                        if (e.key === 'Escape') cancelEditing(e as any);
                      }}
                      className="flex-1 bg-bg-warm border border-white/10 rounded-lg px-2 py-1 text-sm font-bold text-text-warm outline-none focus:ring-2 focus:ring-accent-warm/20"
                    />
                    <button 
                      onClick={(e) => saveRename(e, score.id)}
                      className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={cancelEditing}
                      className="p-1 text-text-muted hover:bg-white/5 rounded-md transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="font-bold text-text-warm truncate">{score.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">
                        {new Date(score.date).toLocaleDateString()}
                      </p>
                      {Array.isArray(score.data) && (
                        <span className="text-[10px] bg-accent-warm/10 text-accent-warm px-1.5 py-0.5 rounded-md font-bold">
                          {score.data.length} 頁
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {editingId !== score.id && (
                  <button 
                    onClick={(e) => startEditing(e, score)}
                    className="p-2 text-text-muted hover:text-text-warm transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                <button 
                  onClick={(e) => deleteScore(score.id, e)}
                  className="p-2 text-text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
