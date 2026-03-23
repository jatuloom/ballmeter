import { detectBall, filterTrajectory } from './ballDetector.js';
import { calcLaunchAngle, calcSprayAngle } from './angleCalc.js';
import { estimateDistance } from './physics.js';

/**
 * Full analysis pipeline for a single hit.
 * @param {Blob} videoBlob - recorded video from camera
 * @param {number|null} velocityMph - exit velocity from radar or manual entry
 * @param {string} cameraView - 'side' | 'behind' | 'extra'
 * @returns {Promise<Object>} hit metrics
 */
export async function analyzeHit(videoBlob, velocityMph, cameraView = 'side') {
  // Step 1: Detect ball positions
  const rawDetections = await detectBall(videoBlob);
  const detections = filterTrajectory(rawDetections);

  // Step 2: Calculate angles based on camera view
  let launchAngle = null;
  let sprayAngle = null;

  if (cameraView === 'side') {
    launchAngle = calcLaunchAngle(detections);
  } else if (cameraView === 'behind') {
    sprayAngle = calcSprayAngle(detections);
  }

  // Step 3: Estimate distance if we have velocity and launch angle
  let distance = null;
  let hangTime = null;
  let apex = null;

  if (velocityMph && launchAngle != null) {
    const result = estimateDistance(velocityMph, launchAngle);
    distance = result.distanceFt;
    hangTime = result.hangTimeSec;
    apex = result.apexFt;
  }

  return {
    velocity: velocityMph,
    launchAngle,
    sprayAngle,
    distance,
    hangTime,
    apex,
    detections: detections.length,
    videoBlob,
    timestamp: Date.now(),
  };
}

/**
 * Merge results from multiple camera views.
 * @param {Object} sideResult - analysis from side-view camera
 * @param {Object} behindResult - analysis from behind-view camera
 * @returns {Object} combined hit metrics
 */
export function mergeResults(sideResult, behindResult) {
  const velocity = sideResult?.velocity || behindResult?.velocity;
  const launchAngle = sideResult?.launchAngle ?? null;
  const sprayAngle = behindResult?.sprayAngle ?? null;

  let distance = null;
  let hangTime = null;
  let apex = null;

  if (velocity && launchAngle != null) {
    const result = estimateDistance(velocity, launchAngle);
    distance = result.distanceFt;
    hangTime = result.hangTimeSec;
    apex = result.apexFt;
  }

  return {
    velocity,
    launchAngle,
    sprayAngle,
    distance,
    hangTime,
    apex,
    timestamp: Date.now(),
    videoBlob: sideResult?.videoBlob || behindResult?.videoBlob,
  };
}
