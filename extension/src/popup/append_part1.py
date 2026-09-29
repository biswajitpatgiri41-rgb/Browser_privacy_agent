# Append Workflow Section
with open('popup.css', 'a') as f:
    f.write("""
/* --- Workflow Section --- */
.workflow-section { background: var(--bg-secondary); }
.flow-legend { display: flex; gap: 12px; font-size: 10px; color: var(--fg-muted); }
.legend-item { display: flex; align-items: center; gap: 5px; }
.legend-dot { width: 7px; height: 7px; border-radius: 50%; }
.legend-dot.idle { background: var(--fg-muted); }
.legend-dot.running { background: var(--accent-primary); box-shadow: 0 0 6px var(--accent-primary); }
.legend-dot.success { background: var(--accent-secondary); }
.legend-dot.error { background: var(--accent-danger); }
.workflow-container { position: relative; padding: 8px 0 16px; }
.workflow-canvas { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 4px; height: 100%; pointer-events: none; z-index: 0; }
.workflow-svg { width: 100%; height: 100%; }
.workflow-svg path.edge-future { stroke: var(--border-primary); stroke-dasharray: 4 4; }
.workflow-svg path.edge-current { stroke: var(--accent-primary); stroke-dasharray: 4 4; animation: dash 1s linear infinite; }
.workflow-svg path.edge-complete { stroke: var(--accent-secondary); }
@keyframes dash { to { stroke-dashoffset: -8; } }
.workflow-nodes { display: flex; flex-direction: column; gap: 0; position: relative; z-index: 1; }
.workflow-node { position: relative; padding: 8px 12px 8px 48px; }
.workflow-node::before { content: ''; position: absolute; left: 18px; top: 36px; bottom: 0; width: 2px; background: var(--border-primary); z-index: -1; }
.workflow-node:last-child::before { display: none; }
.workflow-node.boundary-node { padding-top: 20px; }
.boundary-divider { position: absolute; top: 0; left: 12px; right: 12px; height: 1px; background: linear-gradient(90deg, transparent, var(--accent-purple), transparent); opacity: 0.5; }
.node-card { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border-primary); border-radius: var(--radius-md); transition: all var(--transition-normal); }
.node-card.idle { border-color: var(--border-primary); }
.node-card.running { border-color: var(--accent-primary); box-shadow: var(--shadow-glow); }
.node-card.success { border-color: var(--accent-secondary); }
.node-card.warning { border-color: var(--accent-warning); }
.node-card.error, .node-card.blocked { border-color: var(--accent-danger); }
.node-card.pulse .node-icon { animation: nodePulse 1.5s ease-in-out infinite; }
@keyframes nodePulse { 0%, 100% { box-shadow: 0 0 0 0 var(--node-color); } 50% { box-shadow: 0 0 0 8px transparent; } }
.node-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--radius-sm); background: rgba(71, 85, 105, 0.15); color: var(--fg-muted); flex-shrink: 0; }
.node-card.running .node-icon { background: rgba(79, 124, 255, 0.2); color: var(--accent-primary); }
.node-card.success .node-icon { background: rgba(34, 211, 152, 0.2); color: var(--accent-secondary); }
.node-card.warning .node-icon { background: rgba(245, 158, 11, 0.2); color: var(--accent-warning); }
.node-card.error .node-icon, .node-card.blocked .node-icon { background: rgba(239, 68, 68, 0.2); color: var(--accent-danger); }
.node-info { flex: 1; min-width: 0; }
.node-label { font-size: 12px; font-weight: 600; color: var(--fg-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.node-subtitle { font-size: 10px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.node-state-indicator { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.boundary-node .node-card { border-color: var(--accent-purple); background: rgba(168, 85, 247, 0.05); }
.boundary-node .node-icon { background: rgba(168, 85, 247, 0.15); color: var(--accent-purple); }

/* Privacy Boundary */
.privacy-boundary { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; margin: 8px 12px 0; background: linear-gradient(90deg, rgba(168, 85, 247, 0.1), rgba(79, 124, 255, 0.1)); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: var(--radius-md); animation: boundaryGlow 2s ease-in-out infinite; }
@keyframes boundaryGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); } 50% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.2); } }
.boundary-label { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-purple); }
.boundary-icon { font-size: 12px; }
.boundary-status { font-family: var(--font-mono); font-size: 11px; color: var(--fg-secondary); }""")
print("Part 1 appended")