/**
 * 開發工具（測試帳號提示、重置 mock 資料）的顯示條件。
 *
 * 規格要求只在 DEV 模式顯示，但部署到 GitHub Pages 的展示站是 production build，
 * 沒有這些提示就無法試用。因此另外提供 VITE_DEMO_MODE 旗標：
 * 只有展示站會開啟，正式環境（接上後端後）兩者皆為 false，提示自然消失。
 */
export const IS_DEV = import.meta.env.DEV;
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
export const SHOW_DEV_TOOLS = IS_DEV || IS_DEMO;
