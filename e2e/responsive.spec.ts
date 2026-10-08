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

test.describe('窄螢幕下的樂譜檢視器面板', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  test('每個浮動面板都必須完整落在畫面內', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      (png) =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open('keyval-store');
          open.onupgradeneeded = () => open.result.createObjectStore('keyval');
          open.onsuccess = () => {
            const tx = open.result.transaction('keyval', 'readwrite');
            tx.objectStore('keyval').put(
              [{ id: 'panel-score', name: '面板測試曲', type: 'file', data: png, date: Date.now() }],
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
    await page.getByText('面板測試曲').first().click();

    // 迴歸測試：這些面板原本各自寫死 right-24 加固定寬度，
    // 在 375px 寬的手機上整片被推到畫面外（w-96 的錄影面板左緣是 -105px），
    // 使用者完全看不到也點不到。
    const panels = ['段落循環練習', '速度與節拍器', '本曲錄影紀錄', '曲目熟練度', '節拍速度'];

    for (const name of panels) {
      const toggle = page.getByRole('button', { name, exact: true });
      await toggle.click();

      // 面板沒有共用的 testid，改用算出來的 z-index 找它（PANEL_BASE 固定是 z-[100]）
      const box = await page.evaluate(() => {
        const panel = [...document.querySelectorAll('div.fixed')].find(
          (d) => getComputedStyle(d).zIndex === '100'
        );
        if (!panel) return null;
        const r = panel.getBoundingClientRect();
        return { left: r.left, right: r.right, bottom: r.bottom };
      });

      expect(box, `${name} 面板沒有出現`).not.toBeNull();
      expect(box!.left, `${name} 面板左緣被切掉`).toBeGreaterThanOrEqual(0);
      expect(box!.right, `${name} 面板右緣超出畫面`).toBeLessThanOrEqual(375);
      expect(box!.bottom, `${name} 面板下緣超出畫面`).toBeLessThanOrEqual(812);

      await toggle.click();
    }
  });
});
