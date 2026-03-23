import { navigate, showToast, state } from '../main.js';
import { button, metricCard, backButton, fieldDiagram } from './components.js';
import { startPreview, stopPreview } from '../camera/preview.js';
import { createRecorder } from '../camera/recorder.js';
import { connectRadar, disconnectRadar } from '../ble/pocketRadar.js';
import { createHost, destroyHost, createCamera } from '../sync/peer.js';
import { scanQR, generateQR } from '../sync/signaling.js';
import { analyzeHit } from '../analysis/pipeline.js';
import { getAllHits, saveHit, exportCSV } from '../data/hitStore.js';

// ─── Home Screen ────────────────────────────────────────────
export function renderHome(root) {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <h1 class="home-title">ball<span class="accent">Meter</span></h1>
    <p class="home-subtitle">Baseball hit metrics with synchronized cameras</p>
  `;

  const group = document.createElement('div');
  group.className = 'btn-group';
  group.appendChild(button('Host Session', 'btn-primary', () => {
    state.role = 'host';
    navigate('lobby');
  }, '📡'));
  group.appendChild(button('Join as Camera', 'btn-secondary', () => {
    state.role = 'camera';
    navigate('join');
  }, '📷'));
  group.appendChild(button('Hit History', 'btn-secondary', () => {
    navigate('history');
  }, '📊'));
  screen.appendChild(group);
  root.appendChild(screen);
}

// ─── Host Lobby Screen ──────────────────────────────────────
export function renderLobby(root) {
  const screen = document.createElement('div');
  screen.className = 'screen lobby';

  const header = document.createElement('div');
  header.className = 'lobby-header';
  header.innerHTML = `<h2>Host Lobby</h2>`;
  header.appendChild(button('Back', 'btn-secondary btn-small', () => {
    destroyHost();
    navigate('home');
  }));
  screen.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'lobby-grid';

  // QR panel
  const qrPanel = document.createElement('div');
  qrPanel.className = 'lobby-panel';
  qrPanel.innerHTML = `<h3>Connect Cameras</h3>`;
  const qrContainer = document.createElement('div');
  qrContainer.className = 'qr-container';
  qrContainer.id = 'host-qr';
  qrContainer.innerHTML = '<p class="text-dim" style="padding:20px;font-size:0.8rem;">Generating...</p>';
  qrPanel.appendChild(qrContainer);

  // Scan answer button
  qrPanel.appendChild(button('Scan Answer QR', 'btn-secondary btn-small', async () => {
    try {
      const answer = await scanQR();
      if (answer) {
        await state.hostConnection.acceptAnswer(answer);
        showToast('Camera connected!');
        updatePeerList();
      }
    } catch (e) {
      showToast('Scan failed: ' + e.message);
    }
  }));

  grid.appendChild(qrPanel);

  // Status panel
  const statusPanel = document.createElement('div');
  statusPanel.className = 'lobby-panel';
  statusPanel.innerHTML = `<h3>Status</h3>`;

  // Radar connection
  const radarDiv = document.createElement('div');
  radarDiv.className = 'w-full mb-16';
  const radarStatus = document.createElement('p');
  radarStatus.className = 'mb-8';
  radarStatus.id = 'radar-status';
  radarStatus.innerHTML = `<span class="status-dot disconnected"></span> Radar: Not connected`;
  radarDiv.appendChild(radarStatus);

  if (navigator.bluetooth) {
    radarDiv.appendChild(button('Connect Radar', 'btn-secondary btn-small w-full', async (e) => {
      try {
        e.target.textContent = 'Connecting...';
        await connectRadar((mph) => {
          state.lastVelocity = mph;
          state.radarConnected = true;
          radarStatus.innerHTML = `<span class="status-dot connected"></span> Radar: ${mph} mph`;
        });
        radarStatus.innerHTML = `<span class="status-dot connected"></span> Radar: Connected`;
        e.target.textContent = 'Disconnect';
      } catch (err) {
        radarStatus.innerHTML = `<span class="status-dot disconnected"></span> Radar: Failed`;
        e.target.textContent = 'Connect Radar';
        showToast('Radar: ' + err.message);
      }
    }));
  } else {
    radarDiv.innerHTML += `<p class="text-dim" style="font-size:0.8rem;">BLE not available on this browser</p>`;
  }
  statusPanel.appendChild(radarDiv);

  // Peer list
  const peerListContainer = document.createElement('div');
  peerListContainer.className = 'w-full';
  peerListContainer.innerHTML = `<h3 class="mb-8">Cameras</h3><ul class="peer-list" id="peer-list"><li class="text-dim" style="font-size:0.85rem;">No cameras connected yet</li></ul>`;
  statusPanel.appendChild(peerListContainer);

  grid.appendChild(statusPanel);
  screen.appendChild(grid);

  // Start session button
  const startBtn = button('Start Recording', 'btn-primary w-full', () => {
    navigate('record');
  }, '🎬');
  startBtn.style.marginTop = '16px';
  screen.appendChild(startBtn);

  root.appendChild(screen);

  // Initialize host connection and QR
  initHost(qrContainer);
}

async function initHost(qrContainer) {
  try {
    const host = await createHost();
    state.hostConnection = host;
    const qrCanvas = await generateQR(host.offer);
    qrContainer.innerHTML = '';
    qrContainer.appendChild(qrCanvas);
  } catch (e) {
    qrContainer.innerHTML = `<p class="text-dim" style="padding:12px;">Error: ${e.message}</p>`;
  }
}

function updatePeerList() {
  const list = document.getElementById('peer-list');
  if (!list) return;
  const peers = state.peers;
  if (peers.length === 0) {
    list.innerHTML = '<li class="text-dim" style="font-size:0.85rem;">No cameras connected yet</li>';
    return;
  }
  list.innerHTML = peers.map((p, i) => `
    <li class="peer-item">
      <span><span class="status-dot connected"></span>Camera ${i + 1}</span>
      <span class="peer-role">${p.role || 'unassigned'}</span>
    </li>
  `).join('');
}

// ─── Camera Join Screen ─────────────────────────────────────
export function renderJoin(root) {
  const screen = document.createElement('div');
  screen.className = 'screen join-screen';

  screen.appendChild(backButton(() => navigate('home')));

  screen.innerHTML += `
    <h2>Join as Camera</h2>
    <p class="text-dim mb-16">Scan the QR code on the host phone</p>
  `;

  const scannerBox = document.createElement('div');
  scannerBox.className = 'scanner-box';
  scannerBox.id = 'scanner-box';
  scannerBox.innerHTML = '<div class="scanner-guide"></div>';
  screen.appendChild(scannerBox);

  const statusText = document.createElement('p');
  statusText.className = 'text-dim';
  statusText.id = 'join-status';
  statusText.textContent = 'Starting camera...';
  screen.appendChild(statusText);

  // Answer QR display area (initially hidden)
  const answerArea = document.createElement('div');
  answerArea.id = 'answer-area';
  answerArea.className = 'hidden';
  answerArea.innerHTML = `
    <p class="text-dim mb-8">Show this QR to the host phone:</p>
    <div class="qr-container" id="answer-qr"></div>
  `;
  screen.appendChild(answerArea);

  screen.appendChild(button('Enter Code Manually', 'btn-secondary btn-small', () => {
    const code = prompt('Paste the host connection code:');
    if (code) handleJoinOffer(code);
  }));

  root.appendChild(screen);
  startJoinScanner();
}

async function startJoinScanner() {
  const statusEl = document.getElementById('join-status');
  try {
    statusEl.textContent = 'Scanning for host QR...';
    const offer = await scanQR('scanner-box');
    if (offer) {
      statusEl.textContent = 'Host found! Generating response...';
      await handleJoinOffer(offer);
    }
  } catch (e) {
    statusEl.textContent = 'Scanner error: ' + e.message;
  }
}

async function handleJoinOffer(offer) {
  const statusEl = document.getElementById('join-status');
  const answerArea = document.getElementById('answer-area');
  try {
    const cam = await createCamera(offer);
    state.cameraConnection = cam;

    // Show answer QR
    const qrCanvas = await generateQR(cam.answer);
    const answerQR = document.getElementById('answer-qr');
    answerQR.innerHTML = '';
    answerQR.appendChild(qrCanvas);
    answerArea.classList.remove('hidden');
    statusEl.textContent = 'Show the QR above to the host, then wait...';

    // Wait for datachannel to open
    cam.onConnected = () => {
      statusEl.textContent = 'Connected! Waiting for host to start...';
      showToast('Connected to host!');
    };

    cam.onMessage = (msg) => {
      if (msg.type === 'ROLE_ASSIGN') {
        state.cameraRole = msg.role;
        statusEl.textContent = `Role: ${msg.role} view camera. Waiting for recording...`;
      }
      if (msg.type === 'START_RECORD') {
        navigate('record');
      }
    };
  } catch (e) {
    statusEl.textContent = 'Connection failed: ' + e.message;
  }
}

// ─── Recording Screen ───────────────────────────────────────
export function renderRecord(root) {
  const screen = document.createElement('div');
  screen.className = 'screen record-screen';

  const video = document.createElement('video');
  video.className = 'camera-view';
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  screen.appendChild(video);

  // Recording border indicator
  const recBorder = document.createElement('div');
  recBorder.className = 'recording-border hidden';
  recBorder.id = 'rec-border';
  screen.appendChild(recBorder);

  // Timer
  const timer = document.createElement('div');
  timer.className = 'record-timer hidden';
  timer.id = 'rec-timer';
  timer.textContent = '0:00';
  screen.appendChild(timer);

  // Velocity badge
  const veloBadge = document.createElement('div');
  veloBadge.className = 'velocity-badge hidden';
  veloBadge.id = 'velo-badge';
  screen.appendChild(veloBadge);

  // Countdown overlay
  const countdown = document.createElement('div');
  countdown.className = 'countdown-overlay hidden';
  countdown.id = 'countdown';
  screen.appendChild(countdown);

  // Controls overlay
  const overlay = document.createElement('div');
  overlay.className = 'record-overlay';

  if (state.role === 'host') {
    overlay.appendChild(backButton(() => {
      stopRecordingSession();
      navigate('lobby');
    }));

    const recBtn = document.createElement('button');
    recBtn.className = 'record-btn';
    recBtn.id = 'rec-btn';
    recBtn.addEventListener('click', () => toggleRecording(video, recBtn));
    overlay.appendChild(recBtn);
  } else {
    // Camera role - just shows status
    const statusText = document.createElement('p');
    statusText.className = 'text-center';
    statusText.textContent = `${state.cameraRole || 'Camera'} view — waiting for host`;
    statusText.id = 'cam-status';
    overlay.appendChild(statusText);
  }

  screen.appendChild(overlay);
  root.appendChild(screen);

  // Start camera
  startPreview(video).then((stream) => {
    state.stream = stream;
  });
}

let recorder = null;
let timerInterval = null;
let recordStartTime = 0;

async function toggleRecording(videoEl, recBtn) {
  if (!state.recording) {
    // Start countdown
    await showCountdown();

    // Start recording
    state.recording = true;
    recBtn.classList.add('recording');
    document.getElementById('rec-border').classList.remove('hidden');
    document.getElementById('rec-timer').classList.remove('hidden');

    recorder = createRecorder(state.stream);
    recorder.start();
    recordStartTime = Date.now();

    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = String(elapsed % 60).padStart(2, '0');
      document.getElementById('rec-timer').textContent = `${min}:${sec}`;
    }, 200);

    // Notify connected cameras to start
    if (state.hostConnection) {
      state.hostConnection.broadcast({ type: 'START_RECORD', ts: performance.now() });
    }

    // Listen for radar velocity
    if (state.lastVelocity) {
      const badge = document.getElementById('velo-badge');
      badge.textContent = `${state.lastVelocity} mph`;
      badge.classList.remove('hidden');
    }
  } else {
    // Stop recording
    state.recording = false;
    recBtn.classList.remove('recording');
    document.getElementById('rec-border').classList.add('hidden');
    document.getElementById('rec-timer').classList.add('hidden');
    clearInterval(timerInterval);

    if (state.hostConnection) {
      state.hostConnection.broadcast({ type: 'STOP_RECORD' });
    }

    const blob = await recorder.stop();

    // Prompt for velocity if not from radar
    let velocity = state.lastVelocity;
    if (!velocity) {
      const input = prompt('Enter exit velocity (mph):');
      velocity = parseFloat(input);
      if (isNaN(velocity)) velocity = null;
    }

    // Analyze
    showAnalyzing(true);
    try {
      const result = await analyzeHit(blob, velocity, state.cameraRole || 'side');
      state.currentHit = result;
      showAnalyzing(false);
      navigate('results');
    } catch (e) {
      showAnalyzing(false);
      showToast('Analysis error: ' + e.message);
      state.currentHit = {
        velocity,
        launchAngle: null,
        sprayAngle: null,
        distance: null,
        videoBlob: blob,
        timestamp: Date.now(),
      };
      navigate('results');
    }
  }
}

function showCountdown() {
  return new Promise((resolve) => {
    const el = document.getElementById('countdown');
    el.classList.remove('hidden');
    let count = 3;
    el.textContent = count;
    const iv = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(iv);
        el.classList.add('hidden');
        resolve();
      } else {
        el.textContent = count;
      }
    }, 800);
  });
}

function stopRecordingSession() {
  if (recorder && state.recording) {
    recorder.stop();
  }
  state.recording = false;
  clearInterval(timerInterval);
  stopPreview();
}

function showAnalyzing(show) {
  let el = document.querySelector('.analyzing-overlay');
  if (show && !el) {
    el = document.createElement('div');
    el.className = 'analyzing-overlay';
    el.innerHTML = `<div class="spinner"></div><p>Analyzing hit...</p>`;
    document.body.appendChild(el);
  } else if (!show && el) {
    el.remove();
  }
}

// ─── Results Screen ─────────────────────────────────────────
export function renderResults(root) {
  const screen = document.createElement('div');
  screen.className = 'screen results';

  const hit = state.currentHit || {};

  screen.innerHTML = `<h2>Hit Analysis</h2>`;

  const grid = document.createElement('div');
  grid.className = 'metrics-grid';
  grid.appendChild(metricCard(
    hit.velocity != null ? hit.velocity.toFixed(1) : '--',
    ' mph', 'Exit Velocity'
  ));
  grid.appendChild(metricCard(
    hit.launchAngle != null ? hit.launchAngle.toFixed(1) : '--',
    '°', 'Launch Angle'
  ));
  grid.appendChild(metricCard(
    hit.distance != null ? Math.round(hit.distance) : '--',
    ' ft', 'Est. Distance'
  ));
  screen.appendChild(grid);

  // Field diagram
  screen.appendChild(fieldDiagram(hit.sprayAngle || null));

  // Video replay
  if (hit.videoBlob) {
    const videoWrap = document.createElement('div');
    videoWrap.className = 'w-full';
    const vid = document.createElement('video');
    vid.src = URL.createObjectURL(hit.videoBlob);
    vid.controls = true;
    vid.playsInline = true;
    vid.style.cssText = 'width:100%;max-height:200px;border-radius:8px;background:#000;';
    videoWrap.appendChild(vid);
    screen.appendChild(videoWrap);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'results-actions';
  actions.appendChild(button('Save Hit', 'btn-primary', async () => {
    await saveHit(hit);
    showToast('Hit saved!');
  }));
  actions.appendChild(button('Next Hit', 'btn-secondary', () => {
    state.currentHit = null;
    state.lastVelocity = null;
    navigate('record');
  }));
  actions.appendChild(button('Done', 'btn-secondary', () => {
    stopPreview();
    navigate('home');
  }));
  screen.appendChild(actions);

  root.appendChild(screen);
}

// ─── History Screen ─────────────────────────────────────────
export async function renderHistory(root) {
  const screen = document.createElement('div');
  screen.className = 'screen history';

  const header = document.createElement('div');
  header.className = 'history-header';
  header.innerHTML = `<h2>Hit History</h2>`;
  const headerBtns = document.createElement('div');
  headerBtns.className = 'flex gap-8';
  headerBtns.appendChild(button('Export CSV', 'btn-secondary btn-small', async () => {
    const csv = await exportCSV();
    await navigator.clipboard.writeText(csv);
    showToast('CSV copied to clipboard!');
  }));
  headerBtns.appendChild(button('Back', 'btn-secondary btn-small', () => navigate('home')));
  header.appendChild(headerBtns);
  screen.appendChild(header);

  const hits = await getAllHits();
  const list = document.createElement('div');
  list.className = 'hit-list';

  if (hits.length === 0) {
    list.innerHTML = '<p class="text-dim text-center" style="margin-top:40px;">No hits recorded yet. Start a session to begin tracking!</p>';
  } else {
    hits.reverse().forEach((h) => {
      const item = document.createElement('div');
      item.className = 'hit-item';
      const date = new Date(h.timestamp);
      item.innerHTML = `
        <div>
          <div class="hit-date">${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="hit-stat">
          <div class="hit-stat-value">${h.velocity != null ? h.velocity.toFixed(1) : '--'}</div>
          <div class="hit-stat-label">MPH</div>
        </div>
        <div class="hit-stat">
          <div class="hit-stat-value">${h.launchAngle != null ? h.launchAngle.toFixed(1) + '°' : '--'}</div>
          <div class="hit-stat-label">Launch</div>
        </div>
        <div class="hit-stat">
          <div class="hit-stat-value">${h.distance != null ? Math.round(h.distance) : '--'}</div>
          <div class="hit-stat-label">Feet</div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  screen.appendChild(list);
  root.appendChild(screen);
}
