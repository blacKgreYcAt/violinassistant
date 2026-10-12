import { test, expect, Page } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 元件出錯時不會變成一整片白畫面。
 *
 * 沒有 Error Boundary 的話，任何 render 階段的例外都會讓 React 卸載整棵樹。
 * 對一個資料全存在本機的 App 來說，白畫面看起來就像資料全沒了——而使用者
 * 的第一反應很可能是「清除瀏覽器資料重裝」，那才會真的把紀錄刪掉。
 *
 * 測的是真實的失敗情境：動態載入的 chunk 要不到。這在改版後特別容易發生
 * （舊分頁拿著舊的檔名去要，而那個檔名已經不存在了）。
 */

// PWA 的 service worker 會預先快取所有 chunk，由它供應的請求 page.route 攔不到。
// 要模擬「檔案要不到」就必須先把 SW 擋掉。
test.use({ serviceWorkers: 'block' });

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function seedScore(page: Page) {
  await page.evaluate(
    (png) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(
            [{ id: 'eb-score', name: '錯誤邊界測試曲', type: 'file', data: png, date: Date.now() }],
            'viola-scores-idb'
          );
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    PNG
  );
}

test('樂譜檢視器載不進來時，只有它壞掉，其餘功能仍可用', async ({ page }) => {
  await page.goto('/');
  await seedScore(page);
  // 模擬改版後舊快取要不到檔案
  await page.route('**/assets/ScoreViewer-*.js', (route) => route.abort());

  await openApp(page);
  await openLibraryTab(page);
  await page.getByText('錯誤邊界測試曲').first().click();

  const error = page.getByTestId('score-viewer-error');
  await expect(error).toBeVisible({ timeout: 20_000 });
  // 最重要的一句話：資料沒有不見
  await expect(error).toContainText('沒有遺失');
  await expect(error).toHaveAttribute('role', 'alert');

  // 按「返回」要能回到主畫面，而不是卡在錯誤畫面
  await error.getByRole('button', { name: '返回' }).click();
  await expect(error).toHaveCount(0);
  await expect(page.getByRole('button', { name: '練習工具' })).toBeVisible();
});

test('樂譜分頁載不進來時，練習工具分頁仍然可用', async ({ page }) => {
  await page.goto('/');
  await page.route('**/assets/LibraryTab-*.js', (route) => route.abort());

  await openApp(page);
  await page.getByRole('button', { name: '樂譜與紀錄' }).click();

  await expect(page.getByText('這一頁載入失敗了。')).toBeVisible({ timeout: 20_000 });

  // 切回練習工具要照常運作
  await page.getByRole('button', { name: '練習工具' }).click();
  await expect(page.getByTestId('metronome')).toBeVisible();
  await expect(page.getByTestId('timer')).toBeVisible();
});
