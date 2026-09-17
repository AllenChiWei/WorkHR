# 工地工班打卡系統（前端）

工班在外地工地作業，由領班代表整班打卡；管理員在桌機或手機檢視與維護資料。
這個階段**只有前端**，所有資料存取都走一層可抽換的介面，底下先用 mock 實作，
未來接後端時只需要補 `src/services/http/`。

## 快速開始

```bash
npm install
npm run dev        # 開發伺服器
npm run typecheck  # 型別檢查
npm run lint       # ESLint
npm test           # Vitest 單元測試 + 服務層端對端測試
npm run build      # 產生 dist/
```

## 測試帳號

| 帳號 | 密碼 | 角色 |
|---|---|---|
| `admin` | `admin123` | 管理員 |
| `foreman-a` | `1234` | A 班領班 |
| `worker-a1` | `1234` | A 班師傅（已開通自行打卡） |

帳號欄位也可以輸入該人員的**手機**或**員工編號**。
測試帳號提示與「重置資料」按鈕只在 `import.meta.env.DEV` 或 `VITE_DEMO_MODE=true` 時顯示。

## 架構

```
src/
  app/            路由、providers、route guards
  components/     共用 UI（Button、Sheet、Toast、Feedback…）
  features/       auth / crews / workers / attendance / reports
  services/
    contracts.ts  repository 介面（唯一的資料存取契約）
    mock/         localStorage 實作，含 200~400ms 模擬延遲
    http/         空實作，接後端時補這裡
    index.ts      依 VITE_DATA_SOURCE 注入
  schemas/        Zod schema（型別的唯一來源）
  lib/            純函式：日期、工時、打卡規則、權限、工作日曆、CSV
```

三個不可妥協的原則：

1. **元件不直接呼叫 `fetch`**，一律透過 `services.*`。
2. **權限檢查做兩層**：route guard（`src/app/guards.tsx`）擋頁面，
   service 層（`src/services/mock/guard.ts`）擋資料，不依賴隱藏按鈕。
3. **型別由 Zod 推導**（`z.infer`），不手寫重複的 interface。

## 環境變數

| 變數 | 值 | 說明 |
|---|---|---|
| `VITE_DATA_SOURCE` | `mock`（預設）/ `api` | 選擇資料來源實作 |
| `VITE_API_BASE_URL` | URL | 接後端後由 http adapter 使用 |
| `VITE_DEMO_MODE` | `true` | production build 也顯示測試帳號與重置按鈕 |
| `VITE_BASE` | `/repo-name/` | 部署到子路徑時的 base path |

## 角色與權限

| 功能 | 管理員 | 領班 | 師傅（需開通） |
|---|---|---|---|
| 工班／人員維護、指派 | ✅ | ❌ | ❌ |
| 檢視全部打卡資料、報表、出勤月曆、匯出 | ✅ | ❌ | ❌ |
| 檢視本班清單、代本班打卡（限當日） | ✅ | ✅ | ❌ |
| 為自己打卡 | — | ✅ | ✅ |
| 修改打卡紀錄 | ✅ 任何日期 | ✅ 僅當日、僅本班 | ❌ |
| 重設密碼 | ✅ | ❌ | ❌ |

## 已知限制

- `src/services/mock/auth.ts` 是**前端 mock**：密碼明文存在 localStorage，session 沒有簽章。
  接後端時必須把密碼雜湊與 session 簽發移到伺服器（檔案開頭有完整說明）。
- `src/lib/calendar.ts` 的國定假日表是**依慣例填的基準值**，
  上線前請依行政院人事行政總處當年度公告校正（尤其是彈性放假與補班日）。
- 班別只有早班，不支援跨夜班；下班時間一律視為與上班同一天。
- 工班沒有固定休假日，因此報表不計算「應出勤天數」與「出勤率」，
  國定假日僅在出勤月曆與明細上標注。
