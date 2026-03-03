/** @type {File[]} */
export let uploadedFiles = [];

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const previewList = document.getElementById('preview-list');
const compileSection = document.getElementById('compile-section');

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
