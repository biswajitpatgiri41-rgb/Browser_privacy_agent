// ============================================
// PRIVATE LENS - POPUP ENTRY POINT
// ============================================

import { browserAPI } from '../shared/browser-api';
import { MESSAGE_TYPES } from '../background/message-router';
import {
  AgentStage,
  AgentProgressEvent,
  SanitizedContext,
  AgentAction,
  PIIType,
} from '../types/agent';

// ============================================
// WORKFLOW NODE DEFINITIONS
// ============================================

interface WorkflowNode {
  id: AgentStage;
  label: string;
  subtitle: string;
  icon: string;
  isBoundary?: boolean;
}

const WORKFLOW_NODES: WorkflowNode[] = [
  { id: 'task_received', label: 'USER TASK', subtitle: 'Your instruction', icon: 'M4 21h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z' },
  { id: 'observing', label: 'OBSERVE', subtitle: 'DOM + screen', icon: 'M1 12s4-8 11-8 11 8-4 8-11 8-11-8-11-8zM12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z' },
  { id: 'privacy_detection', label: 'LOCAL PRIVACY', subtitle: 'PII detection', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { id: 'sanitizing', label: 'SANITIZE', subtitle: 'Tokenize + redact', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { id: 'privacy_verification', label: 'PRIVACY GATE', subtitle: 'Leakage check', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4', isBoundary: true },
  { id: 'server_request', label: 'FASTAPI', subtitle: 'Backend', icon: 'M12 15v-1a4 4 0 0 0-4-4H5a2 2 0 0 0 0 4h3M17 10h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2v-2a2 2 0 0 0-4 0v2H5v-2a2 2 0 0 1 2-2h4a4 4 0 0 0 4-4v1a2 2 0 1 1 4 0z' },
  { id: 'planning', label: 'PLANNER', subtitle: 'Server planner', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7' },
  { id: 'action_validation', label: 'VALIDATE', subtitle: 'Policy + action', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'executing', label: 'EXECUTE', subtitle: 'Browser action', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'waiting_for_page', label: 'OBSERVE AGAIN', subtitle: 'New page state', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'complete', label: 'COMPLETE', subtitle: 'Task finished', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
];

// ============================================
// STATE MANAGEMENT
// ============================================

interface PopupState {
  task: string;
  status: 'idle' | 'running' | 'success' | 'error';
  currentStage: AgentStage | null;
  stages: AgentStage[];
  stageDetails: Map<AgentStage, string>;
  actions: AgentAction[];
  piiDetected: PIIType[];
  tokensUsed: number;
  latencyMs: number;
  privacyVerified: boolean;
  error: string | null;
  activityLog: Array<{ time: string; type: 'info' | 'success' | 'warning' | 'error'; message: string }>;
  debugData: SanitizedContext | null;
  plannerBackend: string;
  currentAction: AgentAction | null;
  localLatencyMs: number;
  serverLatencyMs: number;
  totalLatencyMs: number;
}

const initialState: PopupState = {
  task: '',
  status: 'idle',
  currentStage: null,
  stages: [],
  stageDetails: new Map(),
  actions: [],
  piiDetected: [],
  tokensUsed: 0,
  latencyMs: 0,
  privacyVerified: false,
  error: null,
  activityLog: [],
  debugData: null,
  plannerBackend: 'Server planner',
  currentAction: null,
  localLatencyMs: 0,
  serverLatencyMs: 0,
  totalLatencyMs: 0,
};

let state = { ...initialState };

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
  privacyBadge: document.getElementById('privacy-badge') as HTMLElement,
  dashboardBtn: document.getElementById('dashboard-btn') as HTMLButtonElement,
  pageTitle: document.getElementById('page-title') as HTMLElement,
  pageUrl: document.getElementById('page-url') as HTMLElement,
  taskInput: document.getElementById('task-input') as HTMLTextAreaElement,
  startBtn: document.getElementById('start-btn') as HTMLButtonElement,
  stopBtn: document.getElementById('stop-btn') as HTMLButtonElement,
  statusIndicator: document.getElementById('status-indicator') as HTMLElement,
  statusText: document.getElementById('status-text') as HTMLElement,
  stepCurrent: document.querySelector('.step-current') as HTMLElement,
  stepMax: document.querySelector('.step-max') as HTMLElement,
  plannerBadge: document.getElementById('planner-badge') as HTMLElement,
  workflowNodes: document.getElementById('workflow-nodes') as HTMLElement,
  workflowSvg: document.getElementById('workflow-svg') as unknown as SVGSVGElement,
  networkBoundary: document.getElementById('network-boundary') as HTMLElement,
  actionContent: document.getElementById('action-content') as HTMLElement,
  privacyStatusDot: document.getElementById('privacy-status-dot') as HTMLElement,
  privacyStatusText: document.getElementById('privacy-status-text') as HTMLElement,
  piiCategories: document.getElementById('pii-categories') as HTMLElement,
  leakageValue: document.getElementById('leakage-value') as HTMLElement,
  debugToggle: document.getElementById('debug-toggle') as HTMLButtonElement,
  debugPanel: document.getElementById('debug-panel') as HTMLElement,
  jsonDisplay: document.getElementById('json-display') as HTMLElement,
  metricsGrid: document.getElementById('metrics-grid') as HTMLElement,
  activityList: document.getElementById('activity-list') as HTMLElement,
  footerStatus: document.getElementById('footer-status') as HTMLElement,
  modalOverlay: document.getElementById('modal-overlay') as HTMLElement,
  modalJson: document.getElementById('modal-json') as HTMLElement,
  modalClose: document.getElementById('modal-close') as HTMLButtonElement,
};

// ============================================
// INITIALIZATION
// ============================================

function init(): void {
  bindEvents();
  requestActiveTab();
  requestAgentState();
  setupMessageListener();
  renderWorkflow();
}

function bindEvents(): void {
  elements.taskInput.addEventListener('input', () => {
    state.task = elements.taskInput.value.trim();
    updateStartButton();
  });

  elements.startBtn.addEventListener('click', handleStartAgent);
  elements.stopBtn.addEventListener('click', handleStopAgent);
  elements.dashboardBtn.addEventListener('click', openDashboard);
  elements.debugToggle.addEventListener('click', toggleDebugPanel);
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!elements.modalOverlay.hidden) closeModal();
      if (!elements.debugPanel.hidden) toggleDebugPanel();
    }
  });

  elements.taskInput.addEventListener('input', function(this: HTMLTextAreaElement) {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
}

function updateStartButton(): void {
  const hasTask = state.task.length > 0;
  elements.startBtn.disabled = !hasTask || state.status === 'running';
  elements.startBtn.setAttribute('aria-disabled', String(!hasTask || state.status === 'running'));
}

// ============================================
// MESSAGE HANDLING
// ============================================

function setupMessageListener(): void {
  browserAPI.runtime.onMessage.addListener((message: any) => {
    if (!message?.type) return;

    switch (message.type) {
      case 'AGENT_PROGRESS':
        handleAgentProgress(message);
        break;
      case 'TASK_STATUS':
        handleTaskStatus(message);
        break;
      case 'TASK_COMPLETE':
        handleTaskComplete(message);
        break;
      case 'TASK_ERROR':
        handleTaskError(message);
        break;
      case 'SANITIZED_CONTEXT_UPDATE':
        handleSanitizedContextUpdate(message);
        break;
    }
  });
}

// ============================================
// MESSAGE HANDLERS
// ============================================

function handleAgentProgress(message: any): void {
  const event = message.payload as AgentProgressEvent;
  if (!event) return;

  state.currentStage = event.stage;
  state.task = event.task;
  state.currentAction = event.currentAction ?? null;
  state.debugData = event.sanitizedContext || null;
  state.privacyVerified = event.privacyVerified ?? false;

  if (!state.stages.includes(event.stage)) {
    state.stages.push(event.stage);
  }

  if (event.step) {
    state.stages.length = Math.max(state.stages.length, event.step);
  }

  const stageLabel = event.stage.replace(/_/g, ' ');
  addActivity('info', stageLabel);

  switch (event.stage) {
    case 'privacy_detection':
      if (event.sanitizedContext) {
        state.piiDetected = extractPIITypes(event.sanitizedContext);
      }
      break;
    case 'privacy_verification':
      state.privacyVerified = event.privacyVerified ?? false;
      break;
    case 'server_request':
      state.localLatencyMs = Date.now();
      break;
    case 'planning':
      if (state.localLatencyMs) {
        state.localLatencyMs = Date.now() - state.localLatencyMs;
      }
      state.serverLatencyMs = Date.now();
      break;
    case 'action_validation':
      if (state.serverLatencyMs) {
        state.serverLatencyMs = Date.now() - state.serverLatencyMs;
      }
      break;
    case 'executing':
      state.totalLatencyMs = (state.localLatencyMs || 0) + (state.serverLatencyMs || 0);
      break;
  }

  const meta = event.currentAction?.metadata as Record<string, unknown> | undefined;
  if (meta?.planner_backend) {
    state.plannerBackend = String(meta.planner_backend);
  }

  renderAll();
}

function handleTaskStatus(message: any): void {
  const { status, step, maxSteps, task } = message.payload || {};
  state.status = status;
  state.task = task || state.task;
  if (step) elements.stepCurrent.textContent = String(step);
  if (maxSteps) elements.stepMax.textContent = String(maxSteps);
  renderAll();
}

function handleTaskComplete(message: any): void {
  const { success, error } = message.payload || {};
  state.status = success ? 'success' : 'error';
  state.error = error || null;
  state.currentStage = 'complete';
  if (!state.stages.includes('complete')) state.stages.push('complete');
  addActivity(success ? 'success' : 'error', success ? 'Task completed' : 'Error: ' + error);
  updateStartButton();
  renderAll();
}

function handleTaskError(message: any): void {
  const { error } = message.payload || {};
  state.status = 'error';
  state.error = error || 'Unknown error';
  state.currentStage = 'error';
  if (!state.stages.includes('error')) state.stages.push('error');
  addActivity('error', 'Error: ' + error);
  updateStartButton();
  renderAll();
}

function handleSanitizedContextUpdate(message: any): void {
  state.debugData = message.payload as SanitizedContext;
  renderDebugPanel();
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handleStartAgent(): Promise<void> {
  const task = elements.taskInput.value.trim();
  if (!task) return;

  state.task = task;
  state.status = 'running';
  state.currentStage = 'task_received';
  state.stages = ['task_received'];
  state.actions = [];
  state.piiDetected = [];
  state.tokensUsed = 0;
  state.latencyMs = 0;
  state.privacyVerified = false;
  state.error = null;
  state.activityLog = [];
  state.debugData = null;
  state.currentAction = null;
  state.localLatencyMs = 0;
  state.serverLatencyMs = 0;
  state.totalLatencyMs = 0;

  addActivity('info', 'Task received');
  addActivity('info', 'Page observed');

  updateStartButton();
  elements.stopBtn.disabled = false;
  renderAll();

  try {
    await browserAPI.runtime.sendMessage({
      type: 'START_TASK',
      payload: { task, sessionId: crypto.randomUUID() },
    });
  } catch (error) {
    console.error('Failed to start task:', error);
    addActivity('error', 'Failed to start: ' + (error as Error).message);
    state.status = 'error';
    state.error = (error as Error).message;
    updateStartButton();
    renderAll();
  }
}

async function handleStopAgent(): Promise<void> {
  try {
    await browserAPI.runtime.sendMessage({
      type: 'STOP_TASK',
      payload: { sessionId: getSessionId() },
    });
  } catch (error) {
    console.error('Failed to stop task:', error);
  }

  state.status = 'idle';
  state.currentStage = null;
  updateStartButton();
  elements.stopBtn.disabled = true;
  addActivity('info', 'Agent stopped by user');
  renderAll();
}

function openDashboard(): void {
  const dashboardUrl = browserAPI.runtime.getURL('dashboard.html');
  browserAPI.tabs.create({ url: dashboardUrl });
}

async function requestActiveTab(): Promise<void> {
  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      elements.pageTitle.textContent = tabs[0].title || 'Untitled';
      elements.pageUrl.textContent = new URL(tabs[0].url || '').hostname || '\u2014';
    }
  } catch {
    elements.pageTitle.textContent = 'Unable to detect';
    elements.pageUrl.textContent = '\u2014';
  }
}

async function requestAgentState(): Promise<void> {
  try {
    const response = await browserAPI.runtime.sendMessage({ type: 'GET_STATUS' });
    if (response?.status) {
      state.status = response.status.isRunning ? 'running' : 'idle';
      state.task = response.status.taskState?.task || '';
      state.currentStage = response.status.taskState?.status === 'running' ? 'executing' : null;
      elements.taskInput.value = state.task;
      updateStartButton();
      elements.stopBtn.disabled = !response.status.isRunning;
      renderAll();
    }
  } catch {
    // No active task
  }
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('privacy-vision:sessionId');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('privacy-vision:sessionId', sessionId);
  }
  return sessionId;
}
// ============================================
// RENDERING
// ============================================

