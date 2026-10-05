import { Page, expect } from '@playwright/test';

/**
 * 開啟 App 並跳過開場動畫。
 *
 * 開場畫面預設會停留 3.5 秒，但可以點擊跳過（這本身也是這次修正的項目之一）。
 * 每個測試都從這裡開始，省下大量等待時間。
 */
export async function openApp(page: Page) {
  await page.goto('/');

  // 開場畫面上的提示文字，確認它真的出現過
  const splashHint = page.getByText('點擊畫面任一處可直接進入');
  await splashHint.waitFor({ state: 'visible', timeout: 10_000 });

  // 點提示文字本身（事件會冒泡到開場畫面的 onClick）。
  // 不要用 page.locator('body').click({position})：開場畫面是 position:fixed，
  // body 因此高度為 0，相對於 body 計算的座標會落空。
  await splashHint.click();

  // 主畫面的分頁列出現就代表進來了
  await expect(page.getByRole('button', { name: '練習工具' })).toBeVisible();
}

/** 蒐集 console 錯誤與未攔截的例外，供測試結束時斷言 */
export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

/** 切換到「樂譜與紀錄」分頁 */
export async function openLibraryTab(page: Page) {
  await page.getByRole('button', { name: '樂譜與紀錄' }).click();
  await expect(page.getByTestId('practice-history')).toBeVisible();
}

/** 透過 UI 建立一個練習計畫（順便涵蓋建立流程本身） */
export async function createRoutine(
  page: Page,
  name: string,
  stepName: string,
  minutes: number
) {
  await page.getByRole('button', { name: '新增練習計畫' }).click();

  await page.getByPlaceholder('計畫名稱 (例如：每日暖身)').fill(name);
  await page.getByPlaceholder('步驟名稱 (例如：音階練習)').fill(stepName);
  await page.locator('input[type="number"]').first().fill(String(minutes));

  await page.getByRole('button', { name: '儲存計畫' }).click();
  await expect(page.getByTestId('routine-card').filter({ hasText: name })).toBeVisible();
}
