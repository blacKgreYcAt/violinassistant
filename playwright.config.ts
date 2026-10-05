import { defineConfig, devices } from '@playwright/test';

/**
 * E2E 測試設定。
 *
 * 為什麼需要 E2E：既有的 61 個單元測試只能驗證純函式（音高演算法、集點卡規則、
 * 計時計算）。這次稽核中最嚴重的幾個問題 —— 平板上內容被切掉且無法捲動、
 * PWA 無法安裝、觸控裝置看不到操作按鈕、按鈕按了沒反應 —— 單元測試一個都抓不到，
 * 因為它們只有在「真的用瀏覽器開起來、在特定尺寸與輸入方式下操作」時才會顯現。
 *
 * 刻意跑「正式建置產物」而不是開發伺服器：PWA 的 manifest 與 service worker
 * 只有在 build 時才會產生，用 dev server 測等於沒測到真正會上線的東西。
 */
export default defineConfig({
  testDir: './e2e',

  // 這些測試會操作共用的 IndexedDB 與計時器，平行跑容易互相干擾
  fullyParallel: false,
  workers: 1,

  // 失敗時重試一次：E2E 偶爾會因為時間差而不穩，但連續兩次失敗就是真的壞了
  retries: 1,

  reporter: process.env.CI ? 'list' : [['list']],

  use: {
    baseURL: 'http://localhost:4173',
    // 失敗時保留截圖與追蹤檔，方便事後查看當下畫面
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // 先 build 再 preview，測到的才是真正會部署的產物
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
