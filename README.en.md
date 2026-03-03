# MindAR Keypoint Dispersion Analyzer

**[中文版](./README.md)**

## Background

We use [MindAR](https://github.com/hiukim/mind-ar-js) for image recognition, compiling multiple poster images into a single `.mind` file. Each poster corresponds to a target index — when the camera points at a specific poster, only that poster's index should trigger, without false matches on other posters.

After compilation, MindAR's Image Target Compiler produces a preview: **red dots on a grayscale image**, where each dot represents an extracted keypoint. If keypoints from different posters overlap heavily (e.g., shared borders, logos, QR codes), it leads to misrecognition.

### The Problem

The previous testing workflow was fragmented:

1. Upload images to MindAR's official online tool (https://hiukim.github.io/mind-ar-js-doc/tools/compile/) and wait for compilation
2. Manually screenshot the preview images
3. Feed screenshots to a Node.js script (`detect-keypoints.mjs`) for analysis
4. Read analysis results from terminal output

This process was tedious, error-prone, and lost precision during the screenshot step.

### Solution

MindAR's Compiler is implemented in JavaScript and provides a browser-side API that can be called directly from a webpage, without depending on the official online tool.

We integrated **compilation** and **keypoint analysis** into a single browser-based tool, completing the entire testing workflow on one page.

## Features

### Workflow

All operations are completed on a single webpage:

1. **Upload poster images** → 2. **Compile `.mind` file** → 3. **Analyze keypoint dispersion** → 4. **View report**

### Step 1: Upload Images

- Supports multiple poster images (PNG / JPG)
- No limit on quantity
- Displays image previews with filenames

### Step 2: Compile `.mind` File

- Uses MindAR's browser-side `Compiler` class
- Displays compilation progress (via MindAR's progressCallback)
- After compilation:
  - Provides `.mind` file download
  - Extracts keypoint data (grayscale images, matching data) directly from the Compiler's internal data — no screenshots needed

### Step 3: Analyze Keypoint Dispersion

- **Coordinate normalization**: Converts pixel coordinates to 0–1 range for cross-image comparison
- **FREAK descriptor extraction**: Each keypoint carries a 666-bit FREAK descriptor (21 × 32-bit integers) describing local texture around the point
- **Overlap detection**: Pairwise comparison using dual criteria:
  - Normalized Euclidean distance < 1% **and** descriptor Hamming distance < 40% (266/666 bits)
  - Produces an N×N overlap matrix
- **Uniqueness calculation**: How many keypoints per image are unique (not overlapping with any other image)

### Step 4: View Report

1. **Summary table**: Total keypoints, unique count, shared count, uniqueness rate (%) per image
2. **N×N overlap matrix**: Shared keypoint counts between all pairs
3. **Color-coded assessment**:
   - Uniqueness > 50%: Good distinguishability (green)
   - Uniqueness 30%–50%: Moderate, potential false matches (yellow)
   - Uniqueness < 30%: Poor, consider adjusting images (red)
4. **Raw JSON data**: Full keypoint coordinates for further analysis (copy or download)
5. **Keypoint visualization**:
   - Per-image keypoint distribution (green = unique, red = shared)
   - Pair-wise overlap comparison (red dots = overlapping keypoints, blue boxes = dense overlap regions)

## Technical Details

### Browser-side MindAR Compiler API

```js
import { Compiler } from 'mind-ar/src/image-target/compiler.js';

const compiler = new Compiler();
await compiler.compileImageTargets(images, (progress) => {
  // progress: 0 ~ 100
});
const buffer = compiler.exportData(); // .mind file as ArrayBuffer
```

- `Compiler` extends `CompilerBase`, using `document.createElement('canvas')` for image processing
- Tracking phase uses Web Workers, keeping the UI responsive
- `compileImageTargets()` accepts an array of HTML Image elements
- After compilation, `compiler.data` contains `matchingData` (keypoint coordinates and FREAK descriptors) for each image

## Development & Deployment

### Tech Stack

- **Node.js** — Development runtime
- **npm** — Package management
- **Vite** — Dev server and build tool (MindAR's Web Worker imports use Vite-specific syntax)
- **Vanilla JS** — No frontend framework, keeping it simple

### Dependencies

- `mind-ar` — MindAR Compiler core (automatically pulls in `@tensorflow/tfjs`, `@msgpack/msgpack`, etc.)

### Development

```bash
npm install
npm run dev     # Start Vite dev server
```

### Build & Deploy

```bash
npm run build   # Output static files to dist/
npx wrangler pages deploy dist/ --project-name=mindar-keypoint-analyzer
```

The build output is purely static (HTML + JS + CSS), deployed to Cloudflare Pages with no Node.js runtime required.

Live: https://mindar-keypoint-analyzer.pages.dev/

<!-- TODO: Switch to GitHub Actions for automatic deployment to Cloudflare Pages -->

## Notes

- Distance threshold (1%) and descriptor similarity threshold (40%) are constants that can be adjusted as needed
- FREAK descriptors are rotation-invariant, so rotating identical patterns will not reduce overlap
- If posters share structural elements (QR code finder patterns, borders, etc.), those regions will have similar descriptors and be correctly identified as overlapping
- MindAR Compiler depends on `@tensorflow/tfjs`, which may be slow on first load
