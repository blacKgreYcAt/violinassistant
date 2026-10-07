import { test, expect } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 曲目速度進展圖與節拍器細分拍。
 *
 * 速度紀錄是 ScoreViewer 在節拍器停止時寫入的，要走完整流程會需要
 * 等待真實的節拍器運作；這裡改成直接寫入歷史資料再驗證呈現結果。
 */

const SCORE_NAME = '速度測試曲';

test('曲目速度進展會畫成圖表並算出進步幅度', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(async (scoreName) => {
    function idbSet(key: string, value: unknown) {
      return new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    }
    const PNG =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const DAY = 86_400_000;
    const now = Date.now();
    // 20 天內從 60 練到 90
    const bpms = [60, 65, 70, 72, 78, 84, 90];
    await idbSet('viola-scores-idb', [
      {
        id: 'tempo-score',
        name: scoreName,
        type: 'file',
        data: PNG,
        date: now,
        tempoHistory: bpms.map((bpm, i) => ({ bpm, date: now - (20 - i * (20 / 6)) * DAY })),
      },
    ]);
  }, SCORE_NAME);

  await openApp(page);
  await openLibraryTab(page);
  await page.getByText(SCORE_NAME).first().click();

  // 迴歸測試：這些數字原本只是一張平板清單，看不出有沒有進步
  await page.getByRole('button', { name: '速度與節拍器' }).click();

  await expect(page.getByText(/\d+ 天內從 60 練到 90 BPM/)).toBeVisible();
  await expect(page.getByText('+30')).toBeVisible();
  await expect(page.getByText('練習 7 天')).toBeVisible();
  await expect(page.getByText(/最高 90 BPM/)).toBeVisible();
});

test('沒有速度紀錄時顯示說明而不是空白', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    function idbSet(key: string, value: unknown) {
      return new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    }
    const PNG =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await idbSet('viola-scores-idb', [
      { id: 'empty-score', name: '新曲子', type: 'file', data: PNG, date: Date.now() },
    ]);
  });

  await openApp(page);
  await openLibraryTab(page);
  await page.getByText('新曲子').first().click();
  await page.getByRole('button', { name: '速度與節拍器' }).click();

  await expect(page.getByText('尚無速度紀錄。')).toBeVisible();
  // 要告訴使用者怎麼產生紀錄，不能只留一句「沒有資料」
  await expect(page.getByText(/開啟節拍器練習這首曲子/)).toBeVisible();
});

test('節拍器可以切換細分拍', async ({ page }) => {
  await openApp(page);

  // 迴歸測試：細分拍是慢練最常用的功能之一，先前完全沒有
  const subdivision = page.getByLabel('細分拍');
  await expect(subdivision).toBeVisible();

  const options = await subdivision.locator('option').allTextContents();
  expect(options).toEqual(['不細分', '八分', '三連音', '十六分']);

  await subdivision.selectOption({ label: '三連音' });
  await expect(subdivision).toHaveValue('3');

  // 切換後節拍器仍能正常啟動
  const metronome = page.getByTestId('metronome');
  await metronome.getByRole('button', { name: '開始' }).click();
  await expect(metronome.getByRole('button', { name: '停止' })).toBeVisible();
  // 細分點不應該讓拍點燈號亂跳：任何時刻仍然只有一顆亮著
  await expect(metronome.locator('[data-testid="beat-dot"][data-active="true"]')).toHaveCount(1);
});

test('樂譜檢視器的側欄按鈕都有可及名稱', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    function idbSet(key: string, value: unknown) {
      return new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    }
    const PNG =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await idbSet('viola-scores-idb', [
      { id: 'a11y-score', name: '無障礙測試曲', type: 'file', data: PNG, date: Date.now() },
    ]);
  });

  await openApp(page);
  await openLibraryTab(page);
  await page.getByText('無障礙測試曲').first().click();

  // 迴歸測試：側欄原本有 6 顆按鈕只有圖示、沒有任何標籤，
  // 螢幕閱讀器完全無法辨識它們的用途。
  const unlabelled = await page.locator('aside button').evaluateAll((els) =>
    els.filter((el) => !el.getAttribute('aria-label') && !el.getAttribute('title')).length
  );
  expect(unlabelled, '側欄仍有按鈕缺少可及名稱').toBe(0);
});

test('靜音小節：啟用後節拍器會週期性停止，且不顯示拍點位置', async ({ page }) => {
  await openApp(page);

  const metronome = page.getByTestId('metronome');
  await page.getByRole('button', { name: '靜音小節' }).click();

  // 設定區塊出現，預設響 2 靜 2
  await expect(page.getByLabel('發聲小節數')).toHaveValue('2');
  await expect(page.getByLabel('靜音小節數')).toHaveValue('2');

  await metronome.getByRole('button', { name: '開始' }).click();

  // 4/4、100 BPM 下每小節 2.4 秒，兩小節後進入靜音
  const indicator = page.getByTestId('silent-indicator');
  await expect(indicator).toBeVisible({ timeout: 15_000 });
  await expect(indicator).toContainText('靜音中');

  // 關鍵：靜音期間不能顯示拍點位置，否則就等於把拍子告訴使用者，
  // 失去「自己維持速度」的訓練意義
  await expect(metronome.locator('[data-testid="beat-dot"][data-active="true"]')).toHaveCount(0);
});
