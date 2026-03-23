export function button(text, className, onClick, icon = '') {
  const btn = document.createElement('button');
  btn.className = `btn ${className}`;
  if (icon) btn.innerHTML = `<span class="btn-icon">${icon}</span> ${text}`;
  else btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

export function metricCard(value, unit, label) {
  const card = document.createElement('div');
  card.className = 'metric-card';
  card.innerHTML = `
    <div class="metric-value">${value}<span class="metric-unit">${unit}</span></div>
    <div class="metric-label">${label}</div>
  `;
  return card;
}

export function statusDot(status) {
  const dot = document.createElement('span');
  dot.className = `status-dot ${status}`;
  return dot;
}

export function backButton(onClick) {
  const btn = document.createElement('button');
  btn.className = 'back-btn';
  btn.innerHTML = '&#8592;';
  btn.addEventListener('click', onClick);
  return btn;
}

export function fieldDiagram(sprayAngleDeg) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.innerHTML = `
    <!-- Field outline -->
    <path d="M100 180 L20 100 A113 113 0 0 1 180 100 Z" fill="none" stroke="#334155" stroke-width="1.5"/>
    <!-- Foul lines -->
    <line x1="100" y1="180" x2="20" y2="100" stroke="#475569" stroke-width="1" stroke-dasharray="4"/>
    <line x1="100" y1="180" x2="180" y2="100" stroke="#475569" stroke-width="1" stroke-dasharray="4"/>
    <!-- Center line -->
    <line x1="100" y1="180" x2="100" y2="30" stroke="#475569" stroke-width="0.5" stroke-dasharray="2"/>
    <!-- Hit direction -->
    ${sprayAngleDeg !== null ? (() => {
      const rad = ((-sprayAngleDeg + 90) * Math.PI) / 180;
      const len = 130;
      const ex = 100 + len * Math.cos(rad);
      const ey = 180 - len * Math.sin(rad);
      return `<line x1="100" y1="180" x2="${ex}" y2="${ey}" stroke="#e94560" stroke-width="3" stroke-linecap="round"/>
              <circle cx="${ex}" cy="${ey}" r="5" fill="#e94560"/>`;
    })() : ''}
    <!-- Home plate -->
    <rect x="96" y="176" width="8" height="8" fill="#f1f5f9" transform="rotate(45 100 180)"/>
    <!-- Labels -->
    <text x="8" y="95" fill="#64748b" font-size="9" font-family="sans-serif">LF</text>
    <text x="93" y="25" fill="#64748b" font-size="9" font-family="sans-serif">CF</text>
    <text x="176" y="95" fill="#64748b" font-size="9" font-family="sans-serif">RF</text>
  `;
  const container = document.createElement('div');
  container.className = 'field-diagram';
  container.appendChild(svg);
  return container;
}
