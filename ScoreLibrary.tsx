import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Music, FileText, Trash2, Edit2, Check, X, Camera, Wand2 } from 'lucide-react';
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
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [showCapturePreview, setShowCapturePreview] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const saveScores = (newScores: Score[]) => {
    setScores(newScores);
    localStorage.setItem('viola-scores', JSON.stringify(newScores));
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

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 對比度係數 (1.5 表示增加 50% 對比)
        const contrast = 1.4; 
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
          // 針對 R, G, B 分別進行對比強化，保留色彩
          data[i] = factor * (data[i] - 128) + 128;     // R
          data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
          data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
          // Alpha (data[i+3]) 保持不變
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = base64;
    });
  };

  const processFiles = async (files: File[], isCapture = false) => {
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
      
      if (isCapture) {
        setPendingPhotos(prev => [...prev, ...results]);
        setShowCapturePreview(true);
      } else {
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
      }
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveCapture = () => {
    if (pendingPhotos.length === 0) return;
    
    const newScore: Score = {
      id: Math.random().toString(36).substr(2, 9),
      name: `新掃描樂譜 ${new Date().toLocaleTimeString()} (${pendingPhotos.length} 頁)`,
      type: 'file',
      data: pendingPhotos.length === 1 ? pendingPhotos[0] : pendingPhotos,
      date: Date.now(),
    };
    
    saveScores([newScore, ...scores]);
    setPendingPhotos([]);
    setShowCapturePreview(false);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    processFiles(acceptedFiles);
  }, [scores]);

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files), true);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
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
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-text-warm">樂譜圖書館</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 檔案上傳區 */}
        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer",
            isDragActive ? "border-accent-warm bg-white/5" : "border-white/10 hover:border-accent-warm/50 hover:bg-white/5"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-text-muted">
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-accent-warm border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={20} />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-text-warm">上傳樂譜</p>
            <p className="text-[10px] text-text-muted mt-0.5">PDF 或圖片</p>
          </div>
        </div>

        {/* 相機拍照區 */}
        <button 
          onClick={() => cameraInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 hover:border-accent-warm/50 hover:bg-white/5 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 transition-all"
        >
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={cameraInputRef}
            onChange={handleCameraCapture}
            multiple
          />
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-text-muted">
            <Camera size={20} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-text-warm">拍照掃描</p>
            <p className="text-[10px] text-accent-warm flex items-center gap-1 justify-center">
              <Wand2 size={10} /> 自動黑白強化
            </p>
          </div>
        </button>
      </div>

      {/* 拍照預覽與多頁管理 */}
      {showCapturePreview && (
        <div className="fixed inset-0 z-[100] bg-bg-warm/95 backdrop-blur-xl flex flex-col p-4 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-text-warm">掃描預覽</h2>
              <p className="text-xs text-text-muted uppercase tracking-widest font-bold">已拍攝 {pendingPhotos.length} 頁</p>
            </div>
            <button 
              onClick={() => {
                setPendingPhotos([]);
                setShowCapturePreview(false);
              }}
              className="p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-x-auto flex gap-4 pb-4 scrollbar-hide items-center">
            {pendingPhotos.map((photo, idx) => (
              <div key={idx} className="relative shrink-0 group">
                <img 
                  src={photo} 
                  alt={`Page ${idx + 1}`} 
                  className="h-[40vh] sm:h-[50vh] rounded-2xl shadow-2xl border border-white/10"
                />
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold">
                  第 {idx + 1} 頁
                </div>
                <button 
                  onClick={() => setPendingPhotos(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            
            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="h-[40vh] sm:h-[50vh] aspect-[3/4] border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 text-text-muted hover:border-accent-warm hover:text-text-warm transition-all group"
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-accent-warm group-hover:text-bg-warm transition-all">
                <Camera size={24} />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest">繼續拍攝下一頁</p>
            </button>
          </div>

          <div className="mt-8 flex gap-4">
            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 py-4 bg-white/5 text-text-warm rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Camera size={20} /> 繼續拍攝
            </button>
            <button 
              onClick={handleSaveCapture}
              className="flex-[2] py-4 bg-accent-warm text-bg-warm rounded-2xl font-bold hover:shadow-lg hover:shadow-accent-warm/20 transition-all flex items-center justify-center gap-2"
            >
              <Check size={20} /> 完成並存檔 ({pendingPhotos.length} 頁)
            </button>
          </div>
        </div>
      )}

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
