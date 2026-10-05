import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
        manifest: {
          name: '練琴練習小幫手',
          short_name: '練琴小幫手',
          description: '專為演奏者設計的練習工具',
          // 這個 App 的介面全是繁體中文；lang 不設定的話 vite-plugin-pwa 會填入 "en"，
          // 不會從 index.html 的 lang 屬性繼承。
          lang: 'zh-Hant-TW',
          display: 'standalone',
          // 深色主題。原本兩個值都是 #ffffff，啟動時會先閃一下白底、
          // 狀態列也會變成白色，跟 App 本身的深色介面不搭。
          theme_color: '#080808',
          background_color: '#080808',
          // 沒有 icons 的 manifest 會被瀏覽器判定為不可安裝，
          // 「加入主畫面」整個功能都用不了。192 與 512 是 Chrome/Edge 的必要條件。
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              // Android 的自適應圖示會自行裁切形狀，需要一張四周留白的版本
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
