ts_content = """// ============================================
// UI RENDERING (Part 3)
// ============================================

function renderPrivacy(): void {
  const container = elements.privacyContent;
  if (!container) return;

  const piiChips = state.piiDetected.map(type =>
    `<span class="pii-chip ${type}"><span class="pii-token">${type.toUpperCase()}</span><span class="pii-count">1</span></span>`
  ).join('') || '<span class="pii-none">No PII detected</span>';

  container.innerHTML = `
    <div class="protection-status">
      <span class="status-dot ${state.privacyVerified ? 'protected' : 'warning'}"></span>
      <span>${state.privacyVerified ? 'Protected' : 'Verifying...'}</span>
    </div>
    <div class="privacy-metrics">
      <div class="metric-item">
        <div class="metric-value">${state.piiDetected.length}</div>
        <div class="metric-label">PII Types</div>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item">
        <div class="metric-value">${state.tokensUsed || 0}</div>
        <div class="metric-label">Tokens</div>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item">
        <div class="metric-value">${state.latencyMs || 0}ms</div>
        <div class="metric-label">Latency</div>
      </div>
    </div>
    <div class="pii-categories">${piiChips}</div>
    <button class="btn btn-secondary debug-toggle" id="debug-toggle" aria-expanded="false">
      <span>Debug Data</span>
      <span class="btn-chevron">v</span>
    </button>
    <div class="debug-panel" id="debug-panel" hidden>
      <div class="debug-header">
        <h3>Sanitized Context</h3>
        <span class="debug-badge">READ ONLY</span>
      </div>
      <p class="debug-subtitle">This is the exact data sent to the planner. PII has been tokenized.</p>
      <pre class="json-display" id="json-display">${JSON.stringify(state.debugData, null, 2) || 'No debug data available'}</pre>
    </div>
  `;

  // Re-attach debug toggle listener
  const debugToggle = document.getElementById('debug-toggle');
  const debugPanel = document.getElementById('debug-panel');
  const jsonDisplay = document.getElementById('json-display');

  if (debugToggle && debugPanel && jsonDisplay) {
    debugToggle.onclick = () => {
      const expanded = debugToggle.getAttribute('aria-expanded') === 'true';
      debugToggle.setAttribute('aria-expanded', String(!expanded));
      debugPanel.hidden = expanded;
      if (!expanded) {
        jsonDisplay.textContent = JSON.stringify(state.debugData, null, 2);
      }
    };
  }
}

function renderActivity(): void {
  const container = elements.activityList;
  if (!container) return;

  container.innerHTML = state.activityLog.map(log => `
    <li class="activity-item ${log.type}">
      <span class="activity-time">${log.time}</span>
      <span class="activity-message">${log.message}</span>
    </li>
  `).join('') || '<li class="activity-item info"><span class="activity-time">--:--</span><span class="activity-message">No activity yet</span></li>';

  // Auto-scroll
  container.scrollTop = container.scrollHeight;
}

function renderMetrics(): void {
  const container = elements.metricsGrid;
  if (!container) return;

  const metrics = [
    { label: 'Steps', value: state.stages.length, suffix: `/${WORKFLOW_NODES.length}`, class: '' },
    { label: 'Actions', value: state.actions.length, suffix: '', class: '' },
    { label: 'PII Types', value: state.piiDetected.length, suffix: '', class: state.piiDetected.length > 0 ? 'warning' : 'safe' },
    { label: 'Tokens', value: state.tokensUsed, suffix: '', class: '' },
    { label: 'Latency', value: `${state.latencyMs}ms`, suffix: '', class: state.latencyMs > 5000 ? 'warning' : 'safe' },
  ];

  container.innerHTML = metrics.map(m => `
    <div class="metric-chip">
      <span class="chip-label">${m.label}</span>
      <span class="chip-value ${m.class}">${m.value}<span class="chip-suffix">${m.suffix}</span></span>
    </div>
  `).join('');
}

function updateFooterStatus(): void {
  const statusMap = {
    idle: 'Ready',
    running: `Running: ${state.currentStage?.replace(/_/g, ' ') || 'Starting...'}`,
    success: 'Completed',
    error: `Error: ${state.error || 'Unknown'}`
  };
  elements.footerStatus.textContent = statusMap[state.status] || 'Ready';
}

function addActivity(type: 'info' | 'success' | 'warning' | 'error', message: string): void {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.activityLog.unshift({ time, type, message });
  if (state.activityLog.length > 50) state.activityLog.pop();
}

function toggleDebugPanel(): void {
  const panel = elements.debugPanel;
  const toggle = elements.debugToggle;
  const jsonDisplay = elements.jsonDisplay;

  if (!panel || !toggle || !jsonDisplay) return;

  const expanded = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!expanded));
  panel.hidden = expanded;

  if (!expanded) {
    jsonDisplay.textContent = JSON.stringify(state.debugData, null, 2);
  }
}

function openModal(title: string, json: any): void {
  const modalTitle = elements.modalOverlay.querySelector('h3');
  if (modalTitle) modalTitle.textContent = title;
  elements.modalJson.textContent = JSON.stringify(json, null, 2);
  elements.modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(): void {
  elements.modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ============================================
// EXPORTS (for testing)
// ============================================

export { state, initialState, WORKFLOW_NODES };
"""

with open('popup.ts', 'a') as f:
    f.write(ts_content)
print("Part 3 written")