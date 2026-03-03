import { Compiler } from 'mind-ar/src/image-target/compiler';

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

    // Ensure progress shows 100%
    progressBar.style.width = '100%';
    progressText.textContent = '100%';

    // TODO: const result = analyze(compiler);
    // TODO: renderReport(result, fileNames);
  } catch (err) {
    console.error('編譯失敗:', err);
    progressText.textContent = '編譯失敗，請查看 Console';
  } finally {
    compileBtn.disabled = false;
  }
});
