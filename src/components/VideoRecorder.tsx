import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Video, VideoOff, Download, Camera, StopCircle, Share2, Mic, MicOff, Save, Activity, Minimize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { saveRecording } from '../lib/storage';

interface VideoRecorderProps {
  activeScoreName?: string;
  className?: string;
  isMinimized?: boolean;
  isFloating?: boolean;
  onToggleMinimize?: () => void;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({ 
  activeScoreName, 
  className, 
  isMinimized, 
  isFloating,
  onToggleMinimize 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [finalVideoBlob, setFinalVideoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [intonationData, setIntonationData] = useState<{ time: number; pitch: number; cents: number }[]>([]);
  const [currentPitch, setCurrentPitch] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const intonationCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalVideoUrl(url);
    }
  };

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

  const startCamera = async (audioOnly: boolean = false) => {
    try {
      const constraints = audioOnly ? {
        audio: true
      } : {
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
      setIsAudioOnly(audioOnly);

      // Setup Audio Analysis
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

    } catch (err) {
      console.error("Error accessing media:", err);
      alert("無法存取相機或麥克風，請檢查權限設定。建議使用 Safari (iOS) 或 Chrome (Android/PC)。");
    }
  };

  // Pitch Detection Logic (Auto-correlation)
  const autoCorrelate = (buf: Float32Array, sampleRate: number) => {
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
      let val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    let c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++)
      for (let j = 0; j < SIZE - i; j++)
        c[i] = c[i] + buf[j] * buf[j + i];

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    let T0 = maxpos;
    return sampleRate / T0;
  };

  const updateIntonation = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;
    
    const buffer = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buffer);
    const pitch = autoCorrelate(buffer, audioContextRef.current!.sampleRate);
    
    if (pitch !== -1 && pitch > 50 && pitch < 2000) {
      setCurrentPitch(pitch);
      setIntonationData(prev => [...prev, { time: Date.now(), pitch, cents: 0 }]);
    }

