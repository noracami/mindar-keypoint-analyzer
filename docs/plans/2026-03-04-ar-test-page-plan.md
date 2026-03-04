# AR Test Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 編譯完 .mind 檔後，上傳到 R2，產生 QR code，讓手機掃碼開啟 AR 測試頁驗證辨識效果。

**Architecture:** Vite multi-page app（index.html + test.html）。Pages Functions 作為上傳/下載 API，R2 儲存 .mind 檔。測試頁用 A-Frame + MindAR 做 AR 辨識，辨識到時顯示半透明綠色色塊。

**Tech Stack:** Vite, A-Frame (CDN), MindAR A-Frame (CDN), Cloudflare Pages Functions, R2, qrcode (npm)

---

### Task 1: 專案設定 — Vite multi-page + wrangler.toml + 安裝依賴

**Files:**
- Modify: `vite.config.js`
- Create: `wrangler.toml`
- Modify: `package.json`

**Step 1: 更新 vite.config.js 為 multi-page**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        test: 'test.html',
      },
    },
  },
});
```

**Step 2: 建立 wrangler.toml**

```toml
name = "mindar-keypoint-analyzer"
compatibility_date = "2024-12-01"

[[r2_buckets]]
binding = "MIND_BUCKET"
bucket_name = "mindar-mind-files"
```

**Step 3: 安裝 qrcode 依賴**

```bash
npm install qrcode
```

**Step 4: 更新 .gitignore**

加入 `.wrangler/` 目錄（wrangler 本地開發產生的檔案）。

```
node_modules/
dist/
.wrangler/
```

**Step 5: Commit**

```bash
git add vite.config.js wrangler.toml package.json package-lock.json .gitignore
git commit -m "chore: add Vite multi-page config, wrangler.toml, qrcode dep"
```

---

### Task 2: R2 上傳 API — POST /api/mind

**Files:**
- Create: `functions/api/mind.js`

**Step 1: 建立 Pages Function**

```js
export async function onRequestPost(context) {
  const { request, env } = context;

  const body = await request.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return new Response(JSON.stringify({ error: 'Empty body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await env.MIND_BUCKET.put(id, body, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });

  return new Response(JSON.stringify({ id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

**Step 2: Commit**

```bash
git add functions/api/mind.js
git commit -m "feat: add R2 upload API for .mind files"
```

---

### Task 3: R2 下載 API — GET /api/mind/:id

**Files:**
- Create: `functions/api/mind/[id].js`

**Step 1: 建立 Pages Function**

```js
export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  const object = await env.MIND_BUCKET.get(id);
  if (!object) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
```

**Step 2: Commit**

```bash
git add functions/api/mind/[id].js
git commit -m "feat: add R2 download API for .mind files"
```

---

### Task 4: AR 測試頁 — test.html + src/test.js

**Files:**
- Create: `test.html`
- Create: `src/test.js`

**Step 1: 建立 test.html**

A-Frame 和 MindAR A-Frame 用 CDN script tags 載入（它們依賴全域 `AFRAME` 物件，不適合 ES module import）。`src/test.js` 用 Vite module 處理 fetch 和場景初始化。

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MindAR AR 測試</title>
  <style>
    body { margin: 0; overflow: hidden; font-family: sans-serif; }
    #loading {
      position: fixed; inset: 0; display: flex;
      align-items: center; justify-content: center;
      background: #000; color: #fff; font-size: 1.2rem; z-index: 9999;
    }
    #loading.hidden { display: none; }
    #error {
      position: fixed; inset: 0; display: flex;
      align-items: center; justify-content: center;
      background: #000; color: #f44; font-size: 1.2rem; z-index: 9999;
    }
    #error.hidden { display: none; }
  </style>
  <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>
</head>
<body>
  <div id="loading">載入中...</div>
  <div id="error" class="hidden"></div>
  <script type="module" src="/src/test.js"></script>
</body>
</html>
```

**Step 2: 建立 src/test.js**

```js
async function init() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');

  // 1. Read id from URL query
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    showError(errorEl, loadingEl, '缺少 id 參數');
    return;
  }

  // 2. Fetch .mind file from API
  let mindBlob;
  try {
    const res = await fetch(`/api/mind/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    mindBlob = await res.blob();
  } catch (err) {
    showError(errorEl, loadingEl, `無法載入 .mind 檔：${err.message}`);
    return;
  }

  const mindUrl = URL.createObjectURL(mindBlob);

  // 3. Build A-Frame scene dynamically
  const scene = document.createElement('a-scene');
  scene.setAttribute('mindar-image', `imageTargetSrc: ${mindUrl}; autoStart: true;`);
  scene.setAttribute('color-space', 'sRGB');
  scene.setAttribute('renderer', 'colorManagement: true');
  scene.setAttribute('vr-mode-ui', 'enabled: false');
  scene.setAttribute('device-orientation-permission-ui', 'enabled: false');

  const camera = document.createElement('a-camera');
  camera.setAttribute('position', '0 0 0');
  camera.setAttribute('look-controls', 'enabled: false');
  scene.appendChild(camera);

  const target = document.createElement('a-entity');
  target.setAttribute('mindar-image-target', 'targetIndex: 0');

  const plane = document.createElement('a-plane');
  plane.setAttribute('color', '#00ff00');
  plane.setAttribute('opacity', '0.5');
  plane.setAttribute('position', '0 0 0');
  plane.setAttribute('width', '1');
  plane.setAttribute('height', '0.552');
  target.appendChild(plane);

  scene.appendChild(target);
  document.body.appendChild(scene);

  // 4. Hide loading when AR is ready
  scene.addEventListener('arReady', () => {
    loadingEl.classList.add('hidden');
  });

  scene.addEventListener('arError', () => {
    showError(errorEl, loadingEl, 'AR 初始化失敗');
  });
}

function showError(errorEl, loadingEl, message) {
  loadingEl.classList.add('hidden');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

init();
```

**Step 3: 驗證 build**

```bash
npx vite build
```

Expected: `dist/` 包含 `index.html` 和 `test.html` 兩個 entry。

**Step 4: Commit**

```bash
git add test.html src/test.js
git commit -m "feat: add AR test page with MindAR A-Frame"
```

---

### Task 5: 整合 QR code — 分析工具加上傳 + QR 顯示

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`

**Step 1: 在 index.html 加 QR code 容器**

在 `#download-link` 之後加入：

```html
<div id="test-link-section" hidden>
  <button id="gen-test-btn">產生測試連結</button>
  <div id="test-link-result" hidden>
    <canvas id="qr-canvas"></canvas>
    <p><a id="test-url" target="_blank"></a></p>
  </div>
</div>
```

**Step 2: 在 src/main.js 加入上傳和 QR code 邏輯**

在編譯完成後（`downloadLinkContainer.removeAttribute('hidden')` 之後），顯示「產生測試連結」按鈕。

引入 qrcode：

```js
import QRCode from 'qrcode';
```

加入 DOM 參考和事件：

```js
const testLinkSection = document.getElementById('test-link-section');
const genTestBtn = document.getElementById('gen-test-btn');
const testLinkResult = document.getElementById('test-link-result');
const qrCanvas = document.getElementById('qr-canvas');
const testUrlLink = document.getElementById('test-url');
```

在編譯成功後顯示按鈕：

```js
// 在 downloadLinkContainer.removeAttribute('hidden') 之後加入
testLinkSection.removeAttribute('hidden');
```

在 clearAllBtn click handler 中隱藏：

```js
testLinkSection.setAttribute('hidden', '');
testLinkResult.setAttribute('hidden', '');
```

按鈕事件：

```js
genTestBtn.addEventListener('click', async () => {
  if (!lastCompiler) return;
  genTestBtn.disabled = true;
  genTestBtn.textContent = '上傳中...';

  try {
    const buffer = lastCompiler.exportData();
    const res = await fetch('/api/mind', {
      method: 'POST',
      body: buffer,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const { id } = await res.json();

    const testPageUrl = `${window.location.origin}/test.html?id=${id}`;
    testUrlLink.href = testPageUrl;
    testUrlLink.textContent = testPageUrl;

    await QRCode.toCanvas(qrCanvas, testPageUrl, { width: 200 });
    testLinkResult.removeAttribute('hidden');
  } catch (err) {
    console.error('產生測試連結失敗:', err);
    alert('產生測試連結失敗：' + err.message);
  } finally {
    genTestBtn.disabled = false;
    genTestBtn.textContent = '產生測試連結';
  }
});
```

**Step 3: 驗證 build**

```bash
npx vite build
```

**Step 4: Commit**

```bash
git add index.html src/main.js
git commit -m "feat: add upload-to-R2 and QR code generation"
```

---

### Task 6: R2 Bucket 建立 + 部署驗證

**Step 1: 建立 R2 bucket**

```bash
npx wrangler r2 bucket create mindar-mind-files
```

**Step 2: 用 wrangler pages dev 本地測試**

```bash
npx wrangler pages dev -- npx vite
```

在瀏覽器中測試完整流程：上傳圖片 → 編譯 → 產生測試連結 → QR code 顯示。

**Step 3: 部署**

```bash
npx vite build
npx wrangler pages deploy dist/ --project-name=mindar-keypoint-analyzer
```

需要在 Cloudflare Dashboard 中將 R2 bucket 綁定到 Pages 專案：
Settings → Functions → R2 bucket bindings → 新增 `MIND_BUCKET` → 選 `mindar-mind-files`

**Step 4: Commit（如有調整）**

```bash
git add -A
git commit -m "chore: finalize deployment configuration"
```
