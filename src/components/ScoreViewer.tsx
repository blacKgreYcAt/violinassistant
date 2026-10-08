import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X, ZoomIn, ZoomOut, 
  Camera, Loader2, Smile, Eye, RotateCw, PenTool, Eraser, Save, 
  Columns, Moon, Sun, Star, Music, TrendingUp, Play, Pause, 
  ChevronUp, ChevronDown, Edit2, Check, Plus, Minus, Square, Video, Repeat, Trash2
} from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { VideoRecorder } from './VideoRecorder';
import { RecordingPlayer } from './RecordingPlayer';
import { TempoProgressChart } from './TempoProgressChart';
import { PlaybackSpeedControl, applyPlaybackSpeed } from './PlaybackSpeedControl';
import { cn } from '../lib/utils';
import { formatPracticeTotal } from '../lib/practiceTimer';
import {
  toLocalRatio,
  rectFromPoints,
  isRectUsable,
  rectToPercentStyle,
  clampBarsPerRep,
  accumulateReps,
  withBestBpm,
  DEFAULT_BARS_PER_REP,
  MAX_BARS_PER_REP,
  MIN_BARS_PER_REP,
  ScoreSection,
  SectionRect
} from '../lib/scoreSections';
import {
  saveScores,
  getScores,
  getRecordingsByScoreId,
  deleteRecording,
  updateTempoHistory,
  getPracticeTotalForScore,
  updateScoreSections,
  Recording,
  Score
} from '../lib/storage';

/**
 * MediaPipe 的 WASM 執行檔來源。
 *
 * ⚠️ 這個版本號必須與 package.json 裡 @mediapipe/tasks-vision 的版本一致。
 * 原本這裡寫死 0.10.3，但實際安裝的是 0.10.35 —— JS 端與 WASM 端版本不匹配，
 * 行為沒有保證。升級套件時記得同步改這裡。
 *
 * 另外要注意：這是外部 CDN，所以「智能翻頁」在離線狀態下無法使用，
 * 即使 App 本身是可離線的 PWA。若要支援離線，需改成把 wasm 檔一起打包進專案。
 */
const MEDIAPIPE_WASM_BASE_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

/**
 * 右側浮動面板的共用定位與外觀。
 *
 * 原本每個面板各自寫死 `right-24` 加固定寬度，在手機寬度下整片被推到畫面外
 * ——375px 螢幕上 w-96 的錄影面板左緣是 -105px，使用者完全看不到也點不到。
 * 窄螢幕改成左右撐開（右邊仍留 24 讓開側欄），寬螢幕才回到固定寬度。
 *
 * 寬度由各面板自己用 `sm:w-*` 指定；共用的部分放這裡，之後新增面板就不會再漏掉。
 */
const PANEL_BASE =
  "fixed left-2 right-24 w-auto sm:left-auto bg-surface-warm border border-white/10 rounded-2xl shadow-2xl p-6 z-[100] animate-in fade-in slide-in-from-right-4 max-h-[75vh] overflow-y-auto custom-scrollbar";

interface ScoreViewerProps {
  score: Score;
  onClose: () => void;
  className?: string;
  bpm: number;
  setBpm: (bpm: number) => void;
  isMetronomePlaying: boolean;
  setIsMetronomePlaying: (isPlaying: boolean) => void;
}

