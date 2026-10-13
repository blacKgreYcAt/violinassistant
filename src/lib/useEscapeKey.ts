import { useEffect } from 'react';

/**
 * 開著的彈窗按 Esc 要能關掉。
 *
 * 原本所有彈窗（使用說明、集點卡、錄影總覽、裁切、練習筆記）都只能用滑鼠
 * 點關閉鈕。對只用鍵盤的人來說，進得去出不來。
 *
 * 用 capture 階段監聽：有些彈窗裡的輸入框會自己處理 Escape（例如取消改名），
 * 那種情況下它們會呼叫 stopPropagation，這一層就不會再關掉整個彈窗。
 */
export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // 輸入法組字中按 Esc 是要取消候選字，不是要關閉視窗
      if (event.isComposing) return;
      onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);
}
