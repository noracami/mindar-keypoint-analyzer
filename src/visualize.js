/**
 * Keypoint visualization on canvas.
 *
 * Draws grayscale target images with colored keypoint overlays
 * and pair-wise overlap comparison views.
 */

import { hammingDistance, MAX_HAMMING_BITS, DESCRIPTOR_THRESHOLD } from './analyze.js';

/**
 * Draw a grayscale image from targetImage data onto a canvas,
 * then overlay keypoints as colored dots.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ width: number, height: number, data: Uint8Array }} targetImage
 * @param {{ x: number, y: number }[]} keypoints - normalized 0–1 coords
 * @param {Set<number>} sharedSet - indices of keypoints that are shared (red)
 */
export function drawKeypointImage(canvas, targetImage, keypoints, sharedSet) {
  const { width, height, data } = targetImage;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Draw grayscale base image
  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  // Draw keypoints
  const radius = Math.max(2, Math.round(width / 150));
  keypoints.forEach((kp, idx) => {
    const isShared = sharedSet.has(idx);
    ctx.beginPath();
    ctx.arc(kp.x * width, kp.y * height, radius, 0, Math.PI * 2);
    ctx.fillStyle = isShared ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 200, 0, 0.7)';
    ctx.fill();
  });
}

/**
 * Draw a grayscale image with overlapping keypoints highlighted in red,
 * and blue rectangles around dense overlap regions.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ width: number, height: number, data: Uint8Array }} targetImage
 * @param {{ x: number, y: number }[]} keypointsA - normalized coords of this image
 * @param {{ x: number, y: number }[]} keypointsB - normalized coords of the other image
 * @param {number} threshold
 */
export function drawPairComparison(canvas, targetImage, keypointsA, keypointsB, threshold) {
  const { width, height, data } = targetImage;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Draw grayscale base image
  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  // Find overlapping keypoints in A that match something in B
  const overlapPoints = [];
  const radius = Math.max(2, Math.round(width / 150));
  const descThreshold = MAX_HAMMING_BITS * DESCRIPTOR_THRESHOLD;

  for (const a of keypointsA) {
    for (const b of keypointsB) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold
          && hammingDistance(a.descriptors, b.descriptors) < descThreshold) {
        overlapPoints.push(a);
        break;
      }
    }
  }

  // Draw overlap keypoints as red dots
  for (const pt of overlapPoints) {
    ctx.beginPath();
    ctx.arc(pt.x * width, pt.y * height, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.fill();
  }

  // Draw blue rectangles around dense overlap regions (8×8 grid)
  const gridSize = 8;
  const cellW = 1 / gridSize;
  const cellH = 1 / gridSize;
  const grid = Array.from({ length: gridSize }, () => new Array(gridSize).fill(0));

  for (const pt of overlapPoints) {
    const col = Math.min(Math.floor(pt.x / cellW), gridSize - 1);
    const row = Math.min(Math.floor(pt.y / cellH), gridSize - 1);
    grid[row][col]++;
  }

  ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
  ctx.lineWidth = Math.max(1, Math.round(width / 200));
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] >= 2) {
        ctx.strokeRect(
          c * cellW * width,
          r * cellH * height,
          cellW * width,
          cellH * height,
        );
      }
    }
  }
}

/**
 * Build the full visualization section: individual keypoint images
 * and pair-wise overlap comparisons.
 *
 * @param {HTMLElement} container
 * @param {import('mind-ar/src/image-target/compiler').Compiler} compiler
 * @param {{ targets: { keypoints: { x: number, y: number }[] }[], matrix: number[][], uniqueness: object[] }} result
 * @param {string[]} fileNames
 */
export function renderVisualization(container, compiler, result, fileNames) {
  container.innerHTML = '';
  const { targets } = result;
  const threshold = 0.01;

  // --- Section A: Individual keypoint images ---
  const sectionA = document.createElement('div');
  sectionA.className = 'viz-section';

  const headingA = document.createElement('h3');
  headingA.textContent = '特徵點分佈';
  sectionA.appendChild(headingA);

  const legendA = document.createElement('p');
  legendA.className = 'viz-legend';
  legendA.innerHTML = '<span class="dot dot-green"></span> 獨有特徵點　<span class="dot dot-red"></span> 共用特徵點';
  sectionA.appendChild(legendA);

  const gridA = document.createElement('div');
  gridA.className = 'viz-grid';

  targets.forEach((target, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'viz-card';

    const title = document.createElement('div');
    title.className = 'viz-card-title';
    title.textContent = fileNames[i] || `Image ${i}`;
    wrap.appendChild(title);

    const canvas = document.createElement('canvas');
    canvas.className = 'viz-canvas';

    // Build shared set: which keypoint indices in target i are shared with any other target
    const sharedSet = new Set();
    const kpA = target.keypoints;
    const descThreshold = MAX_HAMMING_BITS * DESCRIPTOR_THRESHOLD;
    for (let ki = 0; ki < kpA.length; ki++) {
      for (let j = 0; j < targets.length; j++) {
        if (i === j) continue;
        for (const b of targets[j].keypoints) {
          const dx = kpA[ki].x - b.x;
          const dy = kpA[ki].y - b.y;
          if (Math.sqrt(dx * dx + dy * dy) < threshold
              && hammingDistance(kpA[ki].descriptors, b.descriptors) < descThreshold) {
            sharedSet.add(ki);
            break;
          }
        }
        if (sharedSet.has(ki)) break;
      }
    }

    const targetImage = compiler.data[i].targetImage;
    drawKeypointImage(canvas, targetImage, kpA, sharedSet);
    wrap.appendChild(canvas);
    gridA.appendChild(wrap);
  });

  sectionA.appendChild(gridA);
  container.appendChild(sectionA);

  // --- Section B: Pair-wise overlap comparisons ---
  const n = targets.length;
  if (n < 2) return;

  const sectionB = document.createElement('div');
  sectionB.className = 'viz-section';

  const headingB = document.createElement('h3');
  headingB.textContent = '配對重疊比較';
  sectionB.appendChild(headingB);

  const legendB = document.createElement('p');
  legendB.className = 'viz-legend';
  legendB.innerHTML = '<span class="dot dot-red"></span> 重疊特徵點　<span class="dot-rect"></span> 密集重疊區域';
  sectionB.appendChild(legendB);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pairWrap = document.createElement('div');
      pairWrap.className = 'viz-pair';

      const overlapVal = result.matrix[i][j];
      const pairTitle = document.createElement('div');
      pairTitle.className = 'viz-pair-title';
      pairTitle.textContent = `${fileNames[i]} ↔ ${fileNames[j]}（重疊：${overlapVal}）`;
      pairWrap.appendChild(pairTitle);

      const pairCanvases = document.createElement('div');
      pairCanvases.className = 'viz-pair-canvases';

      // Canvas for image i
      const canvasI = document.createElement('canvas');
      canvasI.className = 'viz-canvas';
      drawPairComparison(canvasI, compiler.data[i].targetImage, targets[i].keypoints, targets[j].keypoints, threshold);
      pairCanvases.appendChild(canvasI);

      // Canvas for image j
      const canvasJ = document.createElement('canvas');
      canvasJ.className = 'viz-canvas';
      drawPairComparison(canvasJ, compiler.data[j].targetImage, targets[j].keypoints, targets[i].keypoints, threshold);
      pairCanvases.appendChild(canvasJ);

      pairWrap.appendChild(pairCanvases);
      sectionB.appendChild(pairWrap);
    }
  }

  container.appendChild(sectionB);
}
