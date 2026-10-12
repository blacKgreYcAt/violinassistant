import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { STORAGE_ERROR_EVENT, StorageErrorDetail } from '../lib/storage';

/**
 * 顯示儲存失敗的提示。
 *
 * 為什麼需要這個：原本所有儲存失敗都只寫進 console，使用者以為練習紀錄
 * 存好了其實沒有。對一個「累積紀錄」的 App 來說，默默掉資料是最糟的失敗方式。
 *
 * 刻意不自動消失：這不是操作成功的回饋，而是「你剛剛做的事沒有被保留」，
 * 使用者必須真的看到並確認過。
 */
interface Toast extends StorageErrorDetail {
  id: string;
}

export const StorageErrorToast: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<StorageErrorDetail>).detail;
      if (!detail?.message) return;

      setToasts((prev) => {
        // 同一個錯誤可能連續發生（例如每次寫入都因配額失敗），
        // 重複訊息不要疊成一整面牆
        if (prev.some((t) => t.message === detail.message)) return prev;
        // 最多留三則，再多就看不完也擋住畫面
        return [...prev.slice(-2), { ...detail, id: crypto.randomUUID() }];
      });
    };

    window.addEventListener(STORAGE_ERROR_EVENT, onError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onError);
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2"
      data-testid="storage-error-toasts"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          data-testid="storage-error-toast"
          className="flex items-start gap-3 rounded-2xl border border-amber-500/50 bg-surface-warm p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2"
        >
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="flex-1 text-sm leading-relaxed text-text-warm">{toast.message}</p>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            aria-label="關閉提示"
            title="關閉提示"
            className="shrink-0 p-1 text-text-muted transition-colors hover:text-text-warm"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
};
