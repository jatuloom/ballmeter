import { renderHome } from './ui/screens.js';
import { renderLobby } from './ui/screens.js';
import { renderJoin } from './ui/screens.js';
import { renderRecord } from './ui/screens.js';
import { renderResults } from './ui/screens.js';
import { renderHistory } from './ui/screens.js';

const app = document.getElementById('app');

const routes = {
  '': renderHome,
  'home': renderHome,
  'lobby': renderLobby,
  'join': renderJoin,
  'record': renderRecord,
  'results': renderResults,
  'history': renderHistory,
};

// Global app state shared between screens
export const state = {
  role: null,        // 'host' | 'camera'
  cameraRole: null,  // 'side' | 'behind' | 'extra'
  peers: [],         // connected peer info
  radarConnected: false,
  lastVelocity: null,
  currentHit: null,  // { velocity, launchAngle, sprayAngle, distance, videos }
  recording: false,
  stream: null,      // active camera MediaStream
};

export function navigate(screen, params = {}) {
  state.navParams = params;
  window.location.hash = screen;
}

export function showToast(msg, duration = 2500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function route() {
  const hash = window.location.hash.replace('#', '') || 'home';
  const render = routes[hash];
  if (render) {
    app.innerHTML = '';
    render(app, state);
  }
}

window.addEventListener('hashchange', route);

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
}

route();
