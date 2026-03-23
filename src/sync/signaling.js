import pako from 'pako';
import QRCode from 'qrcode';

/**
 * Generate a QR code from an SDP string.
 * Compresses the SDP with pako to fit in a QR code.
 * @param {string} sdp - SDP offer or answer string
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function generateQR(sdp) {
  // Compress SDP
  const compressed = pako.deflate(sdp);
  const base64 = btoa(String.fromCharCode(...compressed));
  const payload = `BM:${base64}`; // prefix to identify ballMeter QR codes

  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, payload, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: 'L', // low error correction = more data capacity
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return canvas;
}

/**
 * Decode a ballMeter QR payload back to an SDP string.
 * @param {string} payload - raw QR code content
 * @returns {string|null} SDP string or null if not a ballMeter QR
 */
export function decodeQRPayload(payload) {
  if (!payload.startsWith('BM:')) return null;

  try {
    const base64 = payload.slice(3);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decompressed = pako.inflate(bytes, { to: 'string' });
    return decompressed;
  } catch (e) {
    console.error('[Signaling] Failed to decode QR payload:', e);
    return null;
  }
}

/**
 * Scan a QR code using the device camera.
 * Uses BarcodeDetector API if available, otherwise falls back to continuous scanning.
 * @param {string} [containerId] - ID of container element to show camera preview in
 * @returns {Promise<string>} decoded SDP string
 */
export async function scanQR(containerId) {
  // Check for BarcodeDetector API
  const hasBarcodeDetector = 'BarcodeDetector' in window;

  if (hasBarcodeDetector) {
    return scanWithBarcodeDetector(containerId);
  }

  // Fallback: prompt user to paste the code manually
  const code = prompt(
    'QR scanning not available in this browser.\n' +
    'On the other phone, tap "Copy Code" and paste it here:'
  );
  if (code) {
    const sdp = decodeQRPayload(code);
    return sdp || code; // return raw if not encoded
  }
  throw new Error('No code provided');
}

async function scanWithBarcodeDetector(containerId) {
  const detector = new BarcodeDetector({ formats: ['qr_code'] });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
  });

  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;

  // Show preview in container if provided
  const container = containerId ? document.getElementById(containerId) : null;
  if (container) {
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    container.prepend(video);
  }

  return new Promise((resolve, reject) => {
    let scanning = true;
    const timeout = setTimeout(() => {
      scanning = false;
      cleanup();
      reject(new Error('Scan timed out after 30 seconds'));
    }, 30000);

    async function scan() {
      if (!scanning) return;

      try {
        const barcodes = await detector.detect(video);
        for (const barcode of barcodes) {
          const sdp = decodeQRPayload(barcode.rawValue);
          if (sdp) {
            scanning = false;
            cleanup();
            resolve(sdp);
            return;
          }
        }
      } catch (e) {
        // Detection can fail on some frames, just continue
      }

      if (scanning) {
        requestAnimationFrame(scan);
      }
    }

    function cleanup() {
      clearTimeout(timeout);
      stream.getTracks().forEach(t => t.stop());
      if (container && video.parentElement === container) {
        container.removeChild(video);
      }
    }

    // Start scanning after video is playing
    video.addEventListener('playing', () => scan(), { once: true });
    video.play().catch(reject);
  });
}

/**
 * Get the raw encoded payload (for copy/paste fallback).
 * @param {string} sdp
 * @returns {string}
 */
export function encodePayload(sdp) {
  const compressed = pako.deflate(sdp);
  const base64 = btoa(String.fromCharCode(...compressed));
  return `BM:${base64}`;
}
