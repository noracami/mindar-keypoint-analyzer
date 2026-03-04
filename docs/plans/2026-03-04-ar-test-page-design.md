# AR 測試頁設計文件

## 目標

編譯完 `.mind` 檔後，產生一個可用手機掃 QR code 開啟的 AR 測試頁，驗證 MindAR 能否正確辨識目標圖片。

## 架構

```
分析工具 (Pages 靜態站)
  │
  │ 編譯完成 → 點「產生測試連結」
  │
  ▼
Pages Functions (Worker)
  POST /api/mind          → 存 .mind 到 R2，回傳 { id }
  GET  /api/mind/:id      → 從 R2 讀 .mind，回傳 binary
  │
  ▼
測試頁 /test.html?id=xxx
  fetch /api/mind/xxx → 載入 MindAR → 開相機 → 辨識到顯示色塊
  │
  ▼
QR code (前端生成)
  內容：https://mindar-keypoint-analyzer.pages.dev/test.html?id=xxx
```

## 測試頁 AR 體驗

- Vite multi-page app：`test.html` + `src/test.js` 為第二個 entry point
- 使用 MindAR A-Frame 整合，從 npm 引入
- 頁面載入時 fetch `/api/mind/:id` → 轉成 blob URL → 餵給 `imageTargetSrc`
- 辨識成功時，半透明綠色平面覆蓋在目標圖上方
- 單一 target（`targetIndex: 0`）

## Worker API（Pages Functions）

- `functions/api/mind.js` — POST：接收 .mind binary，生成隨機 id，存 R2，回傳 `{ id }`
- `functions/api/mind/[id].js` — GET：從 R2 讀取，回傳 binary（Content-Type: application/octet-stream）
- Pages Functions 與現有 Pages 專案同 repo，部署在 `functions/` 目錄
- R2 bucket 透過 `wrangler.toml` 綁定

## QR code

- 用 `qrcode` npm 套件在前端生成
- 編譯完成後，分析工具多一個「產生測試連結」按鈕
- 點擊 → 上傳 .mind → 拿到 id → 生成 QR code 顯示在頁面上
- 同時顯示可點擊的完整 URL

## R2 生命週期

- 先不做自動清理，檔案上傳後長期保留
- 免費額度 10 GB，手動清理即可

## 檔案清單

| 檔案 | 動作 | 說明 |
|------|------|------|
| `test.html` | 新增 | AR 測試頁 HTML |
| `src/test.js` | 新增 | 測試頁邏輯：fetch .mind → 啟動 MindAR AR |
| `functions/api/mind.js` | 新增 | POST 上傳 .mind 到 R2 |
| `functions/api/mind/[id].js` | 新增 | GET 從 R2 取 .mind |
| `vite.config.js` | 新增 | multi-page 設定 |
| `src/main.js` | 修改 | 加「產生測試連結」按鈕，上傳 + 顯示 QR code |
| `index.html` | 修改 | 加 QR code 容器 UI |
| `package.json` | 修改 | 加 qrcode 依賴 |
| `wrangler.toml` | 新增 | R2 bucket 綁定設定 |

## 技術棧

- Vite multi-page app
- MindAR A-Frame（npm）
- Cloudflare Pages Functions + R2
- qrcode（npm，前端 QR code 生成）
