import { get, set, keys, del } from 'idb-keyval';

const HITS_KEY = 'ballmeter_hits';

/**
 * Save a hit to storage.
 * Metrics go to localStorage, video blob goes to IndexedDB.
 */
export async function saveHit(hit) {
  const hitRecord = {
    id: `hit_${Date.now()}`,
    velocity: hit.velocity,
    launchAngle: hit.launchAngle,
    sprayAngle: hit.sprayAngle,
    distance: hit.distance,
    hangTime: hit.hangTime,
    apex: hit.apex,
    detections: hit.detections,
    timestamp: hit.timestamp || Date.now(),
  };

  // Save metrics to localStorage
  const hits = getHitsFromLS();
  hits.push(hitRecord);
  localStorage.setItem(HITS_KEY, JSON.stringify(hits));

  // Save video blob to IndexedDB if present
  if (hit.videoBlob) {
    await set(hitRecord.id, hit.videoBlob);
  }

  return hitRecord;
}

/**
 * Get all saved hits.
 */
export async function getAllHits() {
  return getHitsFromLS();
}

/**
 * Get a hit's video blob by ID.
 */
export async function getHitVideo(hitId) {
  return await get(hitId);
}

/**
 * Delete a hit.
 */
export async function deleteHit(hitId) {
  const hits = getHitsFromLS().filter(h => h.id !== hitId);
  localStorage.setItem(HITS_KEY, JSON.stringify(hits));
  await del(hitId);
}

/**
 * Export all hits as CSV.
 */
export async function exportCSV() {
  const hits = getHitsFromLS();
  const header = 'Date,Time,Velocity (mph),Launch Angle (°),Spray Angle (°),Distance (ft),Hang Time (s)';
  const rows = hits.map(h => {
    const d = new Date(h.timestamp);
    return [
      d.toLocaleDateString(),
      d.toLocaleTimeString(),
      h.velocity?.toFixed(1) ?? '',
      h.launchAngle?.toFixed(1) ?? '',
      h.sprayAngle?.toFixed(1) ?? '',
      h.distance ? Math.round(h.distance) : '',
      h.hangTime?.toFixed(2) ?? '',
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function getHitsFromLS() {
  try {
    return JSON.parse(localStorage.getItem(HITS_KEY)) || [];
  } catch {
    return [];
  }
}