function renderAll(): void {
  renderWorkflow();
  renderCurrentAction();
  renderPrivacyShield();
  renderMetrics();
  renderActivity();
  updateStatusBar();
  updateFooterStatus();
  renderDebugPanel();
}

function renderWorkflow(): void {
  const container = elements.workflowNodes;
  if (!container) return;

  container.innerHTML = '';

  WORKFLOW_NODES.forEach((node, index) => {
    const isCompleted = state.stages.includes(node.id);
    const isCurrent = state.currentStage === node.id;
    const isFuture = !isCompleted && !isCurrent;

    const wrapper = document.createElement('div');
    wrapper.className = 'workflow-node' + (isCompleted ? ' completed' : '') + (isCurrent ? ' current' : '') + (isFuture ? ' future' : '');
    wrapper.style.setProperty('--node-index', index.toString());

    if (node.isBoundary) {
      wrapper.classList.add('boundary');
    }

    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('class', 'node-icon');
    iconSvg.innerHTML = '<path d="' + node.icon + '" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'node-label';
    labelDiv.innerHTML = '<span class="node-title">' + node.label + '</span><span class="node-subtitle">' + node.subtitle + '</span>';

    wrapper.appendChild(iconSvg);
    wrapper.appendChild(labelDiv);
    container.appendChild(wrapper);
  });

  // Network boundary line
  const boundary = elements.networkBoundary;
  if (boundary) {
    const boundaryIndex = WORKFLOW_NODES.findIndex(n => n.isBoundary);
    if (boundaryIndex >= 0) {
      boundary.style.setProperty('--boundary-index', boundaryIndex.toString());
    }
  }
}




