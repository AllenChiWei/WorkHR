/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'mock' | 'api';
  readonly VITE_API_BASE_URL?: string;
  /** 展示站專用：production build 也顯示測試帳號與重置資料按鈕。 */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
