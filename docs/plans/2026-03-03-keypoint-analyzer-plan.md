# MindAR 特徵點分散度分析工具 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立一個瀏覽器端的一站式工具，整合 MindAR Compiler 編譯與特徵點分散度分析。

**Architecture:** Vite + Vanilla JS 單頁應用。使用者上傳多張圖片後，呼叫 MindAR 瀏覽器端 Compiler API 編譯為 .mind 檔，再從 `compiler.data[i].matchingData` 取得特徵點座標進行分散度分析。

**Tech Stack:** Vite, Vanilla JS, mind-ar (npm), 純手寫 CSS

---

### Task 1: 專案初始化

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/style.css`
- Create: `.gitignore`

**Step 1: 初始化 npm 專案**

```bash
cd /Users/kerke/side/poc/mindar-keypoint-analyzer
npm init -y
```

**Step 2: 安裝依賴**

```bash
npm install mind-ar
npm install -D vite
```

**Step 3: 建立 .gitignore**

```
node_modules/
dist/
```

**Step 4: 建立 vite.config.js**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
});
```

**Step 5: 建立基礎 index.html**

建立空殼 HTML，引入 `src/main.js` 和 `src/style.css`，包含所有 UI 區塊的容器但內容先留空。

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MindAR 特徵點分散度分析</title>
  <link rel="stylesheet" href="/src/style.css">
</head>
<body>
  <main>
    <h1>MindAR 特徵點分散度分析</h1>

    <!-- Step 1: 上傳 -->
    <section id="upload-section">
      <h2>1. 上傳海報圖片</h2>
      <div id="drop-zone">
        <p>拖放圖片到這裡，或</p>
        <input type="file" id="file-input" multiple accept="image/png,image/jpeg">
      </div>
      <div id="preview-list"></div>
    </section>

    <!-- Step 2: 編譯 -->
    <section id="compile-section" hidden>
      <h2>2. 編譯 .mind 檔</h2>
      <button id="compile-btn">開始編譯</button>
      <div id="progress-bar-container" hidden>
        <div id="progress-bar"></div>
        <span id="progress-text">0%</span>
      </div>
      <div id="download-link" hidden></div>
    </section>

    <!-- Step 3 & 4: 分析報告 -->
    <section id="report-section" hidden>
      <h2>3. 分析報告</h2>
      <div id="summary-table"></div>
      <div id="overlap-matrix"></div>
      <details id="json-section">
        <summary>JSON 原始資料</summary>
        <div id="json-actions">
          <button id="copy-json-btn">複製</button>
          <button id="download-json-btn">下載 JSON</button>
        </div>
        <pre id="json-output"></pre>
      </details>
    </section>
  </main>

  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

**Step 6: 建立空的 src/main.js 和 src/style.css**

`src/main.js`: 先只放 `console.log('ready');`
`src/style.css`: 先放基本 reset 與字體設定。

**Step 7: 在 package.json 加入 scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

**Step 8: 驗證 dev server 能啟動**

```bash
npm run dev
```

Expected: Vite dev server 啟動，瀏覽器可看到標題頁面。

**Step 9: Commit**

```bash
git add .gitignore package.json package-lock.json vite.config.js index.html src/
git commit -m "chore: init Vite project with basic HTML structure"
```

---

### Task 2: 圖片上傳功能

**Files:**
- Modify: `src/main.js`
- Modify: `src/style.css`

**Step 1: 實作檔案選擇與拖放上傳**

在 `src/main.js` 中實作：
- 監聽 `#file-input` 的 `change` 事件
- 監聽 `#drop-zone` 的 `dragover`、`dragleave`、`drop` 事件
- 收到檔案後，過濾只保留 image/png 和 image/jpeg
- 用 `URL.createObjectURL()` 建立預覽縮圖
- 在 `#preview-list` 中顯示每張圖的縮圖（寬 120px）與檔名
- 每張圖旁邊有刪除按鈕可移除
- 上傳後顯示 `#compile-section`
- 將上傳的 File 物件存在模組層級的陣列中

**Step 2: 加入上傳區的 CSS 樣式**

