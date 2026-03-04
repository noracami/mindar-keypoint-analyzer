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
