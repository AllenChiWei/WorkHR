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
  lib/            純函式：日期、工時、打卡規則、權限、工作日曆、
                  勞基法計算（labor）、法遵檢核（compliance）、薪資（payroll）、CSV
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
| 薪資試算、借支、額外派遣加給 | ✅ | ❌ | ❌ |
| 檢視本班清單、代本班打卡（限當日） | ✅ | ✅ | ❌ |
| 為自己打卡 | — | ✅ | ✅ |
| 修改打卡紀錄 | ✅ 任何日期 | ✅ 僅當日、僅本班 | ❌ |
| 重設密碼 | ✅ | ❌ | ❌ |

## 勞基法相關功能

依現行法規實作（2026-09 查證自全國法規資料庫）：

| 條文 | 實作位置 | 內容 |
|---|---|---|
| §38 | `lib/labor.ts` | 特休年資級距（6個月3天 → 10年起每年+1天、30天封頂），採**週年制**以到職日起算 |
| §30 | `lib/compliance.ts` | 出勤紀錄缺下班時間會警示；保存年限常數為 5 年 |
| §32 | `lib/compliance.ts` | 單日工時超過 12 小時、當月延長工時超過 46 小時會標為「可能違法」 |
| §36 | `lib/compliance.ts` | 連續出勤超過 6 日會警示 |
| 基本工資 | `lib/labor.ts` | 2026 年月薪 29,500／時薪 196（勞動部 2025-09-26 公告） |

**薪資試算公式**（`lib/payroll.ts`）：

```
實領 = 日薪 × 出勤天數
     + 日薪 × 特休天數          （特休照給全薪）
     + 日薪 × 病假天數 × 0.5    （普通傷病假半薪）
     + 額外派遣加給
     − 當月借支還款
```

事假與未到不計薪。**不含加班費、勞健保與稅務扣繳。**

借支為無息，由「起扣月份 × 每月還款額」推算各月扣款與餘額，
另提供「提前結清」與「對帳調整」供實際帳務校正。

## 已知限制

- `src/services/mock/auth.ts` 是**前端 mock**：密碼明文存在 localStorage，session 沒有簽章。
  接後端時必須把密碼雜湊與 session 簽發移到伺服器（檔案開頭有完整說明）。
- `src/lib/calendar.ts` 的國定假日表是**依慣例填的基準值**，
  上線前請依行政院人事行政總處當年度公告校正（尤其是彈性放假與補班日）。
- 班別只有早班，不支援跨夜班；下班時間一律視為與上班同一天。
- 工班沒有固定休假日，因此報表不計算「應出勤天數」與「出勤率」，
  國定假日僅在出勤月曆與明細上標注。
- **法遵檢核僅供提醒，不構成法律意見**，實際認定以主管機關為準。
  基本工資、加班上限等常數集中在 `src/lib/labor.ts`，法規異動時只需改該檔。
- 日薪制對照基本工資的門檻採「時薪 × 8 小時」換算（1,568 元/日）。
  實務上亦有以「月薪 ÷ 30」計算者，若貴公司採不同見解請調整 `DAILY_WAGE_FLOOR`。
- 薪資試算不含加班費：工班只有早班且採日薪制，加班費需先確認工時制度才能正確計算，
  目前改以法遵警示提醒管理員。
