let activeStream = null;

export async function startPreview(videoElement) {
  const constraints = {
    video: {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 60, min: 30 },
    },
    audio: false,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    activeStream = stream;
    return stream;
  } catch (e) {
    // Fallback to lower constraints
    const fallback = {
      video: { facingMode: 'environment' },
      audio: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(fallback);
    videoElement.srcObject = stream;
    activeStream = stream;
    return stream;
  }
}

export function stopPreview() {
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop());
    activeStream = null;
  }
}

export function getActiveStream() {
  return activeStream;
}
