import React, { useState, useRef, useCallback } from 'react';
import { Video, VideoOff, Download, Camera, StopCircle, Share2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface VideoRecorderProps {
  activeScoreName?: string;
  className?: string;
  isMinimized?: boolean;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({ activeScoreName, className, isMinimized }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Keep video preview in sync with stream
  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [stream, isCameraOn]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      // More flexible constraints to avoid failures on some devices
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraOn(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("無法存取相機或麥克風，請檢查權限設定。建議使用 Safari (iOS) 或 Chrome (Android/PC)。");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOn(false);
    setIsRecording(false);
    setRecordedChunks([]);
  };

  const startRecording = useCallback(() => {
    if (!stream) return;
    
    setRecordedChunks([]);
    setPreviewUrl(null);
    
    // Better mimeType detection for cross-browser compatibility
    // Prioritize MP4/QuickTime for iOS/iPadOS compatibility with Photos app
    const mimeTypes = [
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/quicktime',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,vorbis',
      'video/webm'
    ];
    
    let selectedMimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }

    try {
      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: selectedMimeType || 'video/mp4' });
        const url = URL.createObjectURL(finalBlob);
        setPreviewUrl(url);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (e) {
      console.error("MediaRecorder start error:", e);
      alert("錄影啟動失敗，請重新開啟相機再試一次。");
    }
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const downloadVideo = () => {
    if (recordedChunks.length === 0 && !previewUrl) {
      alert("尚未取得錄影資料，請稍候再試。");
      return;
    }

    const mimeType = mediaRecorderRef.current?.mimeType || 'video/mp4';
    const blob = new Blob(recordedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    
    const date = new Date().toISOString().split('T')[0];
    let extension = 'mp4';
    if (mimeType.includes('webm')) extension = 'webm';
    if (mimeType.includes('quicktime')) extension = 'mov';
    
    const fileName = `${date}_${activeScoreName || '練習錄影'}.${extension}`;
    
    a.download = fileName;
    a.click();
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  };

  const shareVideo = async () => {
    if (recordedChunks.length === 0 && !previewUrl) {
      alert("尚未取得錄影資料。");
      return;
    }

    try {
      const mimeType = mediaRecorderRef.current?.mimeType || 'video/mp4';
      const blob = new Blob(recordedChunks, { type: mimeType });
      
      const date = new Date().toISOString().split('T')[0];
      let extension = 'mp4';
      if (mimeType.includes('webm')) extension = 'webm';
      if (mimeType.includes('quicktime')) extension = 'mov';
      
      const fileName = `${date}_${activeScoreName || '練習錄影'}.${extension}`;
      const file = new File([blob], fileName, { type: mimeType });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '練習錄影',
          text: `這是我的提琴練習錄影：${activeScoreName || ''}`,
        });
      } else {
        downloadVideo();
      }
    } catch (error) {
      console.error("Share video failed:", error);
      if ((error as any).name !== 'AbortError') {
        downloadVideo();
      }
    }
  };

  return (
    <div className={cn(
      "bg-surface-warm backdrop-blur-md rounded-3xl shadow-xl border border-white/5 transition-all overflow-hidden", 
      isMinimized ? "p-2" : "p-6",
      className
    )}>
      <div className="flex flex-col gap-4">
        {!isMinimized && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera size={20} className="text-text-muted" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">練習錄影作業</h3>
            </div>
            {isCameraOn && (
              <button 
                onClick={() => {
                  stopCamera();
                  setPreviewUrl(null);
                }}
                className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
              >
                關閉相機
              </button>
            )}
          </div>
        )}

        {!isCameraOn ? (
          <div className={cn(
            "flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/10 rounded-2xl bg-white/5",
            isMinimized ? "py-4" : "py-8"
          )}>
            <div className={cn("bg-white/5 rounded-full flex items-center justify-center text-text-muted", isMinimized ? "w-10 h-10" : "w-16 h-16")}>
              <Video size={isMinimized ? 20 : 32} />
            </div>
            {!isMinimized && (
              <div className="text-center">
                <p className="font-bold text-text-warm">準備好交作業了嗎？</p>
                <p className="text-xs text-text-muted mt-1">點擊下方按鈕開啟相機進行錄影</p>
              </div>
            )}
            <button 
              onClick={startCamera}
              className={cn(
                "bg-accent-warm text-bg-warm rounded-2xl font-bold hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2",
                isMinimized ? "w-full py-2 text-xs" : "px-6 py-3"
              )}
            >
              <Camera size={isMinimized ? 16 : 20} /> {isMinimized ? '開啟' : '開啟相機'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className={cn(
              "relative bg-black rounded-2xl overflow-hidden border border-white/10",
              isMinimized ? "aspect-square" : "aspect-[3/4] sm:aspect-[9/16]"
            )}>
              {previewUrl ? (
                <video 
                  src={previewUrl} 
                  controls={!isMinimized}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              )}
              {isRecording && (
                <div className={cn(
                  "absolute flex items-center gap-2 bg-red-500 text-white rounded-full animate-pulse",
                  isMinimized ? "top-2 left-2 px-2 py-1" : "top-4 left-4 px-3 py-1.5"
                )}>
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  <span className={cn("font-bold uppercase tracking-widest", isMinimized ? "text-[8px]" : "text-[10px]")}>
                    {isMinimized ? 'REC' : '正在錄影'}
                  </span>
                </div>
              )}
              {previewUrl && (
                <div className={cn(
                  "absolute flex items-center gap-2 bg-emerald-500 text-white rounded-full",
                  isMinimized ? "top-2 left-2 px-2 py-1" : "top-4 left-4 px-3 py-1.5"
                )}>
                  <span className={cn("font-bold uppercase tracking-widest", isMinimized ? "text-[8px]" : "text-[10px]")}>
                    {isMinimized ? 'DONE' : '錄影完成'}
                  </span>
                </div>
              )}
            </div>

            <div className={cn("flex gap-2", isMinimized ? "flex-col" : "flex-row")}>
              {!isRecording ? (
                <button 
                  onClick={() => {
                    setPreviewUrl(null);
                    startRecording();
                  }}
                  className={cn(
                    "flex-1 bg-red-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-500/20",
                    isMinimized ? "py-2 text-xs" : "py-4"
                  )}
                >
                  <Video size={isMinimized ? 16 : 20} fill="currentColor" /> 
                  {isMinimized ? (previewUrl ? '重錄' : '錄影') : (previewUrl ? '重新錄製' : '開始錄影')}
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  className={cn(
                    "flex-1 bg-white text-bg-warm rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-100 transition-all active:scale-95 shadow-lg",
                    isMinimized ? "py-2 text-xs" : "py-4"
                  )}
                >
                  <StopCircle size={isMinimized ? 16 : 20} fill="currentColor" /> {isMinimized ? '停止' : '停止錄影'}
                </button>
              )}

              {previewUrl && !isRecording && (
                <div className={cn("flex gap-2", isMinimized ? "w-full flex-col" : "flex-1")}>
                  <button 
                    onClick={shareVideo}
                    className={cn(
                      "bg-accent-warm text-bg-warm rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg",
                      isMinimized ? "py-2 text-xs w-full" : "flex-1 py-4"
                    )}
                    title="分享或儲存到相簿"
                  >
                    <Share2 size={isMinimized ? 16 : 20} /> {isMinimized ? '分享' : '分享/存入相簿'}
                  </button>
                  <button 
                    onClick={downloadVideo}
                    className={cn(
                      "bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/20",
                      isMinimized ? "py-2 text-xs w-full" : "px-6 py-4"
                    )}
                  >
                    <Download size={isMinimized ? 16 : 20} /> {isMinimized ? '下載' : '下載影片'}
                  </button>
                </div>
              )}
            </div>
            
            {!isMinimized && (
              <p className="text-[10px] text-text-muted text-center italic">
                錄影檔名將自動設為：當天日期 + {activeScoreName || '練習曲目'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
