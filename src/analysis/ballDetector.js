/**
 * Ball detection using frame differencing + color thresholding.
 * Processes a video blob and returns detected ball positions per frame.
 */

const MOTION_THRESHOLD = 30;
const WHITE_MIN = 180;
const SATURATION_MAX = 40;
const MIN_BLOB_SIZE = 3;
const MAX_BLOB_SIZE = 60;

/**
 * Extract ball positions from a video blob.
 * @param {Blob} videoBlob
 * @param {function} onProgress - callback(progress 0-1)
 * @returns {Promise<Array<{frame: number, x: number, y: number, confidence: number}>>}
 */
export async function detectBall(videoBlob, onProgress = () => {}) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(videoBlob);

  await new Promise((resolve) => {
    video.addEventListener('loadedmetadata', resolve, { once: true });
    video.load();
  });

  const width = Math.min(video.videoWidth, 640); // downsample for speed
  const height = Math.round(width * (video.videoHeight / video.videoWidth));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const fps = 30; // assume 30fps for frame stepping
  const frameDuration = 1 / fps;
  const totalFrames = Math.floor(video.duration * fps);

  let prevPixels = null;
  const detections = [];

  for (let i = 0; i < totalFrames; i++) {
    video.currentTime = i * frameDuration;
    await seekReady(video);

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    if (prevPixels) {
      const result = findBall(pixels, prevPixels, width, height);
      if (result) {
        detections.push({ frame: i, x: result.x, y: result.y, confidence: result.confidence });
      }
    }

    prevPixels = new Uint8ClampedArray(pixels);
    onProgress(i / totalFrames);
  }

  URL.revokeObjectURL(video.src);
  return detections;
}

function seekReady(video) {
  return new Promise((resolve) => {
    if (video.readyState >= 2) {
      video.addEventListener('seeked', resolve, { once: true });
    } else {
      video.addEventListener('seeked', resolve, { once: true });
    }
  });
}

/**
 * Find the ball in a single frame by comparing to previous frame.
 */
function findBall(pixels, prevPixels, width, height) {
  // Step 1: Motion detection + color filtering
  const motionMask = new Uint8Array(width * height);

  for (let i = 0; i < pixels.length; i += 4) {
    const idx = i / 4;
    const dr = Math.abs(pixels[i] - prevPixels[i]);
    const dg = Math.abs(pixels[i + 1] - prevPixels[i + 1]);
    const db = Math.abs(pixels[i + 2] - prevPixels[i + 2]);

    // Motion detected?
    if (dr + dg + db > MOTION_THRESHOLD * 3) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];

      // White-ish color check (baseball)
      if (r > WHITE_MIN && g > WHITE_MIN && b > WHITE_MIN) {
        // Low saturation check
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : ((max - min) / max) * 100;
        if (saturation < SATURATION_MAX) {
          motionMask[idx] = 1;
        }
      }
    }
  }

  // Step 2: Find connected components (simple flood-fill)
  const visited = new Uint8Array(width * height);
  let bestBlob = null;
  let bestSize = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (motionMask[idx] && !visited[idx]) {
        const blob = floodFill(motionMask, visited, x, y, width, height);
        if (blob.size >= MIN_BLOB_SIZE && blob.size <= MAX_BLOB_SIZE * MAX_BLOB_SIZE) {
          // Check if roughly circular (aspect ratio)
          const blobWidth = blob.maxX - blob.minX + 1;
          const blobHeight = blob.maxY - blob.minY + 1;
          const aspect = Math.max(blobWidth, blobHeight) / (Math.min(blobWidth, blobHeight) || 1);

          if (aspect < 3 && blob.size > bestSize) {
            bestSize = blob.size;
            bestBlob = blob;
          }
        }
      }
    }
  }

  if (!bestBlob) return null;

  // Centroid
  const cx = bestBlob.sumX / bestBlob.size;
  const cy = bestBlob.sumY / bestBlob.size;
  const confidence = Math.min(1, bestSize / 20); // rough confidence

  return { x: cx / width, y: cy / height, confidence };
}

function floodFill(mask, visited, startX, startY, width, height) {
  const stack = [[startX, startY]];
  let size = 0, sumX = 0, sumY = 0;
  let minX = startX, maxX = startX, minY = startY, maxY = startY;

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const idx = y * width + x;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[idx] || !mask[idx]) continue;

    visited[idx] = 1;
    size++;
    sumX += x;
    sumY += y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return { size, sumX, sumY, minX, maxX, minY, maxY };
}

/**
 * Filter detections to find the most likely ball trajectory.
 * Uses simple outlier rejection based on expected parabolic motion.
 */
export function filterTrajectory(detections) {
  if (detections.length < 3) return detections;

  // Sort by frame
  const sorted = [...detections].sort((a, b) => a.frame - b.frame);

  // Simple smoothing: remove detections that jump too far from neighbors
  const filtered = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = sorted[i];
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    const frameDiff = curr.frame - prev.frame;

    // Allow reasonable movement per frame (max ~10% of screen per frame)
    const maxMove = 0.1 * frameDiff;
    if (dx < maxMove && dy < maxMove) {
      filtered.push(curr);
    }
  }

  return filtered;
}
