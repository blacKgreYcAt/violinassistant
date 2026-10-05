import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * 只跑 src 底下的單元測試。
     *
     * vitest 預設的比對規則是 **\/*.{test,spec}.*，會把 e2e/ 裡的 Playwright
     * 測試也一起抓進來執行而失敗（Playwright 的 test.use 等 API 在 vitest 下不存在）。
     * E2E 由 npm run test:e2e 用 Playwright 自己的 runner 執行。
     */
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
