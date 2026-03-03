# MindAR 特徵點分散度分析工具

## 背景

我們使用 [MindAR](https://github.com/hiukim/mind-ar-js) 做圖像辨識，需要將多張海報圖片編譯成一個 `.mind` 檔。每張海報對應一個 target index，當相機對準某張海報時，應該只觸發該海報的 index，不能誤觸其他海報。

MindAR Image Target Compiler 編譯完成後，會產出預覽圖：**灰階底圖上標示紅色圓點**，每個紅點代表一個被擷取的特徵點（keypoint）。如果多張海報的特徵點位置高度重疊（例如都集中在共用的邊框、Logo、QR code 等元素上），就容易造成誤辨識。

### 原本的流程痛點

過去的測試流程需要跑多個地方：

1. 先到 MindAR 官方線上工具 https://hiukim.github.io/mind-ar-js-doc/tools/compile/ 上傳圖片、等待編譯
2. 編譯完成後手動截圖預覽圖
3. 再將截圖餵給另一個 Node.js 腳本（`detect-keypoints.mjs`）做特徵點分析
4. 最後從終端機輸出閱讀分析結果

這個流程繁瑣、容易出錯，而且截圖過程會損失精確度。

### 解決方案

經研究，MindAR 的 Compiler 本身就是 JavaScript 實作，提供瀏覽器端 API，可以直接在網頁中呼叫，不需要依賴官方線上工具。

因此我們將**編譯**與**特徵點分析**整合為一個瀏覽器端的一站式工具，讓整個測試流程在同一個網頁完成。

## 功能需求

### 整體流程

使用者在單一網頁中完成所有操作：

1. **上傳海報圖片** → 2. **自動編譯 `.mind` 檔** → 3. **分析特徵點分散度** → 4. **顯示報告**

### Step 1：上傳圖片

- 支援上傳多張海報原圖（PNG / JPG）
- 數量不限（原測試為 6 張，但工具不應寫死）
- 顯示圖片預覽與檔名

### Step 2：編譯 `.mind` 檔

- 使用 MindAR 瀏覽器端 `Compiler` 類別進行編譯
- 顯示編譯進度（MindAR Compiler 提供 progressCallback）
- 編譯完成後：
  - 提供 `.mind` 檔下載
  - 從 Compiler 內部資料取得每張圖的特徵點資訊（灰階影像、matching data 等），不需要再透過截圖+紅點偵測的間接方式

### Step 3：分析特徵點分散度

- **正規化座標**：將特徵點像素座標轉換為 0~1 的比例座標，以便跨圖比較
- **提取 FREAK Descriptor**：每個特徵點帶有 666-bit FREAK descriptor（21 個 32-bit 整數），描述該點周圍的局部紋理
- **計算重疊度**：兩兩比較所有圖片的特徵點，雙重條件判定重疊：
  - 正規化座標歐氏距離 < 1% **且** descriptor Hamming distance < 40%（266/666 bits）
  - 產出 N×N 重疊矩陣
- **計算獨有率**：每張圖有多少特徵點是「獨有的」（不與任何其他圖片重疊）

### Step 4：顯示報告

1. **摘要表格**：每張圖的特徵點總數、獨有數、共用數、獨有率（%）
2. **N×N 重疊矩陣**：兩兩之間的共用特徵點數量
3. **結論判定**（以顏色標示）：
   - 獨有率 > 50%：辨識度良好（綠色）
   - 獨有率 30%~50%：辨識度中等，可能有誤觸風險（黃色）
   - 獨有率 < 30%：辨識度差，建議調整圖片（紅色）
4. **JSON 原始資料**：每張圖的完整特徵點座標，供後續分析使用（可複製或下載）
5. **特徵點視覺化**：
   - 個別圖片的特徵點分佈（綠色＝獨有、紅色＝共用）
   - 配對重疊比較（紅點＝重疊特徵點、藍框＝密集重疊區域）

## 技術方案

### 瀏覽器端 MindAR Compiler API

```js
import { Compiler } from 'mind-ar/src/image-target/compiler.js';

const compiler = new Compiler();
await compiler.compileImageTargets(images, (progress) => {
  // progress: 0 ~ 100
});
const buffer = compiler.exportData(); // .mind 檔的 ArrayBuffer
```

- `Compiler` 繼承自 `CompilerBase`，使用 `document.createElement('canvas')` 處理影像
- Tracking 階段使用 Web Worker，不會阻塞 UI
- `compileImageTargets()` 接受 HTML Image 元素陣列
- 編譯過程中 `compiler.data` 會包含每張圖的 `matchingData`（含特徵點座標與 FREAK descriptor），可直接取用作分析

## 開發與部署

### 技術棧

- **Node.js** — 開發環境執行
- **npm** — 套件管理
- **Vite** — 開發伺服器與建置工具（MindAR 的 Web Worker 匯入使用 Vite 專用語法）
- **Vanilla JS** — 不使用前端框架，保持簡單

### npm 依賴

- `mind-ar` — MindAR Compiler 核心（會自動帶入 `@tensorflow/tfjs`、`@msgpack/msgpack` 等間接依賴）

### 開發

```bash
npm install
npm run dev     # 啟動 Vite dev server
```

### 建置與部署

```bash
npm run build   # 產出靜態檔案至 dist/
npx wrangler pages deploy dist/ --project-name=mindar-keypoint-analyzer
```

建置產物為純靜態檔案（HTML + JS + CSS），部署至 Cloudflare Pages，不需要 Node.js runtime。

線上版：https://mindar-keypoint-analyzer.pages.dev/

<!-- TODO: 改用 GitHub Actions 自動部署到 Cloudflare Pages -->

## 附註

- 座標距離門檻（1%）與 descriptor 相似度門檻（40%）皆為常數，可依需求調整
- FREAK descriptor 具旋轉不變性，因此旋轉相同圖案無法降低重疊
- 若海報共用大量結構性元素（QR code finder pattern、邊框等），這些區域的 descriptor 本身就相似，會被正確判定為重疊
- MindAR Compiler 依賴 `@tensorflow/tfjs`，首次載入可能較慢