function renderCurrentAction(): void {
  const container = elements.actionContent;
  if (!container) return;

  if (!state.currentAction) {
    container.innerHTML = '<p class="placeholder">Waiting for agent action...</p>';
    return;
  }

  const action = state.currentAction;
  const metadata = action.metadata || {};
  const actionJson = JSON.stringify({ action: action.action, elementId: action.elementId, value: action.value, url: action.url, direction: action.direction, amount: action.amount, durationMs: action.durationMs, reasoning: action.reasoning }, null, 2);

  let html = '<div class="action-card">' +
    '<div class="action-header">' +
    '<span class="action-type ' + escapeHtml(action.action) + '">' + escapeHtml(action.action.toUpperCase()) + '</span>' +
    '<span class="action-confidence">' + Math.round((action.confidence || 0) * 100) + '% confidence</span>' +
    '</div>' +
    '<div class="action-details">' +
    '<pre>' + escapeHtml(actionJson) + '</pre>' +
    '</div>' +
    '<div class="action-meta">' +
    '<span>Planner: ' + escapeHtml(state.plannerBackend) + '</span>' +
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
      piiEl.innerHTML = state.piiDetected.map(pii => '<span class="pii-tag ' + escapeHtml(pii.toLowerCase()) + '">' + escapeHtml(pii) + '</span>').join(' ');
    } else {
      piiEl.innerHTML = '<span class="placeholder">No PII detected</span>';
    }
  }

  if (leakageEl) {
    leakageEl.textContent = state.privacyVerified ? '0%' : '\u2014';
  }
}



