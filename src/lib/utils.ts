import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 判斷錯誤是否為「使用者自己取消分享／存檔」。
 *
 * navigator.share() 在使用者按取消時會 reject 一個 name 為 'AbortError' 的錯誤，
 * 那不是真的失敗，不該再跳出下載或錯誤訊息。
 * 原本三個檔案各自寫 `(error as any).name !== 'AbortError'`，用 any 繞過型別檢查。
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
