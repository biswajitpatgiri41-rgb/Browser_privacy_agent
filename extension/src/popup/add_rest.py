with open('c:/Users/LOQ/Downloads/Python_programs/privacy-vision-browser-agent/extension/src/popup/popup.ts', 'r') as f:
    content = f.read()

idx = content.index('// ============================================\n// EXPORTS')

# Part 1: renderCurrentAction and renderPrivacyShield
part1 = '''

function renderCurrentAction(): void {
  const container = elements.actionContent;
  if (!container) return;

  if (!state.currentAction) {
    container.innerHTML = '<p class="placeholder">Waiting for agent action...</p>';
    return;
  }

  const action = state.currentAction;
  const metadata = action.metadata || {};

  let html = '<div class="action-card">' +
    '<div class="action-header">' +
    '<span class="action-type ' + action.type + '">' + action.type.toUpperCase() + '</span>' +
    '<span class="action-confidence">' + Math.round((metadata.confidence || 0) * 100) + '% confidence</span>' +
    '</div>' +
    '<div class="action-details">' +
    '<pre>' + JSON.stringify(action.payload, null, 2) + '</pre>' +
    '</div>' +
    '<div class="action-meta">' +
    '<span>Planner: ' + state.plannerBackend + '</span>' +
    '<span>Step: ' + state.stages.length + '</span>' +
    '</div>' +
    '</div>';

  container.innerHTML = html;
}

function renderPrivacyShield(): void {
  const dot = elements.privacyStatusDot;
  const text = elements.privacyStatusText;
  const piiEl = elements.piiCategories;
  const leakageEl = elements.leakageValue;

  if (!dot || !text) return;

  if (state.currentStage === 'privacy_detection' || state.currentStage === 'privacy_verification' || state.currentStage === 'sanitizing') {
    dot.className = 'status-dot processing';
    text.textContent = 'Analyzing...';
  } else if (state.privacyVerified) {
    dot.className = 'status-dot verified';
    text.textContent = 'Privacy verified';
  } else if (state.status === 'error') {
    dot.className = 'status-dot error';
    text.textContent = 'Privacy check failed';
  } else {
    dot.className = 'status-dot pending';
    text.textContent = 'Awaiting verification';
  }

  if (piiEl) {
    if (state.piiDetected.length > 0) {
      piiEl.innerHTML = state.piiDetected.map(pii => '<span class="pii-tag ' + pii.toLowerCase() + '">' + pii + '</span>').join(' ');
    } else {
      piiEl.innerHTML = '<span class="placeholder">No PII detected</span>';
    }
  }

  if (leakageEl) {
    leakageEl.textContent = state.privacyVerified ? '0%' : '\\u2014';
  }
}

'''

new_content = content[:idx] + part1 + content[idx:]

with open('c:/Users/LOQ/Downloads/Python_programs/privacy-vision-browser-agent/extension/src/popup/popup.ts', 'w') as f:
    f.write(new_content)

print('Part 1 done!')