```css
#drop-zone {
  border: 2px dashed #ccc;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
}
#drop-zone.dragover {
  border-color: #666;
  background: #f9f9f9;
}
```

**Step 3: 手動測試**

在瀏覽器中測試：拖放圖片、點選按鈕上傳、移除圖片、確認預覽正常。

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: add image upload with drag-and-drop and preview"
```

---

### Task 3: MindAR Compiler 整合 — 編譯功能

**Files:**
- Modify: `src/main.js`

**Step 1: 實作編譯流程**

在 `src/main.js` 中：

```js
import { Compiler } from 'mind-ar/src/image-target/compiler';

async function loadImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(file);
  });
}

async function compile(files) {
  const compiler = new Compiler();
  const images = await Promise.all(files.map(loadImage));

  await compiler.compileImageTargets(images, (progress) => {
    // 更新進度條
    updateProgress(progress);
  });

  return compiler;
}
```

**Step 2: 接上 UI**

- 點擊「開始編譯」按鈕：
  - 禁用按鈕，顯示進度條
  - 呼叫 `compile(uploadedFiles)`
  - 進度回呼更新 `#progress-bar` 寬度和 `#progress-text`
  - 完成後呼叫 `compiler.exportData()` 取得 ArrayBuffer
  - 用 `URL.createObjectURL(new Blob([buffer]))` 產生下載連結
  - 顯示 `#download-link` 內的 `<a>` 元素
  - 編譯完成後自動觸發分析（Task 4）

**Step 3: 手動測試**

上傳 2-3 張小圖片，點擊編譯，確認進度條正常、.mind 檔可下載。

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: integrate MindAR Compiler with progress bar and .mind download"
```

---

### Task 4: 特徵點擷取與分析邏輯

**Files:**
- Create: `src/analyze.js`

**Step 1: 實作特徵點擷取**

從 `compiler.data` 中擷取特徵點座標：

```js
function extractKeypoints(compiler) {
  return compiler.data.map((targetData, index) => {
    const { width, height } = targetData.targetImage;

    // 取第一層（最高解析度）的 matchingData
    const md = targetData.matchingData[0];
    const rawPoints = [...md.maximaPoints, ...md.minimaPoints];

    // 正規化座標為 0~1
    const keypoints = rawPoints.map(p => ({
      x: p.x / width,
      y: p.y / height,
    }));

    return { index, width, height, keypoints };
  });
}
```

**Step 2: 實作重疊分析**

複用 `detect-keypoints.mjs` 的邏輯：

```js
function computeOverlapMatrix(targets, threshold = 0.03) {
  const n = targets.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = targets[i].keypoints.length;
    for (let j = i + 1; j < n; j++) {
      const count = overlapCount(targets[i].keypoints, targets[j].keypoints, threshold);
      matrix[i][j] = count;
      matrix[j][i] = count;
    }
  }
  return matrix;
}

function overlapCount(kpA, kpB, threshold) {
  let count = 0;
  for (const a of kpA) {
    for (const b of kpB) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        count++;
        break;
      }
    }
  }
  return count;
}
```

**Step 3: 實作獨有率計算**

```js
function computeUniqueness(targets, threshold = 0.03) {
  return targets.map((target, i) => {
    let shared = 0;
    for (const kp of target.keypoints) {
      let isShared = false;
      for (let j = 0; j < targets.length; j++) {
        if (i === j) continue;
        for (const other of targets[j].keypoints) {
          const dx = kp.x - other.x;
          const dy = kp.y - other.y;
          if (Math.sqrt(dx * dx + dy * dy) < threshold) {
            isShared = true;
            break;
          }
        }
        if (isShared) break;
      }
      if (isShared) shared++;
    }
    const total = target.keypoints.length;
    const unique = total - shared;
    return { index: i, total, unique, shared, uniqueRate: total > 0 ? unique / total : 0 };
  });
}
```

**Step 4: 匯出模組的 `analyze` 函式**

```js
export function analyze(compiler) {
  const targets = extractKeypoints(compiler);
  const matrix = computeOverlapMatrix(targets);
  const uniqueness = computeUniqueness(targets);
  return { targets, matrix, uniqueness };
}
```

**Step 5: Commit**

```bash
git add src/analyze.js
git commit -m "feat: add keypoint extraction and overlap analysis logic"
```

---

### Task 5: 報告 UI 渲染

**Files:**
- Modify: `src/main.js`
- Modify: `src/style.css`

**Step 1: 實作摘要表格渲染**

在 `src/main.js` 中加入 `renderReport(result, fileNames)` 函式：

- 建立 `<table>` 顯示每張圖的：檔名、特徵點總數、獨有數、共用數、獨有率 (%)
- 獨有率欄位根據判定標準上色：
  - `> 50%` → 綠色背景 `#d4edda`
  - `30%~50%` → 黃色背景 `#fff3cd`
  - `< 30%` → 紅色背景 `#f8d7da`

