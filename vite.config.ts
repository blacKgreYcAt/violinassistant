import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: '練琴練習小幫手',
          short_name: '練琴小幫手',
          description: '專為演奏者設計的練習工具',
          theme_color: '#ffffff',
        }
      })
    ],
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
