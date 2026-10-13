import { Page, expect, test } from '@playwright/test';

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

/**
 * 這個瀏覽器有沒有 Web Audio / MediaRecorder。
 *
 * Playwright 的 WebKit 建置（至少 Windows 上）兩者都沒有，真正的 Safari 有。
 * 依賴它們的測試在這種環境會整片紅，淹掉真正的失敗 —— 所以改成按能力跳過，
 * 而不是按瀏覽器名稱跳過（瀏覽器名稱不代表能力）。
 */
export async function hasWebAudio(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      typeof window.AudioContext !== 'undefined' ||
      typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !==
        'undefined'
  );
}

export async function hasMediaRecorder(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof window.MediaRecorder !== 'undefined');
}

/** 需要 Web Audio 的測試用這個開頭；缺少時跳過並說明原因 */
export async function skipWithoutWebAudio(page: Page) {
  const ok = await hasWebAudio(page);
  test.skip(!ok, '這個瀏覽器沒有 Web Audio，節拍器與調音器測不了');
}

/** 需要 MediaRecorder 的測試用這個開頭 */
export async function skipWithoutMediaRecorder(page: Page) {
  const ok = await hasMediaRecorder(page);
  test.skip(!ok, '這個瀏覽器沒有 MediaRecorder，錄影相關測不了');
}
