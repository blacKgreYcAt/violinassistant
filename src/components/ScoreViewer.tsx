import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X, ZoomIn, ZoomOut, ExternalLink, Camera, Loader2, AlertCircle, LayoutDashboard, Smile, Activity, Eye, RotateCw, PenTool, Eraser, Save, Columns } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { VideoRecorder } from './VideoRecorder';
import { cn } from '../lib/utils';
import { saveScores, getScores } from '../lib/storage';

interface Score {
  id: string;
  name: string;
  type: 'file' | 'link';
  data: string | string[];
  date: number;
  folderId?: string;
  tags?: string[];
  rotations?: number[];
  annotations?: string[];
}

interface ScoreViewerProps {
  score: Score;
  onClose: () => void;
  className?: string;
}

export const ScoreViewer: React.FC<ScoreViewerProps> = ({ score: initialScore, onClose, className }) => {
  const [score, setScore] = useState<Score>(initialScore);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isSplitScreen, setIsSplitScreen] = useState(false);
  const [recorderPosition, setRecorderPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
  const [isRecorderMinimized, setIsRecorderMinimized] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [displayMode, setDisplayMode] = useState<'fit-width' | 'fit-page'>('fit-page');
  
  // Annotation & Rotation States
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [rotations, setRotations] = useState<number[]>(score.rotations || []);
  const [annotations, setAnnotations] = useState<string[]>(score.annotations || []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Smart Page Turn States
  const [isAutoTurnEnabled, setIsAutoTurnEnabled] = useState(false);
  const [aiMode, setAiMode] = useState<'head' | 'blink'>('head');
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>();
  const lastTurnTimeRef = useRef<number>(0);
  const sequenceStateRef = useRef<'IDLE' | 'LOOK_RIGHT' | 'LOOK_RIGHT_DOWN' | 'LOOK_LEFT' | 'LOOK_LEFT_UP'>('IDLE');
  const sequenceTimerRef = useRef<number>(0);
  const aiModeRef = useRef(aiMode);

  useEffect(() => {
    aiModeRef.current = aiMode;
  }, [aiMode]);

  const pages = Array.isArray(score.data) ? score.data : [score.data];
  const totalPages = pages.length;

  // Initialize rotations and annotations arrays if they don't exist
  useEffect(() => {
    if (rotations.length !== totalPages) {
      setRotations(Array(totalPages).fill(0).map((_, i) => score.rotations?.[i] || 0));
    }
    if (annotations.length !== totalPages) {
      setAnnotations(Array(totalPages).fill('').map((_, i) => score.annotations?.[i] || ''));
    }
  }, [totalPages, score.rotations, score.annotations]);

  // Load annotation for current page
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (annotations[currentPage]) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = annotations[currentPage];
    }
  }, [currentPage, annotations, displayMode, zoom, rotations]);

  const handleRotate = () => {
    const newRotations = [...rotations];
    newRotations[currentPage] = (newRotations[currentPage] + 90) % 360;
    setRotations(newRotations);
    setHasUnsavedChanges(true);
  };

  const saveAnnotationsAndRotations = async () => {
    try {
      // Save current canvas state to annotations array
      const canvas = canvasRef.current;
      let newAnnotations = [...annotations];
      if (canvas) {
        newAnnotations[currentPage] = canvas.toDataURL();
      }

      setAnnotations(newAnnotations);

      const allScores = await getScores();
      const updatedScores = allScores.map(s => 
        s.id === score.id 
          ? { ...s, rotations, annotations: newAnnotations }
          : s
      );
      await saveScores(updatedScores);
      setScore({ ...score, rotations, annotations: newAnnotations });
      setHasUnsavedChanges(false);
      alert('儲存成功！');
    } catch (error) {
      console.error('Failed to save score updates:', error);
      alert('儲存失敗，請稍後再試。');
    }
  };

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#F27D26'; // accent-warm
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasUnsavedChanges(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Save current canvas state to annotations array
    const canvas = canvasRef.current;
    if (canvas) {
      const newAnnotations = [...annotations];
      newAnnotations[currentPage] = canvas.toDataURL();
      setAnnotations(newAnnotations);
    }
  };

  useEffect(() => {
    let active = true;

    const initMediaPipe = async () => {
      if (!isAutoTurnEnabled) return;
      setIsModelLoading(true);
      setCameraError(null);

      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        if (!active) return;

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', () => {
            if (active) {
              setIsModelLoading(false);
              detectFace();
            }
          });
        }
      } catch (err) {
        console.error("Failed to init smart page turn:", err);
        if (active) {
          setCameraError("無法啟動相機或模型");
          setIsAutoTurnEnabled(false);
          setIsModelLoading(false);
        }
      }
    };

    const detectFace = () => {
      if (!videoRef.current || !faceLandmarkerRef.current || !active) return;

      const nowInMs = Date.now();
      const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        if (aiModeRef.current === 'head') {
          const landmarks = results.faceLandmarks[0];
          
          // MediaPipe Face Mesh Landmarks
          const nose = landmarks[1];
          const leftEar = landmarks[234];
          const rightEar = landmarks[454];
          const topHead = landmarks[10];
          const chin = landmarks[152];

          const centerX = (leftEar.x + rightEar.x) / 2;
          const centerY = (topHead.y + chin.y) / 2;
          const faceWidth = Math.abs(rightEar.x - leftEar.x);
          const faceHeight = Math.abs(chin.y - topHead.y);

          // Calculate Yaw and Pitch ratios
          const yaw = (nose.x - centerX) / faceWidth;
          const pitch = (nose.y - centerY) / faceHeight;

          // Mirrored camera: looking right means nose moves to the left side of the image (smaller X)
          const isLookingRight = yaw < -0.10;
          const isLookingLeft = yaw > 0.10;
          const isLookingDown = pitch > 0.08;
          const isLookingUp = pitch < -0.08;
          const isCenter = Math.abs(yaw) < 0.08 && Math.abs(pitch) < 0.08;

          // Reset sequence if it takes too long (3 seconds)
          if (sequenceStateRef.current !== 'IDLE' && nowInMs - sequenceTimerRef.current > 3000) {
            sequenceStateRef.current = 'IDLE';
          }

          switch (sequenceStateRef.current) {
            case 'IDLE':
              if (isLookingRight) {
                sequenceStateRef.current = 'LOOK_RIGHT';
                sequenceTimerRef.current = nowInMs;
              } else if (isLookingLeft) {
                sequenceStateRef.current = 'LOOK_LEFT';
                sequenceTimerRef.current = nowInMs;
              }
              break;
            case 'LOOK_RIGHT':
              if (isLookingDown) {
                sequenceStateRef.current = 'LOOK_RIGHT_DOWN';
                sequenceTimerRef.current = nowInMs;
              } else if (isCenter) {
                sequenceStateRef.current = 'IDLE';
              }
              break;
            case 'LOOK_RIGHT_DOWN':
              if (isCenter) {
                if (nowInMs - lastTurnTimeRef.current > 2000) {
                  setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
                  lastTurnTimeRef.current = nowInMs;
                }
                sequenceStateRef.current = 'IDLE';
              }
              break;
            case 'LOOK_LEFT':
              if (isLookingUp) {
                sequenceStateRef.current = 'LOOK_LEFT_UP';
                sequenceTimerRef.current = nowInMs;
              } else if (isCenter) {
                sequenceStateRef.current = 'IDLE';
              }
              break;
            case 'LOOK_LEFT_UP':
              if (isCenter) {
                if (nowInMs - lastTurnTimeRef.current > 2000) {
                  setCurrentPage(prev => Math.max(prev - 1, 0));
                  lastTurnTimeRef.current = nowInMs;
                }
                sequenceStateRef.current = 'IDLE';
              }
              break;
          }
        } else if (aiModeRef.current === 'blink' && results.faceBlendshapes && results.faceBlendshapes.length > 0) {
          const blendshapes = results.faceBlendshapes[0].categories;
          const eyeBlinkLeft = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
          const eyeBlinkRight = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;

          // User's right eye wink -> Next page
          // User's left eye wink -> Prev page
          // To avoid normal blinks, ensure the other eye is relatively open
          const isRightWink = eyeBlinkRight > 0.5 && eyeBlinkLeft < 0.2;
          const isLeftWink = eyeBlinkLeft > 0.5 && eyeBlinkRight < 0.2;

          if (nowInMs - lastTurnTimeRef.current > 2000) {
            if (isRightWink) {
              setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
              lastTurnTimeRef.current = nowInMs;
            } else if (isLeftWink) {
              setCurrentPage(prev => Math.max(prev - 1, 0));
              lastTurnTimeRef.current = nowInMs;
            }
          }
        }
      }

      requestRef.current = requestAnimationFrame(detectFace);
    };

    if (isAutoTurnEnabled) {
      initMediaPipe();
    } else {
      // Cleanup
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
      setIsModelLoading(false);
    }

    return () => {
      active = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
    };
  }, [isAutoTurnEnabled, totalPages]);

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 3));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const nextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-bg-warm flex flex-col",
      className
    )}>
      {/* Toolbar */}
      <div className="min-h-[64px] py-2 bg-surface-warm border-b border-white/5 flex flex-wrap items-center justify-between px-4 md:px-6 shrink-0 gap-y-2">
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button 
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
          >
            <X size={24} />
          </button>
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <h2 className="text-text-warm font-bold tracking-tight truncate max-w-[100px] sm:max-w-md text-sm sm:text-base">
            {score.name}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1 md:gap-2">
          {/* Display Mode Toggles */}
          <div className="hidden lg:flex items-center bg-white/5 rounded-xl p-1 gap-1">
            <button 
              onClick={() => {
                setDisplayMode('fit-page');
                setZoom(1);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                displayMode === 'fit-page' ? "bg-accent-warm text-bg-warm" : "text-text-muted hover:text-text-warm"
              )}
            >
              符合頁面
            </button>
            <button 
              onClick={() => setDisplayMode('fit-width')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                displayMode === 'fit-width' ? "bg-accent-warm text-bg-warm" : "text-text-muted hover:text-text-warm"
              )}
            >
              符合寬度
            </button>
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2 hidden sm:block" />
          
          {/* Annotation & Rotation Controls */}
          <div className="hidden lg:flex items-center gap-1 md:gap-2 bg-white/5 p-1 rounded-xl">
            <button 
              onClick={handleRotate}
              className="p-1 md:p-2 text-text-muted hover:text-text-warm hover:bg-white/10 rounded-lg transition-colors"
              title="旋轉"
            >
              <RotateCw size={18} />
            </button>
            <button 
              onClick={() => {
                setIsDrawingMode(!isDrawingMode);
                if (isEraser) setIsEraser(false);
              }}
              className={cn(
                "p-1 md:p-2 rounded-lg transition-colors",
                isDrawingMode && !isEraser ? "bg-accent-warm text-bg-warm" : "hover:bg-white/10 text-text-muted hover:text-text-warm"
              )}
              title="畫筆"
            >
              <PenTool size={18} />
            </button>
            <button 
              onClick={() => {
                setIsEraser(!isEraser);
                if (!isDrawingMode) setIsDrawingMode(true);
              }}
              className={cn(
                "p-1 md:p-2 rounded-lg transition-colors",
                isDrawingMode && isEraser ? "bg-accent-warm text-bg-warm" : "hover:bg-white/10 text-text-muted hover:text-text-warm"
              )}
              title="橡皮擦"
            >
              <Eraser size={18} />
            </button>
            {hasUnsavedChanges && (
              <button 
                onClick={saveAnnotationsAndRotations}
                className="p-1 md:p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors flex items-center gap-1"
                title="儲存變更"
              >
                <Save size={18} />
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2 hidden sm:block" />
          
          <button 
            onClick={() => handleZoom(-0.1)}
            className="p-1 md:p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-[10px] md:text-xs font-bold text-text-muted w-8 md:w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={() => handleZoom(0.1)}
            className="p-1 md:p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
          >
            <ZoomIn size={18} />
          </button>
          
          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2" />
          
          <button 
            onClick={toggleFullscreen}
            className="p-1 md:p-2 text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2" />

          <div className="flex items-center bg-white/5 rounded-xl p-1">
            <button 
              onClick={() => setIsAutoTurnEnabled(!isAutoTurnEnabled)}
              className={cn(
                "p-1 md:p-2 rounded-lg transition-all flex items-center gap-2",
                isAutoTurnEnabled ? "bg-emerald-500 text-white" : "text-text-muted hover:text-text-warm"
              )}
              title={aiMode === 'head' ? "智能翻頁 (頭部組合動作)" : "智能翻頁 (眨眼模式)"}
            >
              {isModelLoading ? <Loader2 size={18} className="animate-spin" /> : (aiMode === 'head' ? <Smile size={18} /> : <Eye size={18} />)}
              <span className="text-[10px] font-bold hidden sm:block">{isAutoTurnEnabled ? '智能翻頁中' : '智能翻頁'}</span>
            </button>
            
            <div className="flex items-center border-l border-white/10 pl-1 ml-1">
              <button
                onClick={() => setAiMode('head')}
                className={cn("p-1.5 rounded-md transition-all", aiMode === 'head' ? "bg-white/10 text-accent-warm" : "text-text-muted hover:text-white")}
                title="頭部動作模式"
              >
                <Smile size={14} />
              </button>
              <button
                onClick={() => setAiMode('blink')}
                className={cn("p-1.5 rounded-md transition-all", aiMode === 'blink' ? "bg-white/10 text-accent-warm" : "text-text-muted hover:text-white")}
                title="眨眼模式"
              >
                <Eye size={14} />
              </button>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 md:mx-2" />

          <button 
            onClick={() => {
              setIsSplitScreen(!isSplitScreen);
              if (!isSplitScreen) {
                setShowRecorder(true);
              }
            }}
            className={cn(
              "p-1 md:p-2 rounded-xl transition-all flex items-center gap-2",
              isSplitScreen ? "bg-accent-warm text-bg-warm" : "text-text-muted hover:text-text-warm hover:bg-white/5"
            )}
            title={isSplitScreen ? "取消分割畫面" : "分割畫面 (左邊樂譜，右邊影片)"}
          >
            <Columns size={18} />
            <span className="text-[10px] font-bold hidden sm:block">{isSplitScreen ? '取消分割' : '分割畫面'}</span>
          </button>

          <button 
            onClick={() => setShowRecorder(!showRecorder)}
            className={cn(
              "p-1 md:p-2 rounded-xl transition-all flex items-center gap-2",
              showRecorder && !isSplitScreen ? "bg-red-500 text-white" : "text-text-muted hover:text-text-warm hover:bg-white/5"
            )}
          >
            <Camera size={18} />
            <span className="text-[10px] font-bold hidden sm:block">{showRecorder ? '關閉錄影' : '錄影模式'}</span>
          </button>

          {showRecorder && !isSplitScreen && (
            <div className="flex items-center bg-white/5 rounded-xl p-1 gap-1 ml-2">
              <button 
                onClick={() => {
                  const positions: ('top-right' | 'top-left' | 'bottom-right' | 'bottom-left')[] = ['top-right', 'bottom-right', 'bottom-left', 'top-left'];
                  const currentIndex = positions.indexOf(recorderPosition);
                  setRecorderPosition(positions[(currentIndex + 1) % positions.length]);
                }}
                className="p-1.5 text-text-muted hover:text-text-warm transition-all"
                title="切換位置"
              >
                <LayoutDashboard size={14} />
              </button>
              <button 
                onClick={() => setIsRecorderMinimized(!isRecorderMinimized)}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  isRecorderMinimized ? "text-accent-warm" : "text-text-muted hover:text-text-warm"
                )}
                title={isRecorderMinimized ? "展開" : "縮小"}
              >
                {isRecorderMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recorder Overlay */}
      {showRecorder && !isSplitScreen && (
        <div className={cn(
          "absolute z-[70] transition-all duration-300 ease-in-out",
          recorderPosition === 'top-right' && "top-20 right-4",
          recorderPosition === 'top-left' && "top-20 left-4",
          recorderPosition === 'bottom-right' && "bottom-24 right-4",
          recorderPosition === 'bottom-left' && "bottom-24 left-4",
          isRecorderMinimized ? "w-48" : "w-full max-w-[320px]"
        )}>
          <VideoRecorder 
            activeScoreName={score.name} 
            className={cn(
              "shadow-2xl border-accent-warm/20",
              isRecorderMinimized && "p-2"
            )} 
            isMinimized={isRecorderMinimized}
            isFloating={true}
          />
        </div>
      )}

      {/* Smart Page Turn Camera Preview */}
      {isAutoTurnEnabled && (
        <div className="fixed bottom-24 right-4 w-32 h-24 bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-emerald-500/50 z-[80]">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
          {isModelLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 size={24} className="animate-spin text-emerald-500" />
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-2 text-center">
              <span className="text-[10px] text-red-400 font-bold">{cameraError}</span>
            </div>
          )}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden bg-bg-warm relative flex min-h-0">
        <div className={cn(
          "flex-1 overflow-hidden relative min-w-0 min-h-0",
          showRecorder && isSplitScreen ? "border-r border-white/10" : ""
        )}>
          {score.type === 'link' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-12 text-center gap-4 sm:gap-6 bg-white">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400">
              <ExternalLink size={32} />
            </div>
            <div className="max-w-xs">
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-2">外部樂譜連結</h3>
              <p className="text-neutral-500 text-xs sm:text-sm">
                由於版權與安全限制，某些外部樂譜無法直接在 App 內顯示。
              </p>
            </div>
            <a 
              href={score.data as string} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              在新分頁開啟樂譜 <ExternalLink size={18} />
            </a>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-auto flex justify-center items-center p-4 scrollbar-hide">
            <div 
              className={cn(
                "transition-all duration-200 shadow-2xl bg-white flex items-center justify-center relative",
                displayMode === 'fit-width' && "w-full h-auto",
                displayMode === 'fit-page' && "max-w-full max-h-full"
              )}
              style={{ 
                width: displayMode === 'fit-width' ? `${zoom * 100}%` : 'auto',
                maxWidth: '100%',
                maxHeight: displayMode === 'fit-page' ? '100%' : 'none',
                aspectRatio: '1 / 1.414',
                transform: `rotate(${rotations[currentPage] || 0}deg)`,
                transition: isDrawingMode ? 'none' : 'transform 0.3s ease-in-out'
              }}
            >
              <img 
                src={pages[currentPage]} 
                alt={`${score.name} - Page ${currentPage + 1}`}
                className={cn(
                  "object-contain bg-white",
                  displayMode === 'fit-page' ? "max-w-full max-h-full" : "w-full h-auto"
                )}
                referrerPolicy="no-referrer"
                onLoad={(e) => {
                  if (canvasRef.current) {
                    canvasRef.current.width = e.currentTarget.naturalWidth;
                    canvasRef.current.height = e.currentTarget.naturalHeight;
                    // Redraw annotation after resize
                    if (annotations[currentPage]) {
                      const ctx = canvasRef.current.getContext('2d');
                      const img = new Image();
                      img.onload = () => ctx?.drawImage(img, 0, 0);
                      img.src = annotations[currentPage];
                    }
                  }
                }}
              />
              <canvas
                ref={canvasRef}
                className={cn(
                  "absolute inset-0 w-full h-full",
                  isDrawingMode ? "cursor-crosshair z-10" : "pointer-events-none z-10"
                )}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
          </div>
        )}
        </div>

        {/* Split Screen Video Area */}
        {showRecorder && isSplitScreen && (
          <div className="w-1/2 md:w-[400px] lg:w-[500px] h-full bg-surface-warm overflow-y-auto shrink-0 border-l border-white/5">
            <VideoRecorder 
              activeScoreName={score.name} 
              className="h-full rounded-none border-0 shadow-none" 
              isMinimized={false}
              isFloating={false}
            />
          </div>
        )}
      </div>

      {/* Page Controls (Floating) */}
      {totalPages > 1 && (
        <div className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-surface-warm/80 backdrop-blur-md border border-white/5 p-1.5 sm:p-2 rounded-2xl shadow-2xl z-[60]">
          <button 
            onClick={prevPage}
            disabled={currentPage === 0}
            className="p-2 sm:p-3 text-text-warm hover:bg-white/5 rounded-xl transition-all disabled:opacity-30"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center px-2 sm:px-4">
            <span className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5">
              樂譜頁碼
            </span>
            <span className="text-xs sm:text-sm font-bold text-text-warm">
              {`第 ${currentPage + 1} / ${totalPages} 頁`}
            </span>
          </div>
          <button 
            onClick={nextPage}
            disabled={currentPage === totalPages - 1}
            className="p-2 sm:p-3 text-text-warm hover:bg-white/5 rounded-xl transition-all disabled:opacity-30"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
};
