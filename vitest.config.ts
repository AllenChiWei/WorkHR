import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * 單元測試只涵蓋 src/lib 的純函式（工時計算、批次打卡篩選、權限判斷、
 * 工作日曆、CSV 組裝），不需要 Vite 的 React／Tailwind plugin，
 * 因此與 vite.config.ts 分開，避免兩套 Vite 型別互相衝突。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
