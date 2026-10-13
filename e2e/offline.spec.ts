import { test, expect } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 離線行為與程式碼分割。
 *
 * 這個 App 是可離線的 PWA，但「智能翻頁」的臉部偵測模型與 WASM 都放在 CDN，
 * 離線時一定會失敗。原本失敗只是把開關默默關掉——使用者按了，轉一下就自己關了，
 * 完全不知道發生什麼事。
 */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('離線時按智能翻頁會說明原因，而不是默默關掉', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    (png) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(
            [{ id: 'offline-score', name: '離線測試曲', type: 'file', data: png, date: Date.now() }],
            'viola-scores-idb'
          );
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    PNG
  );

  await openApp(page);
  await openLibraryTab(page);
  await page.getByText('離線測試曲').first().click();

  // 讓 MediaPipe 的 CDN 請求全部失敗，並讓 navigator.onLine 回報離線
  await page.route('**/cdn.jsdelivr.net/**', (route) => route.abort());
  await page.route('**/storage.googleapis.com/**', (route) => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false });
  });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
  });

  await page.getByRole('button', { name: '智能翻頁' }).click();

  const alert = page.getByTestId('auto-turn-error');
  await expect(alert).toBeVisible({ timeout: 20_000 });
  await expect(alert).toContainText('離線');
  // 要說清楚只有這一項受影響，不要讓人以為整個 App 壞了
  await expect(alert).toContainText('其他功能不受影響');
  await expect(alert).toHaveAttribute('role', 'alert');
});

test('第一次載入不會下載樂譜分頁與臉部偵測的程式碼', async ({ page }) => {
  const scripts: string[] = [];
  page.on('response', (res) => {
    const url = res.url();
    if (url.endsWith('.js') && url.includes('/assets/')) scripts.push(url);
  });

  await openApp(page);

  // 迴歸測試：主 bundle 原本是 972KB，裡面包含只有切到樂譜分頁
  // 或開啟智能翻頁才用得到的程式碼（recharts、MediaPipe）。
  const names = scripts.map((u) => u.split('/').pop() ?? '');
  expect(names.some((n) => n.startsWith('LibraryTab')), '樂譜分頁不該在第一次載入時下載').toBe(
    false
  );
  expect(names.some((n) => n.startsWith('vision_bundle')), 'MediaPipe 不該在第一次載入時下載').toBe(
    false
  );
  expect(names.some((n) => n.startsWith('ScoreViewer')), '樂譜檢視器不該在第一次載入時下載').toBe(
    false
  );

  // 切到樂譜分頁後才載入
  await openLibraryTab(page);
  await expect
    .poll(() => scripts.map((u) => u.split('/').pop() ?? '').some((n) => n.startsWith('LibraryTab')))
    .toBe(true);
});

test('完全離線時 App 仍能開啟並使用', async ({ page, context }) => {
  // 先正常載入一次，讓 service worker 把檔案快取起來
  await openApp(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  // 斷網
  await context.setOffline(true);
  await page.reload();

  // 這是個可離線的 PWA：主要功能都不該依賴網路
  await expect(page.getByRole('button', { name: '練習工具' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('metronome')).toBeVisible();
  await expect(page.getByTestId('timer')).toBeVisible();

  // 節拍器要能實際跑起來
  const metronome = page.getByTestId('metronome');
  await metronome.getByRole('button', { name: '開始' }).click();
  await expect(metronome.getByRole('button', { name: '停止' })).toBeVisible();

  await context.setOffline(false);
});

test('節拍器長時間執行時拍數不會飄掉', async ({ page }) => {
  // 這個測試本身就要跑 30 秒，超過預設的 30 秒上限
  test.slow();
  await openApp(page);

  // 用 audioContext 的時鐘對照實際發出的小節數。
  // 這是長時間穩定性的替代驗證 —— 真的跑一小時在 CI 不實際。
  await page.evaluate(() => {
    const w = window as unknown as { __bars: number };
    w.__bars = 0;
    window.addEventListener('metronome-bar', (e) => {
      w.__bars += (e as CustomEvent<{ completedBars: number }>).detail.completedBars;
    });
  });

  const metronome = page.getByTestId('metronome');
  await metronome.getByRole('button', { name: '開始' }).click();

  // 100 BPM、4/4 → 每小節 2.4 秒。跑 30 秒約 12 小節。
  await page.waitForTimeout(30_000);
  await metronome.getByRole('button', { name: '停止' }).click();

  const bars = await page.evaluate(() => (window as unknown as { __bars: number }).__bars);

  // 允許前後各一小節的誤差（開始的前置延遲與停止的時間點）
  expect(bars, `30 秒內收到 ${bars} 個小節，預期約 12`).toBeGreaterThanOrEqual(10);
  expect(bars).toBeLessThanOrEqual(14);
});
