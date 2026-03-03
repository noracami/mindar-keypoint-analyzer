/**
 * Keypoint extraction and overlap analysis logic.
 *
 * Pure logic module — no DOM manipulation.
 * The `compiler` parameter is a MindAR Compiler instance
 * after `compileImageTargets()` has been called.
 */

/**
 * Compute the Hamming distance between two FREAK descriptors.
 * Each descriptor is an array of 32-bit integers (length 21, packing 666 bits).
 */
export function hammingDistance(v1, v2) {
  let d = 0;
  for (let i = 0; i < v1.length; i++) {
    let x = (v1[i] ^ v2[i]) >>> 0;
    x = x - ((x >> 1) & 0x55555555);
    x = ((x >> 2) & 0x33333333) + (x & 0x33333333);
    x = ((x >> 4) + x) & 0x0F0F0F0F;
    x = ((x >> 8) + x) & 0x00FF00FF;
    x = ((x >> 16) + x) & 0x0000FFFF;
    d += x;
  }
  return d;
}
export const MAX_HAMMING_BITS = 666;
export const DESCRIPTOR_THRESHOLD = 0.4;

/**
 * Extract keypoint coordinates from the MindAR compiler's internal data structure.
 * Normalizes coordinates to the 0–1 range based on each target's image dimensions.
 *
 * @param {import('mind-ar/src/image-target/compiler').Compiler} compiler
 * @returns {{ index: number, width: number, height: number, keypoints: { x: number, y: number }[] }[]}
 */
function extractKeypoints(compiler) {
  return compiler.data.map((targetData, index) => {
    const { width, height } = targetData.targetImage;

    // Take the first level (highest resolution) of matchingData
    const md = targetData.matchingData[0];
    const rawPoints = [...md.maximaPoints, ...md.minimaPoints];

    // Normalize coordinates to 0~1
    const keypoints = rawPoints.map(p => ({
      x: p.x / width,
      y: p.y / height,
      descriptors: p.descriptors,
    }));

    return { index, width, height, keypoints };
  });
}

/**
 * Count how many keypoints in kpA have at least one match in kpB
 * within the given threshold (Euclidean distance on normalized coords).
 *
 * @param {{ x: number, y: number }[]} kpA
 * @param {{ x: number, y: number }[]} kpB
 * @param {number} threshold
 * @returns {number}
 */
function overlapCount(kpA, kpB, threshold) {
  const descThreshold = MAX_HAMMING_BITS * DESCRIPTOR_THRESHOLD;
  let count = 0;
  for (const a of kpA) {
    for (const b of kpB) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold
          && hammingDistance(a.descriptors, b.descriptors) < descThreshold) {
        count++;
        break;
      }
    }
  }
  return count;
}

/**
 * Compute an N×N overlap matrix.
 * Diagonal entries hold the keypoint count for each target.
 * Off-diagonal entries hold the number of shared keypoints between two targets.
 *
 * @param {{ keypoints: { x: number, y: number }[] }[]} targets
 * @param {number} [threshold=0.03]
 * @returns {number[][]}
 */
function computeOverlapMatrix(targets, threshold = 0.01) {
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

/**
 * For each target, compute how many keypoints are unique
 * (not overlapping with any other target within the threshold).
 *
 * @param {{ keypoints: { x: number, y: number }[] }[]} targets
 * @param {number} [threshold=0.03]
 * @returns {{ index: number, total: number, unique: number, shared: number, uniqueRate: number }[]}
 */
function computeUniqueness(targets, threshold = 0.01) {
  const descThreshold = MAX_HAMMING_BITS * DESCRIPTOR_THRESHOLD;
  return targets.map((target, i) => {
    let shared = 0;
    for (const kp of target.keypoints) {
      let isShared = false;
      for (let j = 0; j < targets.length; j++) {
        if (i === j) continue;
        for (const other of targets[j].keypoints) {
          const dx = kp.x - other.x;
          const dy = kp.y - other.y;
          if (Math.sqrt(dx * dx + dy * dy) < threshold
              && hammingDistance(kp.descriptors, other.descriptors) < descThreshold) {
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

/**
 * Main analysis entry point.
 * Extracts keypoints from the compiler, computes the overlap matrix,
 * and evaluates uniqueness for each target.
 *
 * @param {import('mind-ar/src/image-target/compiler').Compiler} compiler
 * @returns {{ targets: object[], matrix: number[][], uniqueness: object[] }}
 */
export function analyze(compiler) {
  const targets = extractKeypoints(compiler);
  const matrix = computeOverlapMatrix(targets);
  const uniqueness = computeUniqueness(targets);
  return { targets, matrix, uniqueness };
}
