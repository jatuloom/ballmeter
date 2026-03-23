/**
 * Calculate launch angle from side-view camera detections.
 * Uses the initial trajectory direction (first few frames after contact).
 *
 * @param {Array<{frame, x, y}>} detections - normalized (0-1) positions from side view
 * @returns {number|null} launch angle in degrees (0 = flat, positive = upward)
 */
export function calcLaunchAngle(detections) {
  if (detections.length < 2) return null;

  // Use the first 5 detections (or fewer) to get initial trajectory
  const points = detections.slice(0, Math.min(5, detections.length));

  // Linear regression on (x, y) to get the initial direction
  // Note: y is inverted in screen coords (0 = top, 1 = bottom)
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;

  // slope is dy/dx in screen coords. Negative slope means ball going up.
  // Launch angle = atan(-slope) because screen Y is inverted
  const angleRad = Math.atan(-slope);
  const angleDeg = angleRad * (180 / Math.PI);

  // Clamp to reasonable range (-10° to 80°)
  return Math.max(-10, Math.min(80, angleDeg));
}

/**
 * Calculate spray angle from behind-view camera detections.
 * Uses horizontal component of initial trajectory.
 *
 * @param {Array<{frame, x, y}>} detections - normalized (0-1) positions from behind view
 * @returns {number|null} spray angle in degrees (-45 = pull, 0 = center, +45 = oppo)
 */
export function calcSprayAngle(detections) {
  if (detections.length < 2) return null;

  const points = detections.slice(0, Math.min(5, detections.length));

  // Look at horizontal displacement from first to last point
  const dx = points[points.length - 1].x - points[0].x;
  // Center of frame is 0.5, so offset from center
  const startX = points[0].x - 0.5;

  // Combine initial position offset with trajectory direction
  // Positive dx = ball going right (towards RF for right-handed view)
  const sprayRad = Math.atan2(dx * 2, 0.5); // scale factor for reasonable angles
  let sprayDeg = sprayRad * (180 / Math.PI);

  // Adjust based on starting position relative to center
  sprayDeg += startX * 30;

  // Clamp to -45 to +45
  return Math.max(-45, Math.min(45, sprayDeg));
}
