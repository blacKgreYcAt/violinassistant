import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * 攔下 render 階段的例外。
 *
 * 沒有這層的話，任何一個元件丟出例外，React 會把整棵樹卸載 ——
 * 使用者看到的是一整片白畫面。對一個資料全存在本機的 App 來說，
 * 白畫面看起來就像資料全沒了，而使用者的第一反應很可能是
 * 「清除瀏覽器資料重裝」—— 那才會真的把樂譜與練習紀錄刪掉。
 *
 * 所以錯誤畫面最重要的一句話是「你的資料還在，不要清除瀏覽器資料」。
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** 自訂的錯誤畫面；沒給就用整頁版本 */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('未被攔截的錯誤：', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        data-testid="app-error"
        className="fixed inset-0 z-[400] flex items-center justify-center bg-bg-warm p-6"
      >
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface-warm p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <AlertTriangle size={24} className="shrink-0 text-amber-400" />
            <h1 className="text-lg font-bold text-text-warm">App 遇到了問題</h1>
          </div>

          <p className="mb-3 text-sm leading-relaxed text-text-warm">
            你的樂譜、錄影與練習紀錄都存在這台裝置上，<strong className="text-accent-warm">沒有遺失</strong>。
          </p>
          <p className="mb-5 text-sm leading-relaxed text-text-muted">
            請先試著重新載入。<strong className="text-text-warm">不要清除瀏覽器資料或解除安裝</strong>
            ——那才會真的把這些紀錄刪掉。
          </p>

          <button
            onClick={() => window.location.reload()}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-warm py-3 font-bold text-bg-warm transition-opacity hover:opacity-90"
          >
            <RotateCw size={18} /> 重新載入
          </button>

          <details className="text-xs text-text-muted">
            <summary className="cursor-pointer hover:text-text-warm">技術細節（回報問題時可附上）</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
