import { test, expect, devices } from '@playwright/test';
import { openApp, openLibraryTab, createRoutine } from './helpers';

/**
 * 觸控裝置專用的測試。
 *
 * 必須寫成獨立檔案並把 test.use 放在最上層：Playwright 不允許在 describe
 * 區塊內使用會改變瀏覽器類型的設定。這裡也刻意只指定需要的選項，
 * 不整包展開 devices['Pixel 5']（那會帶入 defaultBrowserType）。
 */
test.use({
  viewport: devices['Pixel 5'].viewport,
  userAgent: devices['Pixel 5'].userAgent,
  deviceScaleFactor: devices['Pixel 5'].deviceScaleFactor,
  hasTouch: true,
  isMobile: true,
});

test('前置條件：模擬環境必須回報為不支援 hover', async ({ page }) => {
  await openApp(page);
  const media = await page.evaluate(() => ({
    hover: matchMedia('(hover: hover)').matches,
    coarse: matchMedia('(pointer: coarse)').matches,
  }));
  // 這個前提若不成立，下面那個測試就形同虛設 —— 會在桌面模式下通過而驗不到東西
  expect(media.hover, '模擬環境仍回報支援 hover，下面的測試不具意義').toBe(false);
  expect(media.coarse).toBe(true);
});

test('練習計畫的操作按鈕在觸控裝置上必須看得見也按得到', async ({ page }) => {
  await openApp(page);
  await openLibraryTab(page);
  await createRoutine(page, '觸控測試計畫', '長音', 5);

  // 迴歸測試：這組按鈕原本是 opacity-0 + group-hover:opacity-100，
  // 而 Tailwind 會把 group-hover 包進 @media (hover:hover)，
  // 觸控裝置永遠套不到那條規則 —— 按鈕看不見也點不到，
  // 但使用說明寫的是「點擊播放按鈕即可開始執行計畫」。
  const startButton = page.getByRole('button', { name: '開始練習' });
  await expect(startButton).toBeVisible();

  const opacity = await startButton.evaluate((el) => {
    const wrapper = el.closest('.hover-reveal') ?? el;
    return getComputedStyle(wrapper).opacity;
  });
  expect(Number(opacity), '按鈕容器是透明的，觸控裝置上等於看不見').toBeGreaterThan(0.9);

  // 不只是「看得見」，還要真的能按
  await startButton.click();
  await expect(page.getByText('計畫執行中')).toBeVisible();
});
