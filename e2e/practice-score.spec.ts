import { test, expect, Page } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 練習時間關聯到曲目。
 *
 * 這個功能補的是一個很基本卻一直缺掉的能力：練習紀錄裡沒有曲目欄位，
 * 所以「我這個月在這首曲子上花了多少時間」答不出來。
 *
 * 計時器會預選最近開啟過的樂譜，使用者可以改選、也可以清成「未指定」。
 */

// 這組測試每個都要開關樂譜檢視器好幾次（每次都會重新載入樂譜圖片），
// 單一步驟都不慢，但累積起來會超過預設的 30 秒上限。
test.beforeEach(() => {
  test.slow();
});

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function seed(page: Page, key: string, value: unknown) {
  await page.evaluate(
    ([k, v]) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(v, k as string);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    [key, value] as [string, unknown]
  );
}

const SCORES = [
  { id: 'score-bach', name: '巴哈無伴奏', type: 'file', data: PNG, date: Date.now() },
  { id: 'score-kreutzer', name: '克萊采爾練習曲', type: 'file', data: PNG, date: Date.now() - 1000 },
];

/** 把計時器跑完 1 分鐘，讓練習筆記視窗跳出來 */
async function practiceOneMinute(page: Page) {
  const timer = page.getByTestId('timer');
  // 最短可設 1 分鐘；用滑桿設定比連按減號快。
  // 一定要限定在計時器裡——頁面上第一個 range 是節拍器的 BPM 滑桿。
  await timer.locator('input[type="range"]').fill('1');
  await timer.getByRole('button', { name: '開始' }).click();
  // 時間由 Playwright 的假時鐘推進，不必真的等一分鐘
  await page.clock.runFor(65_000);
  // 推完就把時鐘交還給瀏覽器：彈窗有 animate-in 動畫，
  // 時鐘凍結時它會停在 opacity 0 的起始影格，Playwright 會一直等不到它「可見」。
  await page.clock.resume();
}

test('計時器預選最近開啟的樂譜，練習時間會算到那首曲子上', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await seed(page, 'viola-scores-idb', SCORES);

  await openApp(page);
  await openLibraryTab(page);

  // 開啟其中一首，再關掉——「最近開啟」就是它
  await page.getByText('克萊采爾練習曲').first().click();
  await expect(page.getByRole('button', { name: '速度與節拍器' })).toBeVisible();
  await page.getByRole('button', { name: '關閉樂譜' }).click();

  await page.getByRole('button', { name: '練習工具' }).click();
  await practiceOneMinute(page);

  // 筆記視窗出現，而且曲目已經預選好剛才開過的那首
  const select = page.getByLabel('練習曲目');
  await expect(select).toBeVisible();
  await expect(select).toHaveValue('score-kreutzer');

  await page.getByRole('button', { name: '略過' }).click();

  // 回到那首樂譜，累計練習時間應該出現
  await openLibraryTab(page);
  await page.getByText('克萊采爾練習曲').first().click();
  await page.getByRole('button', { name: '速度與節拍器' }).click();
  await expect(page.getByTestId('score-practice-total')).toHaveText('1 分鐘');
});

test('預選的曲目可以改成別首', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await seed(page, 'viola-scores-idb', SCORES);

  await openApp(page);
  await openLibraryTab(page);
  await page.getByText('克萊采爾練習曲').first().click();
  await page.getByRole('button', { name: '關閉樂譜' }).click();
  await page.getByRole('button', { name: '練習工具' }).click();

  await practiceOneMinute(page);

  const select = page.getByLabel('練習曲目');
  await expect(select).toHaveValue('score-kreutzer');
  await select.selectOption({ label: '巴哈無伴奏' });
  await page.getByRole('button', { name: '儲存' }).click();

  // 改選的那首才有時間，原本預選的那首不該被記上
  await openLibraryTab(page);
  await page.getByText('巴哈無伴奏').first().click();
  await page.getByRole('button', { name: '速度與節拍器' }).click();
  await expect(page.getByTestId('score-practice-total')).toHaveText('1 分鐘');
  await page.getByRole('button', { name: '關閉樂譜' }).click();

  await page.getByText('克萊采爾練習曲').first().click();
  await page.getByRole('button', { name: '速度與節拍器' }).click();
  await expect(page.getByTestId('score-practice-total')).toHaveText('尚未記錄');
});

test('預選的曲目可以清成未指定，清掉後不會又被塞回去', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await seed(page, 'viola-scores-idb', SCORES);

  await openApp(page);
  await openLibraryTab(page);
  await page.getByText('克萊采爾練習曲').first().click();
  await page.getByRole('button', { name: '關閉樂譜' }).click();
  await page.getByRole('button', { name: '練習工具' }).click();

  await practiceOneMinute(page);

  const select = page.getByLabel('練習曲目');
  await select.selectOption({ label: '未指定' });
  // 關鍵：清掉之後不能因為重新渲染又跳回預選值
  await expect(select).toHaveValue('');
  await page.getByRole('button', { name: '略過' }).click();

  await openLibraryTab(page);
  await page.getByText('克萊采爾練習曲').first().click();
  await page.getByRole('button', { name: '速度與節拍器' }).click();
  await expect(page.getByTestId('score-practice-total')).toHaveText('尚未記錄');
});

test('沒開過任何樂譜時，練習曲目預設為未指定', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await seed(page, 'viola-scores-idb', SCORES);

  await openApp(page);
  await practiceOneMinute(page);

  // 不能亂猜一首曲子塞進去
  await expect(page.getByLabel('練習曲目')).toHaveValue('');
});

test.describe('手機寬度下的練習筆記視窗', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('彈窗必須落在可視範圍內', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await seed(page, 'viola-scores-idb', SCORES);

    await openApp(page);
    await practiceOneMinute(page);

    const select = page.getByLabel('練習曲目');
    await expect(select).toBeVisible();

    // 迴歸測試：計時器卡片有 backdrop-blur，會成為 position:fixed 的包含區塊，
    // 彈窗因此對齊的是卡片而不是螢幕 —— 在手機寬度下整個跑到畫面外，
    // 使用者練完一段後什麼都看不到。修法是把彈窗 portal 到 body。
    const box = await page.locator('#practice-score').evaluate((el) => {
      const r = (el.closest('.max-w-sm') as HTMLElement).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(812);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(375);
  });
});
