/**
 * WebRTC DataChannel message protocol.
 * All messages are JSON with a `type` field.
 */

export const MSG = {
  ROLE_ASSIGN: 'ROLE_ASSIGN',   // host -> camera: { role: 'side'|'behind'|'extra' }
  READY: 'READY',               // host -> cameras: prepare to record
  READY_ACK: 'READY_ACK',       // camera -> host: ready
  START_RECORD: 'START_RECORD', // host -> cameras: { ts: DOMHighResTimeStamp }
  STOP_RECORD: 'STOP_RECORD',   // host -> cameras
  VELOCITY: 'VELOCITY',         // host -> cameras: { mph: number }
  ANALYSIS_RESULT: 'ANALYSIS_RESULT', // camera -> host: { detections, cameraView }
  REQUEST_VIDEO: 'REQUEST_VIDEO',     // host -> camera
  VIDEO_CHUNK: 'VIDEO_CHUNK',         // camera -> host: binary chunks
  PING: 'PING',
  PONG: 'PONG',
};

export function encode(msg) {
  return JSON.stringify(msg);
}

export function decode(data) {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return null; }
  }
  return null;
}
