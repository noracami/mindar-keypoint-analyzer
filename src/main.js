import { Compiler } from 'mind-ar/dist/mindar-image.prod.js';
import { analyze } from './analyze.js';
import { renderVisualization } from './visualize.js';
import QRCode from 'qrcode';

/** @type {File[]} */
export let uploadedFiles = [];

/** @type {Compiler | null} */
export let lastCompiler = null;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const previewList = document.getElementById('preview-list');
const compileSection = document.getElementById('compile-section');
const compileBtn = document.getElementById('compile-btn');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const downloadLinkContainer = document.getElementById('download-link');
const clearAllBtn = document.getElementById('clear-all-btn');
const testLinkSection = document.getElementById('test-link-section');
const genTestBtn = document.getElementById('gen-test-btn');
const testLinkResult = document.getElementById('test-link-result');
const qrCanvas = document.getElementById('qr-canvas');
const testUrlLink = document.getElementById('test-url');

const ACCEPTED_TYPES = ['image/png', 'image/jpeg'];

/**
 * Filter files to only keep png/jpeg, then add to uploadedFiles and render previews.
 * @param {FileList | File[]} files
 */
function handleFiles(files) {
  const validFiles = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type));
  if (validFiles.length === 0) return;

  uploadedFiles.push(...validFiles);
  validFiles.forEach(renderPreviewItem);
  compileSection.removeAttribute('hidden');
  clearAllBtn.removeAttribute('hidden');
}

/**
 * Render a single preview item (thumbnail + filename + delete button).
 * @param {File} file
 */
function renderPreviewItem(file) {
  const item = document.createElement('div');
  item.className = 'preview-item';

  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.alt = file.name;
  img.width = 120;

  const name = document.createElement('span');
  name.className = 'preview-filename';
  name.textContent = file.name;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'preview-delete-btn';
  deleteBtn.textContent = 'X';
  deleteBtn.addEventListener('click', () => {
    URL.revokeObjectURL(img.src);
    const idx = uploadedFiles.indexOf(file);
    if (idx !== -1) uploadedFiles.splice(idx, 1);
    item.remove();

    if (uploadedFiles.length === 0) {
      compileSection.setAttribute('hidden', '');
      clearAllBtn.setAttribute('hidden', '');
    }
  });

  item.append(img, name, deleteBtn);
  previewList.appendChild(item);
}

// --- File input change ---
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  // Reset so the same file can be selected again
  fileInput.value = '';
});

// --- Drag-and-drop ---
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

// Also allow clicking the drop zone to trigger file input
dropZone.addEventListener('click', (e) => {
  if (e.target !== fileInput) {
    fileInput.click();
  }
});

// --- Clear all button ---
clearAllBtn.addEventListener('click', () => {
  // Revoke all preview object URLs
  previewList.querySelectorAll('img').forEach((img) => URL.revokeObjectURL(img.src));

  // Clear state
  uploadedFiles.length = 0;
  lastCompiler = null;
  previewList.innerHTML = '';

  // Hide sections
  clearAllBtn.setAttribute('hidden', '');
  compileSection.setAttribute('hidden', '');
  document.getElementById('report-section').hidden = true;

  // Reset progress bar and download link
  progressBarContainer.setAttribute('hidden', '');
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
  downloadLinkContainer.setAttribute('hidden', '');
  downloadLinkContainer.innerHTML = '';

  // Reset test link section
  testLinkSection.setAttribute('hidden', '');
  testLinkResult.setAttribute('hidden', '');

  // Clear visualization
  const vizContainer = document.getElementById('visualization');
  if (vizContainer) vizContainer.innerHTML = '';
});

// --- Generate test link button ---
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

    const printWidth = document.getElementById('print-width').value;
    let testPageUrl = `${window.location.origin}/test.html?id=${id}`;
    if (printWidth) testPageUrl += `&w=${printWidth}`;
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

// --- Image loading helper ---

