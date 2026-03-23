function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function createRecorder(stream) {
  const mimeType = getSupportedMimeType();
  const options = mimeType ? { mimeType } : {};
  const mediaRecorder = new MediaRecorder(stream, options);
  const chunks = [];

  mediaRecorder.addEventListener('dataavailable', (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });

  return {
    start() {
      chunks.length = 0;
      mediaRecorder.start(100); // collect data every 100ms
    },

    stop() {
      return new Promise((resolve) => {
        mediaRecorder.addEventListener('stop', () => {
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
          resolve(blob);
        }, { once: true });
        mediaRecorder.stop();
      });
    },

    get state() {
      return mediaRecorder.state;
    },
  };
}
