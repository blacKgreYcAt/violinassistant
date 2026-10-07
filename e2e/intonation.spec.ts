import { test, expect, Page } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 音準回放分析。
 *
 * 這個功能沒辦法用單元測試端對端驗證：它牽涉 IndexedDB 讀取、SVG 繪製、
 * 以及和媒體播放位置的同步。而要走完整的錄製流程又需要真實的麥克風輸入，
 * 在 CI 環境裡拿不到 —— 所以改成直接把一筆合成的錄影資料寫進 IndexedDB，
 * 再從介面上驗證分析結果。
 */

const SCORE_ID = 'e2e-intonation-score';
const SCORE_NAME = '音準分析測試曲';

/**
 * 寫入一份樂譜與一筆帶音準資料的錄影。
 * 資料刻意設計成可以驗算的形狀：
 *   0–8s   準（±4 音分）
 *   8–12s  偏高 30 音分
 *   12–18s 準
 *   18–30s 偏低 22 音分
 * 準的時間共 14 秒 / 全長 30 秒 → 準確率應該接近 47%
 */
async function seedRecording(page: Page) {
  await page.evaluate(
    async ({ scoreId, scoreName }) => {
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
        { id: scoreId, name: scoreName, type: 'file', data: PNG, date: Date.now() },
      ]);

      const startedAt = Date.now() - 30_000;
      const data: { time: number; pitch: number; cents: number }[] = [];
      for (let i = 0; i < 750; i++) {
        const t = i * 0.04;
        let cents: number;
        if (t < 8) cents = 2;
        else if (t < 12) cents = 30;
        else if (t < 18) cents = -2;
        else cents = -22;
        data.push({ time: startedAt + t * 1000, pitch: 440, cents });
      }

      await idbSet('viola-recordings-idb', [
        {
          id: 'e2e-rec',
          scoreId,
          timestamp: Date.now(),
          type: 'audio',
          blob: new Blob([new Uint8Array([0, 0, 0, 0])], { type: 'audio/mp4' }),
          startedAt,
          intonationData: data,
        },
      ]);
    },
    { scoreId: SCORE_ID, scoreName: SCORE_NAME }
  );
}

test('錄影的音準資料會被分析並呈現出來', async ({ page }) => {
  await page.goto('/');
  await seedRecording(page);
  await openApp(page);
  await openLibraryTab(page);

  // 開啟樂譜檢視器
  await page.getByText(SCORE_NAME).first().click();
  await expect(page.getByRole('button', { name: '本曲錄影紀錄' })).toBeVisible();

  await page.getByRole('button', { name: '本曲錄影紀錄' }).click();

  // 迴歸測試：intonationData 先前只被寫入、從未被讀出來顯示過。
  const chart = page.locator('svg[aria-label^="音準曲線"]');
  await expect(chart).toBeVisible();

  // 準確的時間佔 14/30，準確率應該落在 47% 附近
  const accuracy = await page.getByText(/準確率\s*\d+%/).textContent();
  const percent = Number(accuracy!.match(/(\d+)%/)![1]);
  expect(percent).toBeGreaterThan(40);
  expect(percent).toBeLessThan(55);

  // 兩段離譜的區間都要被指出來（+30 的那段與 -22 的那段）
  await expect(page.getByText('最需要注意的片段')).toBeVisible();
  await expect(page.getByRole('button', { name: /0:08/ })).toBeVisible();
});

test('點擊問題片段會把播放位置跳到該時間點', async ({ page }) => {
  await page.goto('/');
  await seedRecording(page);
  await openApp(page);
  await openLibraryTab(page);

  await page.getByText(SCORE_NAME).first().click();
  await page.getByRole('button', { name: '本曲錄影紀錄' }).click();
  await expect(page.locator('svg[aria-label^="音準曲線"]')).toBeVisible();

  // 這是這個功能最實用的地方：直接跳到拉不準的那一段去聽
  await page.getByRole('button', { name: /0:08/ }).click();

  const currentTime = await page.locator('audio').evaluate(
    (el: HTMLAudioElement) => el.currentTime
  );
  expect(Math.abs(currentTime - 8)).toBeLessThan(1.5);
});


test('未指定曲目的錄影可以在「練習錄影」總覽中查看與分析', async ({ page }) => {
  await page.goto('/');

  // 寫入一段沒有歸屬曲目的錄影 —— 從「樂譜與紀錄」分頁直接錄的就是這種。
  // 迴歸測試：這類錄影先前存進 IndexedDB 後沒有任何畫面會列出它，
  // 等於永遠看不到也刪不掉，空間卻一直被佔用。
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
    const startedAt = Date.now() - 20_000;
    const data = Array.from({ length: 500 }, (_, i) => ({
      time: startedAt + i * 40,
      pitch: 440,
      cents: i < 250 ? 2 : -25,
    }));
    await idbSet('viola-recordings-idb', [
      {
        id: 'e2e-unassigned',
        scoreId: 'unknown',
        timestamp: Date.now(),
        type: 'audio',
        blob: new Blob([new Uint8Array([0, 0, 0, 0])], { type: 'audio/mp4' }),
        startedAt,
        intonationData: data,
      },
    ]);
  });

  await openApp(page);

  // 入口放在全域標題列，不開任何樂譜也能進去
  await page.getByRole('button', { name: '練習錄影' }).click();

  const entry = page.getByTestId('recording-entry');
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText('未指定曲目');

  // 展開才會建立 object URL 與繪製圖表（避免一次把所有影片釘在記憶體裡）
  await entry.getByRole('button').first().click();
  await expect(page.locator('svg[aria-label^="音準曲線"]')).toBeVisible();

  // 一半準一半偏離 25 音分 → 準確率應該在 50% 附近
  const accuracy = await page.getByText(/準確率\s*\d+%/).textContent();
  const percent = Number(accuracy!.match(/(\d+)%/)![1]);
  expect(percent).toBeGreaterThan(40);
  expect(percent).toBeLessThan(60);
});
