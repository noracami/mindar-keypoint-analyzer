async function init() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const statsEl = document.getElementById('stats');

  // 1. Read id from URL query
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    showError(errorEl, loadingEl, '缺少 id 參數');
    return;
  }
  const physicalWidthCm = parseFloat(params.get('w')) || null;

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

  // "辨識成功" text overlay on detected target
  const text = document.createElement('a-text');
  text.setAttribute('value', '辨識成功');
  text.setAttribute('color', '#00ff00');
  text.setAttribute('align', 'center');
  text.setAttribute('width', '2');
  text.setAttribute('position', '0 0 0.01');
  text.setAttribute('font', 'https://cdn.aframe.io/fonts/mozillavr.fnt');
  target.appendChild(text);

  // Semi-transparent background behind text
  const bg = document.createElement('a-plane');
  bg.setAttribute('color', '#000');
  bg.setAttribute('opacity', '0.5');
  bg.setAttribute('width', '0.8');
  bg.setAttribute('height', '0.2');
  bg.setAttribute('position', '0 0 0');
  target.appendChild(bg);

  scene.appendChild(target);
  document.body.appendChild(scene);

  // 4. Tracking stats
  let trackingStatus = '等待辨識...';
  let distance = '-';
  let foundCount = 0;
  let lostCount = 0;
  let lastFoundTime = null;

  function updateStats() {
    const statusClass = trackingStatus === '已辨識' ? 'found' : 'lost';
    statsEl.innerHTML =
      `<span class="label">狀態：</span><span class="${statusClass}">${trackingStatus}</span>` +
      `　<span class="label">距離：</span>${distance}` +
      `　<span class="label">辨識次數：</span>${foundCount}` +
      `　<span class="label">丟失次數：</span>${lostCount}`;
  }

  target.addEventListener('targetFound', () => {
    trackingStatus = '已辨識';
    foundCount++;
    lastFoundTime = Date.now();
    updateStats();
  });

  target.addEventListener('targetLost', () => {
    trackingStatus = '已丟失';
    lostCount++;
    lastFoundTime = null;
    distance = '-';
    updateStats();
  });

  // Update distance from camera while tracking
  // MindAR sets object3D.matrix directly (matrixAutoUpdate=false),
  // so we decompose the matrix to get the actual position.
  const _pos = new AFRAME.THREE.Vector3();
  const _quat = new AFRAME.THREE.Quaternion();
  const _scale = new AFRAME.THREE.Vector3();
  let markerPixelWidth = null;
  target.addEventListener('targetUpdate', () => {
    // Get markerWidth from MindAR's internal data (pixel width of target image)
    if (!markerPixelWidth) {
      const comp = target.components['mindar-image-target'];
      if (comp && comp.postMatrix) {
        const s = new AFRAME.THREE.Vector3();
        comp.postMatrix.decompose(new AFRAME.THREE.Vector3(), new AFRAME.THREE.Quaternion(), s);
        markerPixelWidth = s.x;
      }
    }

    target.object3D.matrix.decompose(_pos, _quat, _scale);
    const rawDist = Math.sqrt(_pos.x * _pos.x + _pos.y * _pos.y + _pos.z * _pos.z);

    if (physicalWidthCm && markerPixelWidth) {
      // Convert to cm: rawDist is in MindAR units (pixels), scale to physical
      const cmDist = (rawDist / markerPixelWidth) * physicalWidthCm;
      distance = `${cmDist.toFixed(1)} cm`;
    } else {
      distance = rawDist.toFixed(2);
    }
    updateStats();
  });

  // 5. Hide loading when AR is ready
  scene.addEventListener('arReady', () => {
    loadingEl.classList.add('hidden');
    statsEl.classList.add('visible');
    updateStats();
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
