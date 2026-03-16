import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Music, FileText, Trash2, Edit2, Check, X, Camera, Wand2, Download, UploadCloud, Share2, Library, Folder as FolderIcon, Plus, ChevronLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { Score, Folder, getScores, saveScores as saveScoresToDb, getFolders, saveFolders as saveFoldersToDb } from '../lib/storage';

interface ScoreLibraryProps {
  onSelectScore: (score: Score) => void;
  className?: string;
}

export const ScoreLibrary: React.FC<ScoreLibraryProps> = ({ onSelectScore, className }) => {
  const [scores, setScores] = useState<Score[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  useEffect(() => {
    const loadData = async () => {
      const [loadedScores, loadedFolders] = await Promise.all([getScores(), getFolders()]);
      setScores(loadedScores);
      setFolders(loadedFolders);
    };
    loadData();
  }, []);

  const saveScores = async (newScores: Score[]) => {
    try {
      await saveScoresToDb(newScores);
      setScores(newScores);
    } catch (error) {
      console.error("Failed to save scores:", error);
      alert("儲存失敗：設備空間可能不足。");
    }
  };

  const saveFolders = async (newFolders: Folder[]) => {
    try {
      await saveFoldersToDb(newFolders);
      setFolders(newFolders);
    } catch (error) {
      console.error("Failed to save folders:", error);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const newFolder: Folder = {
      id: Math.random().toString(36).substr(2, 9),
      name: newFolderName.trim(),
      color: '#F27D26' // Default color
    };
    await saveFolders([...folders, newFolder]);
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const deleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('確定要刪除這個資料夾嗎？裡面的樂譜將會移出資料夾。')) {
      await saveFolders(folders.filter(f => f.id !== id));
      const newScores = scores.map(s => s.folderId === id ? { ...s, folderId: undefined } : s);
      await saveScores(newScores);
      if (currentFolderId === id) setCurrentFolderId(null);
    }
  };

  const moveToFolder = async (scoreId: string, folderId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    const newScores = scores.map(s => s.id === scoreId ? { ...s, folderId } : s);
    await saveScores(newScores);
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
        folderId: currentFolderId || undefined,
      };
      await saveScores([newScore, ...scores]);
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
    reader.onload = async (event) => {
      try {
        const importedScores = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedScores)) {
          if (confirm(`確定要匯入 ${importedScores.length} 份樂譜嗎？這將會取代目前的圖書館。`)) {
            await saveScores(importedScores);
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

  const saveRename = async (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    if (!editingName.trim()) return;
    
    const newScores = scores.map(s => 
      s.id === id ? { ...s, name: editingName.trim() } : s
    );
    await saveScores(newScores);
    setEditingId(null);
    setEditingName('');
  };

  const deleteScore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await saveScores(scores.filter(s => s.id !== id));
  };

  return (
    <div className="contents">
      {/* Top Card: Upload */}
      <div className={cn("bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5 flex flex-col gap-6", className)}>
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <UploadCloud size={20} className="text-accent-warm" />
            <h2 className="text-lg font-bold tracking-tight text-text-warm">新增樂譜</h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-warm rounded-xl text-xs font-bold transition-all cursor-pointer">
              <UploadCloud size={16} />
              <span className="hidden xl:inline">匯入</span>
              <input type="file" accept=".json" onChange={importLibrary} className="hidden" />
            </label>
            <button 
              onClick={shareLibrary}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent-warm/10 hover:bg-accent-warm/20 text-accent-warm rounded-xl text-xs font-bold transition-all"
              title="分享備份"
            >
              <Share2 size={16} />
              <span className="hidden xl:inline">分享</span>
            </button>
            <button 
              onClick={exportLibrary}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-warm rounded-xl text-xs font-bold transition-all"
            >
              <Download size={16} />
              <span className="hidden xl:inline">下載</span>
            </button>
          </div>
        </div>

        <div 
          {...getRootProps()} 
          className={cn(
            "flex-1 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer min-h-0",
            isDragActive ? "border-accent-warm bg-white/5" : "border-white/10 hover:border-accent-warm/50 hover:bg-white/5"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-text-muted group-hover:text-accent-warm transition-all shrink-0">
            {isUploading ? (
              <div className="w-6 h-6 border-3 border-accent-warm border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={24} />
            )}
          </div>
          <div className="text-center overflow-hidden">
            <p className="text-sm font-bold text-text-warm truncate">點擊或拖曳上傳</p>
            <p className="text-xs text-text-muted mt-1 truncate">支援 JPG、PNG</p>
          </div>
        </div>
      </div>

      {/* Bottom Card: Library List */}
      <div className={cn("bg-surface-warm backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/5 flex flex-col gap-6", className)}>
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {currentFolderId ? (
              <button 
                onClick={() => setCurrentFolderId(null)}
                className="p-1 -ml-1 hover:bg-white/5 rounded-lg transition-colors text-text-muted hover:text-text-warm"
              >
                <ChevronLeft size={20} />
              </button>
            ) : (
              <Library size={20} className="text-accent-warm" />
            )}
            <h2 className="text-lg font-bold tracking-tight text-text-warm">
              {currentFolderId ? folders.find(f => f.id === currentFolderId)?.name : '樂譜清單'}
            </h2>
          </div>
          {!currentFolderId && (
            <button 
              onClick={() => setShowNewFolder(true)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-warm"
              title="新增資料夾"
            >
              <Plus size={20} />
            </button>
          )}
        </div>

        {showNewFolder && !currentFolderId && (
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="資料夾名稱"
              className="flex-1 bg-transparent border-none text-sm text-text-warm focus:outline-none px-2"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
            />
            <button onClick={createFolder} className="p-1 text-accent-warm hover:bg-accent-warm/20 rounded-lg">
              <Check size={16} />
            </button>
            <button onClick={() => setShowNewFolder(false)} className="p-1 text-text-muted hover:bg-white/10 rounded-lg">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3 min-h-0">
          {!currentFolderId && folders.map(folder => (
            <div 
              key={folder.id}
              onClick={() => setCurrentFolderId(folder.id)}
              className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-accent-warm/30 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-accent-warm/10 flex items-center justify-center shrink-0">
                  <FolderIcon size={20} className="text-accent-warm" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-text-warm truncate">{folder.name}</span>
                  <span className="text-xs text-text-muted truncate">
                    {scores.filter(s => s.folderId === folder.id).length} 份樂譜
                  </span>
                </div>
              </div>
              <button 
                onClick={(e) => deleteFolder(folder.id, e)}
                className="p-2 text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-white/5"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {scores
            .filter(s => currentFolderId ? s.folderId === currentFolderId : !s.folderId)
            .map(score => (
            <div 
              key={score.id}
              onClick={() => onSelectScore(score)}
              className="group flex items-center gap-3 p-3 bg-surface-warm border border-white/5 rounded-2xl hover:border-accent-warm hover:shadow-lg hover:shadow-accent-warm/5 transition-all cursor-pointer"
            >
              <div className="flex-1 min-w-0 flex flex-col justify-center">
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
                      className="flex-1 bg-bg-warm border border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-text-warm outline-none focus:ring-2 focus:ring-accent-warm/20 min-w-0"
                    />
                    <button 
                      onClick={(e) => saveRename(e, score.id)}
                      className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors shrink-0"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={cancelEditing}
                      className="p-1.5 text-text-muted hover:bg-white/5 rounded-md transition-colors shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-text-warm line-clamp-2 leading-tight group-hover:text-accent-warm transition-colors pr-2">{score.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">
                        {new Date(score.date).toLocaleDateString()}
                      </p>
                      {Array.isArray(score.data) && (
                        <span className="text-[10px] bg-accent-warm/10 text-accent-warm px-1.5 py-0.5 rounded-md font-bold">
                          {score.data.length} 頁
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {folders.length > 0 && (
                  <div className="relative group/menu">
                    <button 
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-text-muted hover:text-accent-warm hover:bg-white/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="移動到資料夾"
                    >
                      <FolderIcon size={16} />
                    </button>
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/menu:block bg-surface-warm border border-white/10 rounded-xl shadow-xl p-2 min-w-[150px] z-10">
                      <div className="text-xs font-bold text-text-muted mb-2 px-2">移動到...</div>
                      {currentFolderId && (
                        <button 
                          onClick={(e) => moveToFolder(score.id, undefined, e)}
                          className="w-full text-left px-2 py-1.5 text-sm text-text-warm hover:bg-white/5 rounded-lg"
                        >
                          (移出資料夾)
                        </button>
                      )}
                      {folders.filter(f => f.id !== currentFolderId).map(f => (
                        <button 
                          key={f.id}
                          onClick={(e) => moveToFolder(score.id, f.id, e)}
                          className="w-full text-left px-2 py-1.5 text-sm text-text-warm hover:bg-white/5 rounded-lg truncate"
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {editingId !== score.id && (
                  <button 
                    onClick={(e) => startEditing(e, score)}
                    className="p-1.5 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                <button 
                  onClick={(e) => deleteScore(score.id, e)}
                  className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          
          {scores.length === 0 && folders.length === 0 && !currentFolderId && (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 py-8">
              <Music size={32} strokeWidth={1} />
              <p className="text-sm font-bold mt-2">目前沒有樂譜</p>
              <p className="text-xs">請從上方上傳或匯入</p>
            </div>
          )}
          {scores.filter(s => s.folderId === currentFolderId).length === 0 && currentFolderId && (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 py-8">
              <FolderIcon size={32} strokeWidth={1} />
              <p className="text-sm font-bold mt-2">資料夾是空的</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