function renderMetrics(): void {
  const container = elements.metricsGrid;
  if (!container) return;

  const metrics = [
    { label: 'Local Latency', value: state.localLatencyMs > 0 ? state.localLatencyMs + 'ms' : '\u2014' },
    { label: 'Server Latency', value: state.serverLatencyMs > 0 ? state.serverLatencyMs + 'ms' : '\u2014' },
    { label: 'Total Latency', value: state.totalLatencyMs > 0 ? state.totalLatencyMs + 'ms' : '\u2014' },
    { label: 'Tokens Used', value: state.tokensUsed > 0 ? state.tokensUsed.toString() : '\u2014' },
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
    '<span class="activity-message">' + escapeHtml(entry.message) + '</span>' +
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
    footer.textContent = 'Ready � Enter a task to begin';
  }
}



function toggleDebugPanel(): void {
  const panel = elements.debugPanel;
  const toggle = elements.debugToggle;
  if (!panel || !toggle) return;

  panel.hidden = !panel.hidden;
  toggle.setAttribute('aria-expanded', String(!panel.hidden));

  if (!panel.hidden) {
    renderDebugPanel();
  }
}

function renderDebugPanel(): void {
  const display = elements.jsonDisplay;
  if (!display) return;

  const data = {
    state: {
      task: state.task,
      status: state.status,
      currentStage: state.currentStage,
      stages: state.stages,
      piiDetected: state.piiDetected,
      tokensUsed: state.tokensUsed,
      latencyMs: state.latencyMs,
      privacyVerified: state.privacyVerified,
      plannerBackend: state.plannerBackend,
    },
    debugData: state.debugData,
    currentAction: state.currentAction,
  };

  display.textContent = JSON.stringify(data, null, 2);
}

function closeModal(): void {
  const overlay = elements.modalOverlay;
  if (overlay) overlay.hidden = true;
}

function openModal(json: any): void {
  const overlay = elements.modalOverlay;
  const modalJson = elements.modalJson;
  if (!overlay || !modalJson) return;

  modalJson.textContent = JSON.stringify(json, null, 2);
  overlay.hidden = false;
}

function addActivity(type: 'info' | 'success' | 'warning' | 'error', message: string): void {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.activityLog.push({ time, type, message });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character] ?? character);
}

function extractPIITypes(context: SanitizedContext): PIIType[] {
  const types = new Set<PIIType>();
  if (context.elements) {
    context.elements.forEach(element => {
      if (element.piiRegions) {
        element.piiRegions.forEach(region => {
          types.add(region.type);
        });
      }
    });
  }
  return Array.from(types);
}

// ============================================
// EXPORTS (for testing)
// ============================================

export { state, initialState, WORKFLOW_NODES };