    // Draw on mini canvas
    const canvas = intonationCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const dataToDraw = intonationData.slice(-50);
        dataToDraw.forEach((d, i) => {
          const x = (i / 50) * canvas.width;
          const y = canvas.height - ((d.pitch - 50) / 1000) * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateIntonation);
  }, [isRecording, intonationData]);

  useEffect(() => {
    if (isRecording) {
      setIntonationData([]);
      updateIntonation();
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isRecording]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOn(false);
    setIsRecording(false);
    setFinalVideoBlob(null);
  };

  const startRecording = useCallback(() => {
    if (!stream) return;
    
    setFinalVideoBlob(null);
    setPreviewUrl(null);
    
    // Better mimeType detection for cross-browser compatibility
    // Prioritize MP4/QuickTime for iOS/iPadOS compatibility with Photos app
    const mimeTypes = isAudioOnly ? [
      'audio/mp4',
      'audio/webm',
      'audio/ogg'
    ] : [
      'video/mp4;codecs="avc1.42E01E, mp4a.40.2"', // H.264 Baseline Profile (Most compatible for LINE/WhatsApp)
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
        }
      };

      mediaRecorder.onstop = () => {
        // Strip codecs from mimeType for better compatibility with iOS Share Sheet and LINE
        const cleanMimeType = selectedMimeType ? selectedMimeType.split(';')[0] : (isAudioOnly ? 'audio/mp4' : 'video/mp4');
        const finalBlob = new Blob(chunks, { type: cleanMimeType });
        setFinalVideoBlob(finalBlob);
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
    if (!finalVideoBlob) {
      alert("尚未取得錄影資料，請稍候再試。");
      return;
    }

    const mimeType = finalVideoBlob.type;
    const url = URL.createObjectURL(finalVideoBlob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    
    const date = new Date().toISOString().split('T')[0];
    let extension = isAudioOnly ? 'm4a' : 'mp4';
    if (mimeType.includes('webm')) extension = isAudioOnly ? 'weba' : 'webm';
    if (mimeType.includes('quicktime')) extension = 'mov';
    if (mimeType.includes('ogg')) extension = 'ogg';
    
    // Force .mov extension on iOS to help trigger native transcoding when sharing to apps like LINE
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS && extension === 'mp4') {
      extension = 'mov';
    }
    
    const fileName = `${date}_${activeScoreName || '練習錄影'}.${extension}`;
    
    a.download = fileName;
    a.click();
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  };

  const shareVideo = async () => {
    if (!finalVideoBlob) {
      alert("尚未取得錄影資料。");
      return;
    }

    try {
      const mimeType = finalVideoBlob.type;
      
      const date = new Date().toISOString().split('T')[0];
      let extension = isAudioOnly ? 'm4a' : 'mp4';
      if (mimeType.includes('webm')) extension = isAudioOnly ? 'weba' : 'webm';
      if (mimeType.includes('quicktime')) extension = 'mov';
      if (mimeType.includes('ogg')) extension = 'ogg';
      
      // Force .mov extension on iOS to help trigger native transcoding when sharing to apps like LINE
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS && extension === 'mp4') {
        extension = 'mov';
      }
      
      const fileName = `${date}_${activeScoreName || '練習錄影'}.${extension}`;
      const file = new File([finalVideoBlob], fileName, { type: mimeType });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '練習錄影',
          text: `這是我的練琴練習錄影：${activeScoreName || ''}`,
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

  const saveToApp = async () => {
    if (!finalVideoBlob) return;
    setIsSaving(true);
    try {
      await saveRecording({
        id: crypto.randomUUID(),
        scoreId: activeScoreName || 'unknown',
        timestamp: Date.now(),
        type: isAudioOnly ? 'audio' : 'video',
        blob: finalVideoBlob,
        intonationData
      });
      alert('已成功儲存至 App 練習紀錄！');
    } catch (error) {
      console.error('Save recording failed:', error);
      alert('儲存失敗，請重試。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn(
      "bg-surface-warm backdrop-blur-md rounded-3xl shadow-xl border border-white/5 transition-all overflow-hidden", 
      isMinimized ? "p-2" : "p-3 md:p-4",
      className
    )}>
      <div className="flex flex-col gap-4 h-full">
        {!isMinimized && (
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {isAudioOnly ? <Mic size={20} className="text-accent-warm" /> : <Camera size={20} className="text-accent-warm" />}
              <h2 className="text-lg font-bold tracking-tight text-text-warm">{isAudioOnly ? '純錄音' : '錄影作業'}</h2>
            </div>
            <div className="flex items-center gap-3">
              {onToggleMinimize && (
                <button 
                  onClick={onToggleMinimize}
                  className="p-2 text-text-muted hover:text-text-warm transition-colors rounded-lg hover:bg-white/5"
                >
                  <Minimize2 size={18} />
                </button>
              )}
              {isCameraOn && (
                <button 
                  onClick={() => {
                    stopCamera();
                    setPreviewUrl(null);
                  }}
                  className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                >
                  {isAudioOnly ? '關閉麥克風' : '關閉相機'}
                </button>
              )}
            </div>
          </div>
        )}

        {!isCameraOn && !localVideoUrl ? (
          <div className={cn(
            "flex-1 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/10 rounded-2xl bg-white/5 min-h-0",
            isMinimized ? "p-2" : "p-4 md:p-6"
          )}>
            <div className={cn("bg-white/5 rounded-full flex items-center justify-center text-text-muted shrink-0", isMinimized ? "w-8 h-8" : "w-12 h-12 md:w-16 h-16")}>
              <Video size={isMinimized ? 16 : 32} />
            </div>
            {!isMinimized && (
              <div className="text-center">
                <p className="font-bold text-text-warm text-sm md:text-base">準備好交作業了嗎？</p>
                <p className="text-xs text-text-muted mt-1">點擊下方按鈕開啟相機或麥克風</p>
              </div>
            )}
            <div className="flex flex-col gap-2 w-full max-w-[280px]">
              <div className="flex gap-2 w-full">
                <button 
                  onClick={() => startCamera(false)}
                  className={cn(
                    "flex-1 bg-accent-warm text-bg-warm rounded-2xl font-bold hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2",
                    isMinimized ? "py-1.5 text-[10px]" : "py-3 text-sm"
                  )}
                >
                  <Camera size={isMinimized ? 14 : 18} /> {isMinimized ? '錄影' : '錄影'}
                </button>
                <button 
                  onClick={() => startCamera(true)}
                  className={cn(
                    "flex-1 bg-white/10 text-text-warm rounded-2xl font-bold hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center gap-2",
                    isMinimized ? "py-1.5 text-[10px]" : "py-3 text-sm"
                  )}
                >
                  <Mic size={isMinimized ? 14 : 18} /> {isMinimized ? '錄音' : '錄音'}
                </button>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full bg-white/5 text-text-warm rounded-2xl font-bold hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center gap-2",
                  isMinimized ? "py-1.5 text-[10px]" : "py-3 text-sm"
                )}
              >
                <Video size={isMinimized ? 14 : 18} /> {isMinimized ? '開啟相簿影片' : '開啟相簿影片'}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="video/*" 
                className="hidden" 
                onChange={handleFileSelect} 
              />
            </div>
          </div>
        ) : localVideoUrl ? (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className={cn(
              "relative bg-black rounded-2xl overflow-hidden border border-white/10 flex-1 min-h-0",
              isMinimized ? "aspect-square mx-auto w-full" : (isFloating ? "aspect-[3/4] sm:aspect-[9/16]" : "")
            )}>
              <video 
                src={localVideoUrl} 
                controls
                playsInline
                className="absolute inset-0 w-full h-full object-contain bg-black"
              />
            </div>
            <button 
              onClick={() => {
                setLocalVideoUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className={cn(
                "w-full bg-white/10 text-text-warm rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-all active:scale-95 shadow-lg",
                isMinimized ? "py-2 text-xs" : "py-4"
              )}
            >
              關閉影片
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className={cn(
              "relative bg-black rounded-2xl overflow-hidden border border-white/10 flex-1 min-h-0",
              isMinimized ? "aspect-square mx-auto w-full" : (isFloating ? "aspect-[3/4] sm:aspect-[9/16]" : "")
            )}>
              {isAudioOnly ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-warm">
                  <div className={cn("rounded-full bg-accent-warm/20 flex items-center justify-center mb-4", isRecording ? "animate-pulse" : "")}>
                    <Mic size={48} className="text-accent-warm m-6" />
                  </div>
                  {previewUrl && (
                    <audio src={previewUrl} controls className="w-3/4 mt-4" />
                  )}
                </div>
              ) : (
                <>
                  {/* Always render the live video so the stream never suspends */}
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{ opacity: previewUrl ? 0 : 1, pointerEvents: previewUrl ? 'none' : 'auto' }}
                  />
                  {previewUrl && (
                    <video 
                      src={previewUrl} 
                      controls={!isMinimized}
                      className="absolute inset-0 w-full h-full object-contain z-10 bg-black"
                    />
                  )}
                </>
              )}
              {isRecording && (
                <div className={cn(
                  "absolute z-20 flex items-center gap-2 bg-red-500 text-white rounded-full animate-pulse",
                  isMinimized ? "top-2 left-2 px-2 py-1" : "top-4 left-4 px-3 py-1.5"
                )}>
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  <span className={cn("font-bold uppercase tracking-widest", isMinimized ? "text-[8px]" : "text-[10px]")}>
                    {isMinimized ? 'REC' : (isAudioOnly ? '正在錄音' : '正在錄影')}
                  </span>
                </div>
              )}
              {isRecording && (
                <div className="absolute bottom-4 left-4 right-4 h-12 bg-black/40 backdrop-blur-sm rounded-lg overflow-hidden border border-white/10 z-20">
                  <canvas ref={intonationCanvasRef} width={400} height={48} className="w-full h-full" />
                  <div className="absolute top-1 right-2 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <Activity size={10} /> 音準分析中
                  </div>
                </div>
              )}
              {previewUrl && (
                <div className={cn(
                  "absolute z-20 flex items-center gap-2 bg-emerald-500 text-white rounded-full",
                  isMinimized ? "top-2 left-2 px-2 py-1" : "top-4 left-4 px-3 py-1.5"
                )}>
                  <span className={cn("font-bold uppercase tracking-widest", isMinimized ? "text-[8px]" : "text-[10px]")}>
                    {isMinimized ? 'DONE' : (isAudioOnly ? '錄音完成' : '錄影完成')}
                  </span>
                </div>
              )}
            </div>

            <div className={cn("flex gap-2 shrink-0", isMinimized ? "flex-col" : "flex-row")}>
              {!isRecording ? (
                <button 
                  onClick={() => {
                    setPreviewUrl(null);
                    startRecording();
                  }}
                  className={cn(
                    "flex-1 bg-red-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-500/20",
                    isMinimized ? "py-2 text-xs" : "py-3 md:py-4 text-sm"
                  )}
                >
                  <Video size={isMinimized ? 16 : 18} fill="currentColor" /> 
                  {isMinimized ? (previewUrl ? '重錄' : '錄製') : (previewUrl ? '重新錄製' : (isAudioOnly ? '開始錄音' : '開始錄影'))}
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  className={cn(
                    "flex-1 bg-white text-bg-warm rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-100 transition-all active:scale-95 shadow-lg",
                    isMinimized ? "py-2 text-xs" : "py-3 md:py-4 text-sm"
                  )}
                >
                  <StopCircle size={isMinimized ? 16 : 18} fill="currentColor" /> {isMinimized ? '停止' : (isAudioOnly ? '停止錄音' : '停止錄影')}
                </button>
              )}

              {previewUrl && !isRecording && (
                <div className={cn("flex gap-2", isMinimized ? "w-full flex-col" : "flex-1")}>
                  <button 
                    onClick={shareVideo}
                    className={cn(
                      "bg-accent-warm text-bg-warm rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg",
                      isMinimized ? "py-2 text-xs w-full" : "flex-1 py-3 md:py-4 text-sm"
                    )}
                    title="分享或儲存"
                  >
                    <Share2 size={isMinimized ? 16 : 18} /> {isMinimized ? '分享' : '分享/儲存'}
                  </button>
                  <button 
                    onClick={saveToApp}
                    disabled={isSaving}
                    className={cn(
                      "bg-white/10 text-text-warm rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-all active:scale-95 shadow-lg",
                      isMinimized ? "py-2 text-xs w-full" : "px-4 md:px-6 py-3 md:py-4 text-sm"
                    )}
                  >
                    <Save size={isMinimized ? 16 : 18} /> {isSaving ? '...' : (isMinimized ? '存App' : '儲存')}
                  </button>
                  <button 
                    onClick={downloadVideo}
                    className={cn(
                      "bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/20",
                      isMinimized ? "py-2 text-xs w-full" : "px-4 md:px-6 py-3 md:py-4 text-sm"
                    )}
                  >
                    <Download size={isMinimized ? 16 : 18} /> {isMinimized ? '下載' : '下載'}
                  </button>
                </div>
              )}
            </div>
            
            {!isMinimized && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-text-muted text-center italic">
                  檔案名稱將自動設為：當天日期 + {activeScoreName || '練習曲目'}
                </p>
                {previewUrl && !isRecording && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && (
                  <p className="text-[10px] text-amber-500/90 text-center bg-amber-500/10 p-2 rounded-lg leading-relaxed">
                    ⚠️ iOS 裝置若要分享至 LINE，建議先點擊「下載檔案」儲存到相簿，再從相簿分享，以避免出現有聲無影的黑畫面。
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
