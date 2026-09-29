with open('c:/Users/LOQ/Downloads/Python_programs/privacy-vision-browser-agent/extension/src/popup/popup.ts', 'r') as f:
    content = f.read()

idx = content.index('// ============================================\n// EXPORTS')

part2 = '''

function renderMetrics(): void {
  const container = elements.metricsGrid;
  if (!container) return;

  const metrics = [
    { label: 'Local Latency', value: state.localLatencyMs > 0 ? state.localLatencyMs + 'ms' : '\\u2014' },
    { label: 'Server Latency', value: state.serverLatencyMs > 0 ? state.serverLatencyMs + 'ms' : '\\u2014' },
    { label: 'Total Latency', value: state.totalLatencyMs > 0 ? state.totalLatencyMs + 'ms' : '\\u2014' },
    { label: 'Tokens Used', value: state.tokensUsed > 0 ? state.tokensUsed.toString() : '\\u2014' },
    { label: 'PII Types', value: state.piiDetected.length.toString() },
    { label: 'Steps', value: state.stages.length.toString() },
  ];

  container.innerHTML = metrics.map(m =>
    '<div class="metric-card">' +
    '<span class="metric-value">' + m.value + '</span>' +
    '<span class="metric-label">' + m.label + '</span>' +
    '</div>'
  ).join('');
}

function renderActivity(): void {
  const container = elements.activityList;
  if (!container) return;

  if (state.activityLog.length === 0) {
    container.innerHTML = '<li class="placeholder">No activity yet</li>';
    return;
  }

  container.innerHTML = state.activityLog.slice(-20).map(entry =>
    '<li class="activity-item ' + entry.type + '">' +
    '<span class="activity-time">' + entry.time + '</span>' +
    '<span class="activity-message">' + entry.message + '</span>' +
    '</li>'
  ).join('');

  container.scrollTop = container.scrollHeight;
}

function updateStatusBar(): void {
  const indicator = elements.statusIndicator;
  const text = elements.statusText;
  const stepCurrent = elements.stepCurrent;
  const stepMax = elements.stepMax;
  const plannerBadge = elements.plannerBadge;

  if (indicator) {
    indicator.className = 'status-indicator ' + state.status;
  }

  if (text) {
    const statusLabels = {
      idle: 'Ready',
      running: 'Running...',
      success: 'Completed',
      error: 'Error',
    };
    text.textContent = statusLabels[state.status];
  }

  if (stepCurrent) {
    stepCurrent.textContent = state.stages.length.toString();
  }

  if (stepMax) {
    stepMax.textContent = WORKFLOW_NODES.length.toString();
  }

  if (plannerBadge) {
    plannerBadge.textContent = state.plannerBackend;
  }
}

function updateFooterStatus(): void {
  const footer = elements.footerStatus;
  if (!footer) return;

  if (state.status === 'running') {
    footer.textContent = 'Processing: ' + (state.currentStage?.replace(/_/g, ' ') || '...');
  } else if (state.status === 'success') {
    footer.textContent = 'Task completed successfully';
  } else if (state.status === 'error') {
    footer.textContent = 'Error: ' + (state.error || 'Unknown');
  } else {
    footer.textContent = 'Ready — Enter a task to begin';
  }
}

'''

new_content = content[:idx] + part2 + content[idx:]

with open('c:/Users/LOQ/Downloads/Python_programs/privacy-vision-browser-agent/extension/src/popup/popup.ts', 'w') as f:
    f.write(new_content)

print('Part 2 done!')