**Step 2: 實作 N×N 重疊矩陣渲染**

- 建立 `<table>` 顯示 N×N 矩陣
- 第一行和第一列為圖片名稱
- 對角線為該圖的特徵點總數
- 其他格為兩兩之間的共用數

**Step 3: 實作 JSON 原始資料區**

- 將分析結果格式化為 JSON 字串，放入 `<pre id="json-output">`
- 「複製」按鈕用 `navigator.clipboard.writeText()`
- 「下載 JSON」按鈕用 `URL.createObjectURL(new Blob([json], {type:'application/json'}))` 建立下載連結

**Step 4: 加入報告區的 CSS 樣式**

表格基本樣式：邊框、padding、條紋行、置中對齊。

**Step 5: 串接分析結果到 UI**

在編譯完成後：
```js
import { analyze } from './analyze.js';

// 編譯完成後
const result = analyze(compiler);
renderReport(result, fileNames);
document.getElementById('report-section').hidden = false;
```

**Step 6: 手動測試**

上傳圖片 → 編譯 → 確認報告正確顯示摘要表格、重疊矩陣、JSON 資料。

**Step 7: Commit**

```bash
git add src/
git commit -m "feat: add analysis report UI with summary, overlap matrix, and JSON export"
```

---

### Task 6: CSS 完善與最終整合

**Files:**
- Modify: `src/style.css`
- Modify: `index.html`（如有需要微調結構）

**Step 1: 完善全域樣式**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1rem;
  color: #333;
  line-height: 1.5;
}
h1 { margin-bottom: 1.5rem; }
h2 { margin: 1.5rem 0 0.75rem; }
section { margin-bottom: 2rem; }
button {
  padding: 0.5rem 1rem;
  cursor: pointer;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 4px;
}
button:hover { background: #f5f5f5; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
```

**Step 2: 完善進度條樣式**

```css
#progress-bar-container {
  background: #eee;
  border-radius: 4px;
  height: 24px;
  margin: 0.5rem 0;
  position: relative;
}
#progress-bar {
  background: #4caf50;
  height: 100%;
  border-radius: 4px;
  width: 0%;
  transition: width 0.3s;
}
#progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.85rem;
}
```

**Step 3: 完善表格樣式**

```css
table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5rem 0;
}
th, td {
  border: 1px solid #ddd;
  padding: 0.5rem;
  text-align: center;
}
th { background: #f5f5f5; }
```

**Step 4: 全流程端到端測試**

上傳多張圖片 → 編譯 → 檢查報告所有區塊：摘要表格、重疊矩陣、顏色判定、JSON 複製/下載。

**Step 5: Commit**

```bash
git add src/ index.html
git commit -m "feat: finalize styles and end-to-end integration"
```

---

## 檔案結構總覽

```
mindar-keypoint-analyzer/
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── docs/plans/
│   ├── 2026-03-03-keypoint-analyzer-design.md
│   └── 2026-03-03-keypoint-analyzer-plan.md
├── detect-keypoints.mjs          (參考檔，不納入建置)
└── src/
    ├── main.js                   (UI 邏輯：上傳、編譯、渲染報告)
    ├── analyze.js                (分析邏輯：擷取特徵點、計算重疊)
    └── style.css                 (全部樣式)
```
