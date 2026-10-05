import { test, expect } from '@playwright/test';

/**
 * PWA 可安裝性。
 *
 * 先前 manifest 完全沒有 icons 欄位、專案裡也沒有任何圖片檔，
 * 瀏覽器因此判定此 App 不可安裝，「加入主畫面」整個功能都用不了 ——
 * 但這個 App 開場就要求「請將平板直式放置」，顯然是要當平板 App 用的。
 *
 * 這類問題只有在真的用瀏覽器載入正式建置產物時才驗得出來，
 * 所以 playwright.config.ts 刻意跑 build + preview 而不是開發伺服器。
 */

test.describe('PWA', () => {
  test('manifest 存在且內容正確', async ({ page }) => {
    await page.goto('/');

    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href, '沒有 manifest 連結').toBeTruthy();

    const res = await page.request.get(new URL(href!, page.url()).href);
    expect(res.status()).toBe(200);

    const manifest = await res.json();
    expect(manifest.name).toBe('練琴練習小幫手');
    expect(manifest.display).toBe('standalone');
    // 介面全是繁體中文；vite-plugin-pwa 不會從 index.html 的 lang 繼承，
    // 不明確指定的話會變成 "en"
    expect(manifest.lang).toBe('zh-Hant-TW');
    // App 是深色主題，白色會造成啟動白閃與白色狀態列
    expect(manifest.theme_color).toBe('#080808');
    expect(manifest.background_color).toBe('#080808');
  });

  test('具備可安裝所需的圖示尺寸，且檔案都取得到', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestUrl = new URL(href!, page.url()).href;
    const manifest = await (await page.request.get(manifestUrl)).json();

    const icons: Array<{ src: string; sizes: string; purpose?: string }> = manifest.icons ?? [];

    // Chrome/Edge 的可安裝條件：至少要有 192 與 512
    expect(icons.some((i) => i.sizes === '192x192'), '缺少 192x192 圖示').toBe(true);
    expect(icons.some((i) => i.sizes === '512x512'), '缺少 512x512 圖示').toBe(true);
    // Android 自適應圖示會自行裁切形狀，需要一張留安全邊距的版本
    expect(
      icons.some((i) => (i.purpose ?? '').includes('maskable')),
      '缺少 maskable 圖示'
    ).toBe(true);

    for (const icon of icons) {
      const url = new URL(icon.src, manifestUrl).href;
      const res = await page.request.get(url);
      expect(res.status(), `圖示取不到：${icon.src}`).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
    }
  });

  test('iOS 與瀏覽器分頁的圖示都已設定', async ({ page }) => {
    await page.goto('/');

    // iOS 不讀 manifest 裡的 icons，「加入主畫面」要靠 apple-touch-icon
    const apple = page.locator('link[rel="apple-touch-icon"]');
    await expect(apple).toHaveCount(1);
    const appleRes = await page.request.get(
      new URL((await apple.getAttribute('href'))!, page.url()).href
    );
    expect(appleRes.status()).toBe(200);

    // 分頁圖示（先前是一片空白）
    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveCount(1);
    const faviconRes = await page.request.get(
      new URL((await favicon.getAttribute('href'))!, page.url()).href
    );
    expect(faviconRes.status()).toBe(200);

    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#080808');
  });

  test('service worker 會註冊成功（離線能力的前提）', async ({ page }) => {
    await page.goto('/');
    const registered = await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistrations()).length > 0,
      undefined,
      { timeout: 15_000 }
    );
    expect(await registered.jsonValue()).toBeTruthy();
  });
});