export const ScoreViewer: React.FC<ScoreViewerProps> = ({ 
  score: initialScore, 
  onClose, 
  className,
  bpm: currentBpm,
  setBpm: setCurrentBpm,
  isMetronomePlaying,
  setIsMetronomePlaying
}) => {
  const [score, setScore] = useState<Score>(initialScore);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  // 示範影片的播放速度。0.5 倍看老師的運弓與換把是學習上的剛需。
  const [videoSpeed, setVideoSpeed] = useState(1);
  const demoVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSplitScreen, setIsSplitScreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mastery, setMastery] = useState(score.mastery || 0);
  const [showMasteryPopover, setShowMasteryPopover] = useState(false);
  const [showTempoHistory, setShowTempoHistory] = useState(false);
  const [practiceTotalSeconds, setPracticeTotalSeconds] = useState(0);
  // --- 段落循環練習 ---
  const [sections, setSections] = useState<ScoreSection[]>(score.sections || []);
  const [showSections, setShowSections] = useState(false);
  const [isSelectingSection, setIsSelectingSection] = useState(false);
  const [draftRect, setDraftRect] = useState<SectionRect | null>(null);
  const [draftName, setDraftName] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [barsPerRep, setBarsPerRep] = useState(DEFAULT_BARS_PER_REP);
  const [autoCountReps, setAutoCountReps] = useState(true);
  // 這一遍已經跑掉幾小節。放 ref 不放 state：它每小節都會動，
  // 但畫面只在「湊滿一遍」時才需要更新。
  const barAccumulatorRef = useRef(0);
  const sectionDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [showBpmPopover, setShowBpmPopover] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [showRecordings, setShowRecordings] = useState(false);
  // 錄影是以 Blob 形式存在 IndexedDB，要播放必須轉成 object URL。
  // 這些 URL 會把整段影片留在記憶體裡，所以關閉清單時一定要 revoke。
  const [recordingUrls, setRecordingUrls] = useState<Record<string, string>>({});
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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>();
  const lastTurnTimeRef = useRef<number>(0);
  const sequenceStateRef = useRef<'IDLE' | 'LOOK_RIGHT' | 'LOOK_RIGHT_DOWN' | 'LOOK_LEFT' | 'LOOK_LEFT_UP'>('IDLE');
  const sequenceTimerRef = useRef<number>(0);
  const aiModeRef = useRef(aiMode);
  // 用來記錄這一輪節拍器練習中用過的最高速度（見下方 updateTempoHistory 的 effect）
  const maxBpmWhilePlayingRef = useRef(0);
  const wasMetronomePlayingRef = useRef(false);

  // Score Name Editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(score.name);

  useEffect(() => {
    aiModeRef.current = aiMode;
  }, [aiMode]);

  // 必須 memo：單頁樂譜（score.data 是字串）時，[score.data] 每次 render 都會產生新陣列，
  // 而 pages 被放在載入標註的 useEffect 依賴陣列裡 ——
  // 任何無關的重繪都會觸發「清空 canvas → 非同步重載標註圖」，造成標註閃爍。
  const pages = React.useMemo(
    () => (Array.isArray(score.data) ? score.data : [score.data]),
    [score.data]
  );
  const totalPages = pages.length;

  // 本曲累計練習時間。計時器寫入紀錄時會發出 practice-history-updated，
  // 所以面板開著的時候也會跟著更新。
  useEffect(() => {
    if (!showTempoHistory) return;
    let cancelled = false;
    const load = () => {
      getPracticeTotalForScore(score.id).then((seconds) => {
        if (!cancelled) setPracticeTotalSeconds(seconds);
      });
    };
    load();
    window.addEventListener('practice-history-updated', load);
    return () => {
      cancelled = true;
      window.removeEventListener('practice-history-updated', load);
    };
  }, [showTempoHistory, score.id]);

  const activeSection = sections.find((s) => s.id === activeSectionId) || null;

  // 節拍器事件的處理函式不能依賴 render 當下的 sections（會抓到舊值），
  // 但也不能把計算塞進 setSections 的 updater 裡 —— updater 必須是純函式，
  // 一旦在裡面改 ref 或寫資料庫，StrictMode 重複呼叫就會多算一遍。
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  /** 寫回樂譜（只動 sections 欄位），並同步畫面上的狀態 */
  const persistSections = useCallback(
    (next: ScoreSection[]) => {
      sectionsRef.current = next;
      setSections(next);
      updateScoreSections(score.id, next).catch((err) => {
        console.error('段落儲存失敗', err);
      });
    },
    [score.id]
  );

  // 節拍器每跨過一個小節線就會廣播一次，用來自動累計練了幾遍。
  // 事件是在「真的聽到那一拍」的時間點發出的（見 Metronome 的 drawLoop）。
  useEffect(() => {
    if (!activeSectionId || !autoCountReps) return;

    const onBar = (event: Event) => {
      const completedBars =
        (event as CustomEvent<{ completedBars: number }>).detail?.completedBars ?? 0;

      const current = sectionsRef.current.find((s) => s.id === activeSectionId);
      if (!current) return;

      const next = accumulateReps(
        { bars: barAccumulatorRef.current, reps: current.reps },
        completedBars,
        barsPerRep
      );
      barAccumulatorRef.current = next.bars;
      if (next.reps === current.reps) return;

      persistSections(
        sectionsRef.current.map((s) =>
          s.id === activeSectionId ? withBestBpm({ ...s, reps: next.reps }, currentBpm) : s
        )
      );
    };

    window.addEventListener('metronome-bar', onBar);
    return () => window.removeEventListener('metronome-bar', onBar);
  }, [activeSectionId, autoCountReps, barsPerRep, currentBpm, persistSections]);

  /** 啟用段落：跳到它所在的頁，並重新開始算這一遍 */
  const activateSection = (section: ScoreSection) => {
    setActiveSectionId(section.id);
    setCurrentPage(section.page);
    barAccumulatorRef.current = 0;
    // 框選模式與段落練習是互斥的操作
    setIsSelectingSection(false);
    setDraftRect(null);
  };

  const addRepManually = () => {
    if (!activeSection) return;
    barAccumulatorRef.current = 0;
    persistSections(
      sectionsRef.current.map((s) =>
        s.id === activeSection.id ? withBestBpm({ ...s, reps: s.reps + 1 }, currentBpm) : s
      )
    );
  };

  const resetReps = () => {
    if (!activeSection) return;
    barAccumulatorRef.current = 0;
    persistSections(
      sectionsRef.current.map((s) => (s.id === activeSection.id ? { ...s, reps: 0 } : s))
    );
  };

  const deleteSection = (id: string) => {
    if (activeSectionId === id) setActiveSectionId(null);
    persistSections(sectionsRef.current.filter((s) => s.id !== id));
  };

  const saveDraftSection = () => {
    if (!draftRect) return;
    const section: ScoreSection = {
      id: crypto.randomUUID(),
      name: draftName.trim() || `段落 ${sections.length + 1}`,
      page: currentPage,
      rect: draftRect,
      createdAt: Date.now(),
      reps: 0,
    };
    const next = [...sectionsRef.current, section];
    persistSections(next);
    setDraftRect(null);
    setDraftName('');
    setIsSelectingSection(false);
    setActiveSectionId(section.id);
    barAccumulatorRef.current = 0;
  };

  const cancelDraft = () => {
    setDraftRect(null);
    setDraftName('');
    setIsSelectingSection(false);
    sectionDragStartRef.current = null;
  };

  /** 把畫面座標換算成「相對於樂譜頁面框」的比例，並夾在 0~1 之內 */
  const getSectionPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return toLocalRatio(
      canvas.getBoundingClientRect(),
      rotations[currentPage] || 0,
      clientX,
      clientY
    );
  };

  const startSectionDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const point = getSectionPoint(clientX, clientY);
    sectionDragStartRef.current = point;
    setDraftRect(rectFromPoints(point, point));
  };

  const moveSectionDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const start = sectionDragStartRef.current;
    if (!start) return;
    // 觸控拖曳時要擋掉頁面捲動，否則框一半畫面就跑掉了
    if ('touches' in e) e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDraftRect(rectFromPoints(start, getSectionPoint(clientX, clientY)));
  };

  const endSectionDrag = () => {
    const start = sectionDragStartRef.current;
    sectionDragStartRef.current = null;
    if (!start) return;
    // 太小的框當成手滑，直接丟掉而不是留下一個看不見的段落
    setDraftRect((rect) => (rect && isRectUsable(rect) ? rect : null));
  };

  // Initialize rotations and annotations arrays if they don't exist
  useEffect(() => {
    if (rotations.length !== totalPages) {
      setRotations(Array(totalPages).fill(0).map((_, i) => score.rotations?.[i] || 0));
    }
    if (annotations.length !== totalPages) {
      setAnnotations(Array(totalPages).fill('').map((_, i) => score.annotations?.[i] || ''));
    }
  }, [totalPages, score.rotations, score.annotations, rotations.length, annotations.length]);

  // Load annotation for current page
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (annotations[currentPage]) {
        const annotationImg = new Image();
        annotationImg.onload = () => {
          ctx.drawImage(annotationImg, 0, 0);
        };
        annotationImg.src = annotations[currentPage];
      }
    };
    img.src = pages[currentPage];
  }, [currentPage, annotations, displayMode, zoom, rotations, pages]);

  const loadRecordings = useCallback(async () => {
    const scoreRecordings = await getRecordingsByScoreId(score.id);
    setRecordings(scoreRecordings);
  }, [score.id]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  const handleDeleteRecording = async (id: string) => {
    if (!confirm('確定要刪除這段錄影嗎？此動作無法復原。')) return;
    await deleteRecording(id);
    await loadRecordings();
  };

  useEffect(() => {
    if (!showRecordings) return;
    const urls: Record<string, string> = {};
    recordings.forEach(r => { urls[r.id] = URL.createObjectURL(r.blob); });
    setRecordingUrls(urls);
    return () => {
      Object.values(urls).forEach(u => URL.revokeObjectURL(u));
      setRecordingUrls({});
    };
  }, [showRecordings, recordings]);

  const handleRotate = () => {
    const newRotations = [...rotations];
    newRotations[currentPage] = (newRotations[currentPage] + 90) % 360;
    setRotations(newRotations);
    setHasUnsavedChanges(true);
  };

  const saveAnnotationsAndRotations = async () => {
    try {
      const canvas = canvasRef.current;
      const newAnnotations = [...annotations];
      if (canvas) {
        newAnnotations[currentPage] = canvas.toDataURL();
      }

      setAnnotations(newAnnotations);

      const allScores = await getScores();
      const updatedScores = allScores.map(s => 
        s.id === score.id 
          ? { ...s, name: score.name, rotations, annotations: newAnnotations, mastery }
          : s
      );
      await saveScores(updatedScores);
      setScore({ ...score, rotations, annotations: newAnnotations, mastery });
      setHasUnsavedChanges(false);
      alert('儲存成功！');
    } catch (error) {
      console.error('Failed to save score updates:', error);
      alert('儲存失敗，請檢查儲存空間。');
    }
  };

  const handleSaveName = () => {
    const finalName = tempName.trim() || score.name;
    setScore(prev => ({ ...prev, name: finalName }));
    setIsEditingName(false);
    setHasUnsavedChanges(true);
  };

  /**
   * 把畫面上的點擊座標換算成 canvas 內部座標。
   *
   * 旋轉換算本身抽到 lib/scoreSections 的 toLocalRatio（框選段落也用同一套），
   * 那裡有單元測試；這裡只負責乘上 canvas 的像素尺寸。
   */
  const getCanvasPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const ratio = toLocalRatio(
      canvas.getBoundingClientRect(),
      rotations[currentPage] || 0,
      clientX,
      clientY
    );
    return { x: ratio.x * canvas.width, y: ratio.y * canvas.height };
  };

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { x, y } = getCanvasPoint(canvas, clientX, clientY);

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

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { x, y } = getCanvasPoint(canvas, clientX, clientY);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#F27D26';
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

      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_PATH);
        
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
          videoRef.current.play().catch(e => console.error("Face tracking video play error:", e));
          
          const onLoadedData = () => {
            if (active) {
              setIsModelLoading(false);
              detectFace();
            }
          };

          if (videoRef.current.readyState >= 2) {
            onLoadedData();
          } else {
            videoRef.current.addEventListener('loadeddata', onLoadedData, { once: true });
          }
        }
      } catch (err) {
        console.error("Failed to init smart page turn:", err);
        if (active) {
          setIsAutoTurnEnabled(false);
          setIsModelLoading(false);
        }
      }
    };

    const detectFace = () => {
      if (!videoRef.current || !faceLandmarkerRef.current || !active) return;

      try {
        const nowInMs = Date.now();
        const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          if (aiModeRef.current === 'head') {
            const landmarks = results.faceLandmarks[0];
            const nose = landmarks[1];
            const leftEar = landmarks[234];
            const rightEar = landmarks[454];
            const topHead = landmarks[10];
            const chin = landmarks[152];

            const centerX = (leftEar.x + rightEar.x) / 2;
            const centerY = (topHead.y + chin.y) / 2;
            const faceWidth = Math.abs(rightEar.x - leftEar.x);
            const faceHeight = Math.abs(chin.y - topHead.y);

            const yaw = (nose.x - centerX) / faceWidth;
            const pitch = (nose.y - centerY) / faceHeight;

            // Head Movement Sequence:
            // Next Page: Look Right -> Nod Down -> Return to Center
            // Prev Page: Look Left -> Look Up -> Return to Center
            const isLookingRight = yaw < -0.12;
            const isLookingLeft = yaw > 0.12;
            const isLookingDown = pitch > 0.12;
            const isLookingUp = pitch < -0.12;
            const isCentered = Math.abs(yaw) < 0.1 && Math.abs(pitch) < 0.1;

            if (nowInMs - lastTurnTimeRef.current > 2000) {
              if (sequenceStateRef.current === 'IDLE') {
                if (isLookingRight) {
                  sequenceStateRef.current = 'LOOK_RIGHT';
                  sequenceTimerRef.current = nowInMs;
                } else if (isLookingLeft) {
                  sequenceStateRef.current = 'LOOK_LEFT';
                  sequenceTimerRef.current = nowInMs;
                }
              } else if (sequenceStateRef.current === 'LOOK_RIGHT') {
                if (isLookingDown) {
                  sequenceStateRef.current = 'LOOK_RIGHT_DOWN';
                } else if (nowInMs - sequenceTimerRef.current > 1500) {
                  sequenceStateRef.current = 'IDLE';
                }
              } else if (sequenceStateRef.current === 'LOOK_RIGHT_DOWN') {
                if (isCentered) {
                  setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
                  lastTurnTimeRef.current = nowInMs;
                  sequenceStateRef.current = 'IDLE';
                } else if (nowInMs - sequenceTimerRef.current > 2000) {
                  sequenceStateRef.current = 'IDLE';
                }
              } else if (sequenceStateRef.current === 'LOOK_LEFT') {
                if (isLookingUp) {
                  sequenceStateRef.current = 'LOOK_LEFT_UP';
                } else if (nowInMs - sequenceTimerRef.current > 1500) {
                  sequenceStateRef.current = 'IDLE';
                }
              } else if (sequenceStateRef.current === 'LOOK_LEFT_UP') {
                if (isCentered) {
                  setCurrentPage(prev => Math.max(prev - 1, 0));
                  lastTurnTimeRef.current = nowInMs;
                  sequenceStateRef.current = 'IDLE';
                } else if (nowInMs - sequenceTimerRef.current > 2000) {
                  sequenceStateRef.current = 'IDLE';
                }
              }
            }
          } else if (aiModeRef.current === 'blink' && results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const blendshapes = results.faceBlendshapes[0].categories;
            const eyeBlinkLeft = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
            const eyeBlinkRight = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;

            // Blink Mode Sequence:
            // Next Page: Wink Right Eye (Right eye blink, left eye open)
            // Prev Page: Wink Left Eye (Left eye blink, right eye open)
            // Note: eyeBlinkLeft/Right in MediaPipe refers to the user's actual left/right eye.
            const isRightWink = eyeBlinkRight > 0.4 && eyeBlinkLeft < 0.3;
            const isLeftWink = eyeBlinkLeft > 0.4 && eyeBlinkRight < 0.3;

            if (nowInMs - lastTurnTimeRef.current > 2000) {
              if (isRightWink) {
                // Right eye wink -> Next page
                setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
                lastTurnTimeRef.current = nowInMs;
              } else if (isLeftWink) {
                // Left eye wink -> Previous page
                setCurrentPage(prev => Math.max(prev - 1, 0));
                lastTurnTimeRef.current = nowInMs;
              }
            }
          }
        }
      } catch (err) {
        console.error("Face detection error:", err);
      }

      if (active) {
        requestRef.current = requestAnimationFrame(detectFace);
      }
    };

    if (isAutoTurnEnabled) {
      initMediaPipe();
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
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

    // 在 effect 執行當下就抓住 video 元素。
    // 清理函式若直接讀 videoRef.current，拿到的是「清理那一刻」的值 ——
    // 元素若已被替換或卸載，就會關不到正在運作的那條相機串流（相機燈一直亮著）。
    const videoEl = videoRef.current;

    return () => {
      active = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoEl.srcObject = null;
      }
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
    };
  }, [isAutoTurnEnabled, totalPages]);

  // 使用者可以用 ESC 離開全螢幕，那不會經過我們的按鈕。
  // 若只在按鈕裡 setIsFullscreen，狀態就會和實際情況脫節（圖示顯示錯誤、再按一次沒反應）。
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 從相簿開啟的影片 object URL 必須回收，否則整個影片檔會一直留在記憶體裡
  useEffect(() => {
    if (!videoFileUrl) return;
    return () => { URL.revokeObjectURL(videoFileUrl); };
  }, [videoFileUrl]);

  // 記錄這首曲子練到的速度。
  // storage.ts 有 updateTempoHistory()，但全專案從來沒有任何地方呼叫它，
  // 所以「速度紀錄」面板永遠顯示「尚無速度紀錄」。這裡把它接起來：
  // 在節拍器停止時寫入這段期間用過的最高 BPM（寫入會整個重存樂譜清單，
  // 所以不適合在每次 BPM 變動時就寫）。
  useEffect(() => {
    if (isMetronomePlaying) {
      maxBpmWhilePlayingRef.current = Math.max(maxBpmWhilePlayingRef.current, currentBpm);
      wasMetronomePlayingRef.current = true;
      return;
    }

    if (!wasMetronomePlayingRef.current) return;
    wasMetronomePlayingRef.current = false;

    const bpmToRecord = maxBpmWhilePlayingRef.current;
    maxBpmWhilePlayingRef.current = 0;
    if (bpmToRecord <= 0) return;

    let cancelled = false;
    (async () => {
      try {
        await updateTempoHistory(score.id, bpmToRecord);
        const allScores = await getScores();
        const updated = allScores.find(s => s.id === score.id);
        if (!cancelled && updated) {
          setScore(prev => ({ ...prev, tempoHistory: updated.tempoHistory }));
        }
      } catch (err) {
        console.error('Failed to record tempo history:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [isMetronomePlaying, currentBpm, score.id]);

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 3));
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      // iPhone 的 Safari 不支援元素全螢幕，requestFullscreen 會直接 reject
      console.error('Fullscreen toggle failed:', err);
    }
    // 狀態一律以瀏覽器的實際情況為準（見下方 fullscreenchange 監聽）
  };

  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 0));

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-bg-warm flex flex-col overflow-hidden",
      className
    )}>
      {/* Top Bar */}
      <header className="h-16 shrink-0 bg-surface-warm/90 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 md:px-6 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            aria-label="關閉樂譜" title="關閉樂譜"
            className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
          >
            <X size={24} />
          </button>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-base font-bold w-48 sm:w-64 focus:outline-none focus:border-accent-warm transition-all"
                  autoFocus
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <button onClick={handleSaveName} className="text-accent-warm p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <Check size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 
                  onClick={() => { setTempName(score.name); setIsEditingName(true); }}
                  className="text-text-warm font-bold text-lg tracking-tight truncate max-w-[150px] sm:max-w-md cursor-pointer hover:text-accent-warm transition-colors"
                >
                  {score.name}
                </h2>
                <button 
                  onClick={() => { setTempName(score.name); setIsEditingName(true); }}
                  aria-label="修改曲名" title="修改曲名"
                  /* 同上。這個鉛筆按鈕在觸控裝置上看不到（雖然點標題本身也能改名，但沒有提示） */
                  className="p-1.5 text-text-muted hover:text-accent-warm rounded-lg hover-reveal"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowBpmPopover(!showBpmPopover)}
            aria-label="節拍速度" title="節拍速度"
            className={cn(
              "px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all",
              isMetronomePlaying ? "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20" : "bg-white/5 text-text-muted hover:text-text-warm"
            )}
          >
            <Music size={18} />
            <span className="hidden sm:inline">{currentBpm} BPM</span>
          </button>
          <button 
            onClick={() => setIsMetronomePlaying(!isMetronomePlaying)}
            aria-label={isMetronomePlaying ? "停止節拍器" : "啟動節拍器"}
            title={isMetronomePlaying ? "停止節拍器" : "啟動節拍器"}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
              isMetronomePlaying ? "bg-red-500 text-white" : "bg-white/5 text-text-muted hover:text-text-warm"
            )}
          >
            {isMetronomePlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          {hasUnsavedChanges && (
            <button 
              onClick={saveAnnotationsAndRotations}
              className="px-4 py-2 bg-emerald-500 text-bg-warm rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 animate-pulse"
            >
              <Save size={18} />
              儲存變更
            </button>
          )}
          <button 
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "離開全螢幕" : "全螢幕"}
            title={isFullscreen ? "離開全螢幕" : "全螢幕"}
            className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-warm hover:bg-white/5 rounded-xl transition-all"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        
        {/* Left Sidebar - Tools */}
        <aside className="w-20 shrink-0 bg-surface-warm/50 border-r border-white/5 flex flex-col items-center py-6 gap-6 z-10">
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => {
                setIsDrawingMode(!isDrawingMode);
                if (isEraser) setIsEraser(false);
              }}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                isDrawingMode && !isEraser ? "bg-accent-warm text-bg-warm shadow-accent-warm/30" : "bg-white/5 text-text-muted hover:text-text-warm"
              )}
              title="畫筆"
            >
              <PenTool size={24} />
            </button>
            <button 
              onClick={() => {
                setIsEraser(!isEraser);
                if (!isDrawingMode) setIsDrawingMode(true);
              }}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                isDrawingMode && isEraser ? "bg-accent-warm text-bg-warm shadow-accent-warm/30" : "bg-white/5 text-text-muted hover:text-text-warm"
              )}
              title="橡皮擦"
            >
              <Eraser size={24} />
            </button>
            <button 
              onClick={handleRotate}
              className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 text-text-muted hover:text-text-warm transition-all"
              title="旋轉"
            >
              <RotateCw size={24} />
            </button>
          </div>

          <div className="w-8 h-px bg-white/10" />

          <div className="flex flex-col gap-4">
            <button 
              onClick={() => handleZoom(0.1)}
            aria-label="放大" title="放大"
              className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 text-text-muted hover:text-text-warm transition-all"
            >
              <ZoomIn size={24} />
            </button>
            <button 
              onClick={() => handleZoom(-0.1)}
            aria-label="縮小" title="縮小"
              className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 text-text-muted hover:text-text-warm transition-all"
            >
              <ZoomOut size={24} />
            </button>
          </div>

          <div className="w-8 h-px bg-white/10" />

          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="樂譜深色模式" title="樂譜深色模式"
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
              isDarkMode ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "bg-white/5 text-text-muted hover:text-text-warm"
            )}
          >
            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </aside>

        {/* Center - Score View */}
        <main className={cn(
          "flex-1 relative bg-bg-warm flex flex-col min-w-0 overflow-hidden transition-all duration-500",
          isSplitScreen && showRecorder ? "border-r border-white/10" : ""
        )}>
          <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
            <div 
              className="relative shadow-2xl transition-all duration-300"
              style={{ 
                width: displayMode === 'fit-width' ? `${zoom * 100}%` : 'auto',
                height: displayMode === 'fit-page' ? `${zoom * 100}%` : 'auto',
                maxHeight: '100%',
                aspectRatio: '1 / 1.414',
                transform: `rotate(${rotations[currentPage] || 0}deg)`,
                filter: isDarkMode ? 'invert(1) hue-rotate(180deg)' : 'none'
              }}
            >
              <img 
                src={pages[currentPage]} 
                alt="Score"
                className="w-full h-full object-contain bg-white rounded-lg"
                referrerPolicy="no-referrer"
              />
              <canvas
                ref={canvasRef}
                className={cn(
                  "absolute inset-0 w-full h-full z-10",
                  isDrawingMode ? "cursor-crosshair" : "cursor-default"
                )}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />

              {/* 啟用中的段落：把其他地方壓暗，只留這一塊亮著。
                  用一個超大的 box-shadow 當遮罩，比疊四個方塊省事也不會有縫。 */}
              {activeSection && activeSection.page === currentPage && !isSelectingSection && (
                <div
                  data-testid="section-highlight"
                  className="absolute z-20 pointer-events-none rounded-sm ring-2 ring-accent-warm"
                  style={{
                    ...rectToPercentStyle(activeSection.rect),
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
                  }}
                />
              )}

              {/* 框選模式：蓋一層可拖曳的透明層（要在畫筆 canvas 之上） */}
              {isSelectingSection && (
                <div
                  data-testid="section-select-layer"
                  className="absolute inset-0 z-30 cursor-crosshair touch-none"
                  onMouseDown={startSectionDrag}
                  onMouseMove={moveSectionDrag}
                  onMouseUp={endSectionDrag}
                  onMouseLeave={endSectionDrag}
                  onTouchStart={startSectionDrag}
                  onTouchMove={moveSectionDrag}
                  onTouchEnd={endSectionDrag}
                >
                  {draftRect && (
                    <div
                      className="absolute border-2 border-dashed border-accent-warm bg-accent-warm/20"
                      style={rectToPercentStyle(draftRect)}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Navigation Arrows */}
            <button 
              onClick={prevPage}
              disabled={currentPage === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-surface-warm/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-text-warm shadow-2xl hover:bg-accent-warm hover:text-bg-warm transition-all disabled:opacity-0 z-20"
            >
              <ChevronLeft size={32} />
            </button>
            <button 
              onClick={nextPage}
              disabled={currentPage === totalPages - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-surface-warm/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-text-warm shadow-2xl hover:bg-accent-warm hover:text-bg-warm transition-all disabled:opacity-0 z-20"
            >
              <ChevronRight size={32} />
            </button>
          </div>

          {/* Bottom Bar - Page Info & Display Mode */}
          <footer className="h-16 shrink-0 bg-surface-warm/50 border-t border-white/5 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <div className="flex bg-white/5 rounded-xl p-1">
                <button 
                  onClick={() => setDisplayMode('fit-page')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    displayMode === 'fit-page' ? "bg-white/10 text-text-warm" : "text-text-muted hover:text-text-warm"
                  )}
                >
                  符合頁面
                </button>
                <button 
                  onClick={() => setDisplayMode('fit-width')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    displayMode === 'fit-width' ? "bg-white/10 text-text-warm" : "text-text-muted hover:text-text-warm"
                  )}
                >
                  符合寬度
                </button>
              </div>
              <span className="text-sm font-bold text-text-muted">
                {currentPage + 1} / {totalPages}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {isAutoTurnEnabled && (
                <div className="flex items-center bg-white/5 rounded-xl p-1 animate-in fade-in slide-in-from-right-2">
                  <button
                    onClick={() => setAiMode('head')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                      aiMode === 'head' ? "bg-white/10 text-text-warm" : "text-text-muted hover:text-text-warm"
                    )}
                  >
                    <Smile size={14} />
                    轉頭
                  </button>
                  <button
                    onClick={() => setAiMode('blink')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                      aiMode === 'blink' ? "bg-white/10 text-text-warm" : "text-text-muted hover:text-text-warm"
                    )}
                  >
                    <Eye size={14} />
                    眨眼
                  </button>
                </div>
              )}
              <button 
                onClick={() => setIsAutoTurnEnabled(!isAutoTurnEnabled)}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all",
                  isAutoTurnEnabled ? "bg-emerald-500 text-bg-warm shadow-lg shadow-emerald-500/20" : "bg-white/5 text-text-muted hover:text-text-warm"
                )}
              >
                {isModelLoading ? <Loader2 size={18} className="animate-spin" /> : (aiMode === 'head' ? <Smile size={18} /> : <Eye size={18} />)}
                智能翻頁
              </button>
              <button 
                onClick={() => {
                  const nextRecorderState = !showRecorder;
                  setShowRecorder(nextRecorderState);
                  if (nextRecorderState) {
                    setShowVideoPlayer(false);
                    if (!isSplitScreen) setIsSplitScreen(true);
                  }
                }}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all",
                  showRecorder ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-white/5 text-text-muted hover:text-text-warm"
                )}
              >
                <Camera size={18} />
                錄影模式
              </button>
              <button 
                onClick={() => {
                  if (showVideoPlayer) {
                    setShowVideoPlayer(false);
                    setVideoFileUrl(null);
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all",
                  showVideoPlayer ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-white/5 text-text-muted hover:text-text-warm"
                )}
              >
                <Play size={18} />
                觀看影片
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="video/*" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setVideoFileUrl(url);
                    setShowVideoPlayer(true);
                    setShowRecorder(false);
                    if (!isSplitScreen) {
                      setIsSplitScreen(true);
                    }
                  }
                  // Reset input value so the same file can be selected again
                  if (e.target) e.target.value = '';
                }} 
              />
            </div>
          </footer>
        </main>

        {/* Split Screen Panel */}
        {isSplitScreen && (showRecorder || showVideoPlayer) && (
          <div className="w-[300px] md:w-[360px] lg:w-[480px] xl:w-[560px] shrink-0 bg-surface-warm border-l border-white/10 relative">
            <div className="w-full h-full bg-black relative">
              {showRecorder && (
                <VideoRecorder
                  activeScoreName={score.name}
                  scoreId={score.id}
                  onSaved={loadRecordings}
                  isMinimized={false}
                  onToggleMinimize={() => {}}
                />
              )}
              {showVideoPlayer && videoFileUrl && (
                <div className="w-full h-full flex flex-col items-center justify-center relative">
                  <div className="absolute top-4 right-4 z-10">
                    <button 
                      onClick={() => {
                        setShowVideoPlayer(false);
                        setVideoFileUrl(null);
                        if (!showRecorder) setIsSplitScreen(false);
                      }}
                      className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/80 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <video 
                    ref={demoVideoRef}
                    src={videoFileUrl} 
                    controls 
                    playsInline 
                    className="w-full h-full object-contain"
                    onLoadedMetadata={() => applyPlaybackSpeed(demoVideoRef.current, videoSpeed)}
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                    <PlaybackSpeedControl
                      value={videoSpeed}
                      onChange={(s) => {
                        setVideoSpeed(s);
                        applyPlaybackSpeed(demoVideoRef.current, s);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Sidebar - Features (Optional/Contextual) */}
        <aside className="w-20 shrink-0 bg-surface-warm/50 border-l border-white/5 flex flex-col items-center py-6 gap-6 z-10">
          <button 
            onClick={() => setShowMasteryPopover(!showMasteryPopover)}
            aria-label="曲目熟練度" title="曲目熟練度"
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
              mastery > 0 ? "bg-amber-500/20 text-amber-500" : "bg-white/5 text-text-muted hover:text-text-warm"
            )}
          >
            <Star size={24} className={cn(mastery > 0 && "fill-amber-500")} />
          </button>
          <button 
            onClick={() => setShowTempoHistory(!showTempoHistory)}
            aria-label="速度與節拍器" title="速度與節拍器"
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
              showTempoHistory ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-white/5 text-text-muted hover:text-text-warm"
            )}
          >
            <TrendingUp size={24} />
          </button>
          <button
            onClick={() => {
              const next = !showSections;
              setShowSections(next);
              // 關掉面板就不該還停在框選狀態，否則樂譜會一直點不動
              if (!next) cancelDraft();
            }}
            aria-label="段落循環練習" title="段落循環練習"
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
              showSections ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "bg-white/5 text-text-muted hover:text-text-warm"
            )}
          >
            <Repeat size={24} />
          </button>
          <button
            onClick={() => setShowRecordings(!showRecordings)}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative",
              showRecordings ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30" : "bg-white/5 text-text-muted hover:text-text-warm"
            )}
            title="本曲錄影紀錄"
            /* 需要 aria-label：有錄影時按鈕內會出現數字徽章，
               可及名稱會被徽章的數字蓋過（螢幕閱讀器只會念出「1」），title 不會生效 */
            aria-label="本曲錄影紀錄"
          >
            <Video size={24} />
            {recordings.length > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-accent-warm text-bg-warm text-[10px] font-bold rounded-full flex items-center justify-center"
              >
                {recordings.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              const nextState = !isSplitScreen;
              setIsSplitScreen(nextState);
              if (nextState && !showRecorder && !showVideoPlayer) {
                setShowRecorder(true);
              }
            }}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
              isSplitScreen ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "bg-white/5 text-text-muted hover:text-text-warm"
            )}
          
            aria-label="分割畫面" title="分割畫面"
          >
            <Columns size={24} />
          </button>
        </aside>
      </div>

      {/* Popovers */}
      {showBpmPopover && (
        <div className={cn(PANEL_BASE, "top-20 sm:w-72")}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Music size={20} className="text-accent-warm" />
              <span className="text-sm font-bold text-text-warm uppercase tracking-widest">節拍速度</span>
            </div>
            <button 
              onClick={() => setShowBpmPopover(false)}
              aria-label="關閉速度設定" title="關閉速度設定"
              className="text-text-muted hover:text-text-warm"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex flex-col items-center mb-6">
            <div className="text-5xl font-bold font-mono text-text-warm mb-2">{currentBpm}</div>
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">BPM</div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => setCurrentBpm(Math.max(30, currentBpm - 1))}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-warm rounded-xl transition-all"
            >
              <Minus size={20} />
            </button>
            <input 
              type="range" 
              min="30" 
              max="300" 
              value={currentBpm} 
              onChange={(e) => setCurrentBpm(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-warm"
            />
            <button 
              onClick={() => setCurrentBpm(Math.min(300, currentBpm + 1))}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-warm rounded-xl transition-all"
            >
              <Plus size={20} />
            </button>
          </div>

          <button 
            onClick={() => setIsMetronomePlaying(!isMetronomePlaying)}
            className={cn(
              "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
              isMetronomePlaying ? "bg-white/10 text-text-warm" : "bg-accent-warm text-bg-warm shadow-lg shadow-accent-warm/20"
            )}
          >
            {isMetronomePlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            {isMetronomePlaying ? '停止' : '開始'}
          </button>
        </div>
      )}

      {showMasteryPopover && (
        <div className={cn(PANEL_BASE, "top-20 sm:w-72")}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-text-warm uppercase tracking-widest">曲目熟練度</span>
            <span className="text-2xl font-mono font-bold text-amber-500">{mastery}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="5"
            value={mastery} 
            onChange={(e) => {
              setMastery(parseInt(e.target.value));
              setHasUnsavedChanges(true);
            }}
            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500 mb-6"
          />
          <div className="flex justify-between text-[10px] text-text-muted font-bold uppercase tracking-tighter">
            <span>剛開始</span>
            <span>視奏中</span>
            <span>背譜中</span>
            <span>已精通</span>
          </div>
          <button 
            onClick={() => setShowMasteryPopover(false)}
            className="w-full mt-6 py-3 bg-accent-warm text-bg-warm rounded-xl font-bold transition-all active:scale-95"
          >
            完成設定
          </button>
        </div>
      )}

      {showTempoHistory && (
        <div className={cn(PANEL_BASE, "top-36 sm:w-80")}>
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-bold text-text-warm uppercase tracking-widest">速度與節拍器</span>
            <button onClick={() => setShowTempoHistory(false)} aria-label="關閉速度面板" title="關閉速度面板" className="text-text-muted hover:text-text-warm"><X size={20} /></button>
          </div>
          
          <div className="bg-white/5 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">當前 BPM</span>
                <span className="text-3xl font-mono font-bold text-emerald-500">{currentBpm}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <button onClick={() => setCurrentBpm(Math.min(300, currentBpm + 1))} className="p-2 hover:bg-white/10 rounded-lg"><ChevronUp size={20} /></button>
                  <button onClick={() => setCurrentBpm(Math.max(30, currentBpm - 1))} className="p-2 hover:bg-white/10 rounded-lg"><ChevronDown size={20} /></button>
                </div>
                <button 
                  onClick={() => setIsMetronomePlaying(!isMetronomePlaying)}
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
                    isMetronomePlaying ? "bg-red-500 text-white shadow-red-500/30" : "bg-emerald-500 text-bg-warm shadow-emerald-500/30"
                  )}
                >
                  {isMetronomePlaying ? <Pause size={28} /> : <Play size={28} />}
                </button>
              </div>
            </div>
          </div>

          {/* 這首曲子的累計練習時間 —— 計時器記錄練習時會帶上曲目歸屬 */}
          <div className="mb-4 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-widest text-text-muted">本曲累計練習</span>
            <span className="text-sm font-bold text-text-warm" data-testid="score-practice-total">
              {formatPracticeTotal(practiceTotalSeconds)}
            </span>
          </div>

          <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            <TempoProgressChart history={score.tempoHistory} />
          </div>
        </div>
      )}

      {showSections && (
        <div className={cn(PANEL_BASE, "top-20 sm:w-80")}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-text-warm uppercase tracking-widest">段落循環練習</span>
            <button
              onClick={() => { setShowSections(false); cancelDraft(); }}
              aria-label="關閉段落面板" title="關閉段落面板"
              className="text-text-muted hover:text-text-warm"
            >
              <X size={20} />
            </button>
          </div>

          {/* 框選 / 命名 */}
          {draftRect ? (
            <div className="mb-4 rounded-xl bg-white/5 p-3">
              <label className="block text-xs font-bold text-text-muted mb-1.5" htmlFor="section-name">
                段落名稱
              </label>
              <input
                id="section-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveDraftSection(); }}
                placeholder="例如：第 45-52 小節"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-warm focus:outline-none focus:border-accent-warm mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={cancelDraft}
                  className="flex-1 py-2 rounded-xl bg-white/5 text-text-muted text-sm font-bold hover:bg-white/10 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={saveDraftSection}
                  className="flex-1 py-2 rounded-xl bg-accent-warm text-bg-warm text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  儲存段落
                </button>
              </div>
            </div>
          ) : isSelectingSection ? (
            <div className="mb-4 rounded-xl bg-accent-warm/10 border border-accent-warm/30 p-3">
              <p className="text-xs text-text-warm mb-2">
                在樂譜上拖曳，框出要反覆練的那幾小節。
              </p>
              <button
                onClick={cancelDraft}
                className="w-full py-2 rounded-xl bg-white/5 text-text-muted text-sm font-bold hover:bg-white/10 transition-colors"
              >
                取消框選
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsSelectingSection(true);
                setActiveSectionId(null);
                // 框選時不該同時在畫線
                setIsDrawingMode(false);
              }}
              className="w-full mb-4 py-2.5 rounded-xl bg-accent-warm text-bg-warm text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Plus size={16} /> 框選新段落
            </button>
          )}

          {/* 循環計數器 */}
          {activeSection && (
            <div className="mb-4 rounded-2xl bg-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-accent-warm truncate">{activeSection.name}</span>
                <button
                  onClick={() => setActiveSectionId(null)}
                  className="text-[10px] font-bold text-text-muted hover:text-text-warm uppercase tracking-widest shrink-0"
                >
                  結束練習
                </button>
              </div>

              <div className="text-center mb-3">
                <div className="text-5xl font-black text-text-warm leading-none" data-testid="section-reps">
                  {activeSection.reps}
                </div>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-1">遍</div>
                {activeSection.bestBpm !== undefined && (
                  <div className="text-xs text-text-muted mt-2">
                    最快練到 <span className="font-bold text-text-warm">{activeSection.bestBpm}</span> BPM
                  </div>
                )}
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={resetReps}
                  className="flex-1 py-2 rounded-xl bg-white/5 text-text-muted text-sm font-bold hover:bg-white/10 transition-colors"
                >
                  重設
                </button>
                <button
                  onClick={addRepManually}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-bg-warm text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  +1 遍
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-text-muted mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCountReps}
                  onChange={(e) => setAutoCountReps(e.target.checked)}
                  className="accent-accent-warm"
                />
                跟著節拍器自動計遍數
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-muted shrink-0" htmlFor="bars-per-rep">
                  每遍小節數
                </label>
                <input
                  id="bars-per-rep"
                  type="number"
                  min={MIN_BARS_PER_REP}
                  max={MAX_BARS_PER_REP}
                  value={barsPerRep}
                  disabled={!autoCountReps}
                  onChange={(e) => setBarsPerRep(clampBarsPerRep(parseInt(e.target.value, 10)))}
                  className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-text-warm focus:outline-none focus:border-accent-warm disabled:opacity-40"
                />
              </div>
            </div>
          )}

          {/* 段落清單 */}
          {sections.length === 0 ? (
            <p className="text-xs text-text-muted leading-relaxed">
              尚未建立段落。把難的那幾小節框起來，練習時畫面會只亮出那一塊，
              並幫你數練了幾遍、最快練到多少 BPM。
            </p>
          ) : (
            <div className="space-y-2">
              {sections.map((section) => (
                <div
                  key={section.id}
                  data-testid="section-row"
                  className={cn(
                    "flex items-center gap-2 rounded-xl p-2 transition-colors",
                    section.id === activeSectionId ? "bg-accent-warm/15" : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  <button
                    onClick={() => activateSection(section)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-sm font-bold text-text-warm truncate">{section.name}</div>
                    <div className="text-[10px] text-text-muted">
                      第 {section.page + 1} 頁 · {section.reps} 遍
                      {section.bestBpm !== undefined && ` · 最快 ${section.bestBpm} BPM`}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteSection(section.id)}
                    aria-label={`刪除段落 ${section.name}`}
                    title="刪除段落"
                    className="text-text-muted hover:text-rose-400 p-1 shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showRecordings && (
        <div className={cn(PANEL_BASE, "top-20 sm:w-96")}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-text-warm uppercase tracking-widest">本曲錄影紀錄</span>
            <button onClick={() => setShowRecordings(false)} aria-label="關閉錄影清單" title="關閉錄影清單" className="text-text-muted hover:text-text-warm"><X size={20} /></button>
          </div>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
            {recordings.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8 leading-relaxed">
                尚無錄影紀錄。<br />
                開啟「錄影模式」錄製後，按「儲存」即可留存在這裡。
              </p>
            ) : (
              recordings.map((r) => (
                <RecordingPlayer
                  key={r.id}
                  recording={r}
                  url={recordingUrls[r.id]}
                  onDelete={handleDeleteRecording}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Recorder Overlay (Floating) */}
      {(showRecorder || showVideoPlayer) && !isSplitScreen && (
        <div className={cn(
          "fixed z-40 transition-all duration-500 ease-in-out",
          cn(
            recorderPosition === 'top-right' && "top-20 right-24",
            recorderPosition === 'top-left' && "top-20 left-24",
            recorderPosition === 'bottom-right' && "bottom-20 right-24",
            recorderPosition === 'bottom-left' && "bottom-20 left-24",
            isRecorderMinimized ? "w-16 h-16" : "w-80 h-[60vh] max-h-[600px]"
          )
        )}>
          <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
            {showRecorder && (
              <VideoRecorder
                activeScoreName={score.name}
                scoreId={score.id}
                onSaved={loadRecordings}
                isMinimized={isRecorderMinimized}
                onToggleMinimize={() => setIsRecorderMinimized(!isRecorderMinimized)}
                recorderPosition={recorderPosition}
                onPositionChange={setRecorderPosition}
              />
            )}
            {showVideoPlayer && videoFileUrl && (
              <div className="w-full h-full flex flex-col relative">
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                  <button 
                    onClick={() => setIsRecorderMinimized(!isRecorderMinimized)}
                    className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/80 transition-colors"
                  >
                    {isRecorderMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                  </button>
                  <button 
                    onClick={() => {
                      setShowVideoPlayer(false);
                      setVideoFileUrl(null);
                    }}
                    className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/80 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                {!isRecorderMinimized && (
                  <>
                    <video 
                      ref={demoVideoRef}
                      src={videoFileUrl} 
                      controls 
                      playsInline 
                      className="w-full h-full object-contain"
                      onLoadedMetadata={() => applyPlaybackSpeed(demoVideoRef.current, videoSpeed)}
                    />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                      <PlaybackSpeedControl
                        value={videoSpeed}
                        onChange={(s) => {
                          setVideoSpeed(s);
                          applyPlaybackSpeed(demoVideoRef.current, s);
                        }}
                      />
                    </div>
                  </>
                )}
                {isRecorderMinimized && (
                  <div 
                    className="w-full h-full flex items-center justify-center bg-surface-warm cursor-pointer"
                    onClick={() => setIsRecorderMinimized(false)}
                  >
                    <Play size={24} className="text-accent-warm" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Page Turn Camera Preview (Hidden but must have dimensions for MediaPipe) */}
      <video ref={videoRef} autoPlay playsInline muted className="absolute opacity-0 pointer-events-none w-[320px] h-[240px] z-[-1]" />
    </div>
  );
};
