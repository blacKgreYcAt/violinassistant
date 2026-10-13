import { test, expect, Page } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 兩個分頁同時開啟。
 *
 * 所有寫入都是「讀出整個陣列 → 改 → 整個寫回」。實測過：兩個分頁各自
 * 新增一份樂譜時，後寫的那個會用自己較早讀到的資料覆蓋掉另一個分頁剛加的，
 * 而且完全沒有提示。
 *
 * 加上 BroadcastChannel 之後，另一個分頁會立刻重新載入，大幅縮小
 * 「拿著過期資料寫回去」的時間窗。ScoreLibrary 本來就在聽 scores-updated，
 * 所以不需要改任何元件。
 */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function seed(page: Page) {
  await page.evaluate(
    (png) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(
            [
              { id: 'a', name: '第一首', type: 'file', data: png, date: 2 },
              { id: 'b', name: '第二首', type: 'file', data: png, date: 1 },
            ],
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

test('一個分頁刪了樂譜，另一個分頁會自動更新', async ({ context }) => {
  const tabA = await context.newPage();
  await tabA.goto('/');
  await seed(tabA);
  await openApp(tabA);
  await openLibraryTab(tabA);

  const tabB = await context.newPage();
  await tabB.goto('/');
  await openApp(tabB);
  await openLibraryTab(tabB);

  // 兩個分頁都看得到兩首
  await expect(tabA.getByText('第二首')).toBeVisible();
  await expect(tabB.getByText('第二首')).toBeVisible();

  // B 分頁刪掉第二首（走真實 UI，會呼叫 saveScores）
  tabB.on('dialog', (d) => d.accept());
  await tabB.getByRole('button', { name: '刪除 第二首' }).click();
  await expect(tabB.getByText('第二首')).toHaveCount(0);

  // 迴歸測試：沒有跨分頁同步時，A 分頁會一直停在舊畫面，
  // 接下來任何一個寫入都會把 B 剛刪掉的那首又寫回去。
  await expect(tabA.getByText('第二首'), 'A 分頁沒有跟著更新').toHaveCount(0, {
    timeout: 5000,
  });
});