/**
 * Load a File object as an HTMLImageElement.
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
async function loadImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(file);
  });
}

// --- Compile button ---

compileBtn.addEventListener('click', async () => {
  if (uploadedFiles.length === 0) return;

  // Disable button and show progress bar
  compileBtn.disabled = true;
  progressBarContainer.removeAttribute('hidden');
  downloadLinkContainer.setAttribute('hidden', '');
  progressBar.style.width = '0%';
  progressText.textContent = '0%';

  try {
    // Load all uploaded files as HTMLImageElement
    const images = await Promise.all(uploadedFiles.map(loadImage));

    // Create compiler and compile
    const compiler = new Compiler();
    await compiler.compileImageTargets(images, (progress) => {
      // progress is 0–100
      const pct = Math.round(progress);
      progressBar.style.width = `${pct}%`;
      progressText.textContent = `${pct}%`;
    });

    // Store the compiler instance at module scope for Task 4 (analyze.js)
    lastCompiler = compiler;

    // Export .mind file and create download link
    const buffer = compiler.exportData();
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);

    downloadLinkContainer.innerHTML = '';
    const a = document.createElement('a');
    a.href = url;
    a.download = 'targets.mind';
    a.textContent = '下載 targets.mind';
    downloadLinkContainer.appendChild(a);
    downloadLinkContainer.removeAttribute('hidden');
    testLinkSection.removeAttribute('hidden');

    // Ensure progress shows 100%
    progressBar.style.width = '100%';
    progressText.textContent = '100%';

    const fileNames = uploadedFiles.map(f => f.name);
    const result = analyze(compiler);
    renderVisualization(document.getElementById('visualization'), compiler, result, fileNames);
    renderReport(result, fileNames);
    document.getElementById('report-section').hidden = false;
  } catch (err) {
    console.error('編譯失敗:', err);
    progressText.textContent = '編譯失敗，請查看 Console';
  } finally {
    compileBtn.disabled = false;
  }
});

// --- Report rendering ---

/**
 * Render the analysis report: summary table, overlap matrix, and JSON export.
 * @param {{ targets: object[], matrix: number[][], uniqueness: object[] }} result
 * @param {string[]} fileNames
 */
function renderReport(result, fileNames) {
  const { targets, matrix, uniqueness } = result;

  // --- 1. Summary table ---
  const summaryContainer = document.getElementById('summary-table');
  summaryContainer.innerHTML = '';

  const summaryTable = document.createElement('table');
  const summaryHead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['圖片', '特徵點總數', '獨有數', '共用數', '獨有率 (%)'].forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  summaryHead.appendChild(headRow);
  summaryTable.appendChild(summaryHead);

  const summaryBody = document.createElement('tbody');
  uniqueness.forEach((u, i) => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = fileNames[i] || `Image ${i}`;
    tr.appendChild(tdName);

    const tdTotal = document.createElement('td');
    tdTotal.textContent = u.total;
    tr.appendChild(tdTotal);

    const tdUnique = document.createElement('td');
    tdUnique.textContent = u.unique;
    tr.appendChild(tdUnique);

    const tdShared = document.createElement('td');
    tdShared.textContent = u.shared;
    tr.appendChild(tdShared);

    const tdRate = document.createElement('td');
    tdRate.textContent = Math.round(u.uniqueRate * 100) + '%';
    if (u.uniqueRate > 0.5) {
      tdRate.style.background = '#d4edda';
    } else if (u.uniqueRate >= 0.3) {
      tdRate.style.background = '#fff3cd';
    } else {
      tdRate.style.background = '#f8d7da';
    }
    tr.appendChild(tdRate);

    summaryBody.appendChild(tr);
  });
  summaryTable.appendChild(summaryBody);
  summaryContainer.appendChild(summaryTable);

  // --- 2. Overlap matrix ---
  const matrixContainer = document.getElementById('overlap-matrix');
  matrixContainer.innerHTML = '';

  const matrixTable = document.createElement('table');
  const matrixHead = document.createElement('thead');
  const matrixHeadRow = document.createElement('tr');

  // Top-left corner cell (empty)
  const cornerTh = document.createElement('th');
  matrixHeadRow.appendChild(cornerTh);

  fileNames.forEach((name) => {
    const th = document.createElement('th');
    th.textContent = name;
    matrixHeadRow.appendChild(th);
  });
  matrixHead.appendChild(matrixHeadRow);
  matrixTable.appendChild(matrixHead);

  const matrixBody = document.createElement('tbody');
  matrix.forEach((row, i) => {
    const tr = document.createElement('tr');

    const rowHeader = document.createElement('th');
    rowHeader.textContent = fileNames[i] || `Image ${i}`;
    tr.appendChild(rowHeader);

    row.forEach((val) => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });

    matrixBody.appendChild(tr);
  });
  matrixTable.appendChild(matrixBody);
  matrixContainer.appendChild(matrixTable);

  // --- 3. JSON section ---
  const jsonData = { targets, matrix, uniqueness };
  const jsonStr = JSON.stringify(jsonData, null, 2);

  const jsonOutput = document.getElementById('json-output');
  jsonOutput.textContent = jsonStr;

  document.getElementById('copy-json-btn').onclick = () => {
    navigator.clipboard.writeText(jsonStr).then(() => {
      const btn = document.getElementById('copy-json-btn');
      const original = btn.textContent;
      btn.textContent = '已複製！';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  };

  document.getElementById('download-json-btn').onclick = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis.json';
    a.click();
    URL.revokeObjectURL(url);
  };
}
