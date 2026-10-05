import { test, expect } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 這個檔案針對的是「單元測試完全抓不到」的那一類問題：
 * 版面在特定尺寸下被切掉、以及控制項在觸控裝置上根本看不見。
 * 這次稽核中最嚴重的幾個發現就屬於這一類。
 */

test.describe('平板尺寸下的版面', () => {
  // App 的開場畫面明確要求「請將平板直式放置」，所以這兩個尺寸都要顧
  const viewports = [
    { name: 'iPad 橫向', width: 1024, height: 768 },
    { name: 'iPad 直向', width: 768, height: 1024 },
  ];

  for (const vp of viewports) {
    test(`${vp.name} (${vp.width}×${vp.height}) 下「練習紀錄」必須看得到`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openApp(page);
      await openLibraryTab(page);

      // 迴歸測試：這一頁的內容高度約 924px，先前外層容器在 md 以上是
      // overflow-hidden，1024×768 時有近 380px 完全看不到、而且捲不動。
      const todayLabel = page.getByText('今日練習');
      await todayLabel.scrollIntoViewIfNeeded();
      await expect(todayLabel).toBeInViewport();

      const chartArea = page.getByTestId('practice-history');
      await expect(chartArea).toBeVisible();
    });
  }

  test('內容超出高度時，分頁容器必須是可捲動的', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openApp(page);
    await openLibraryTab(page);

    const scrollState = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(
        (d) =>
          typeof d.className === 'string' &&
          d.className.includes('custom-scrollbar') &&
          d.className.includes('flex-col') &&
          d.className.includes('h-full')
      );
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        overflowY: cs.overflowY,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      };
    });

    expect(scrollState, '找不到分頁內容容器').not.toBeNull();
    if (scrollState!.scrollHeight > scrollState!.clientHeight) {
      // 內容確實超出時，絕不能是 hidden —— 那會讓使用者永遠看不到下半部
      expect(['auto', 'scroll']).toContain(scrollState!.overflowY);
    }
  });
});
