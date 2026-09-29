# Append Privacy Section
with open('popup.css', 'a') as f:
    f.write("""
/* --- Privacy Section --- */
.privacy-section { background: var(--bg-secondary); }
.protection-status { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; color: var(--accent-secondary); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; }
.status-dot.protected { background: var(--accent-secondary); box-shadow: 0 0 8px var(--accent-secondary); }
.status-dot.warning { background: var(--accent-warning); box-shadow: 0 0 8px var(--accent-warning); }
.privacy-metrics { display: flex; align-items: center; justify-content: space-between; margin: 16px 0; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-primary); border-radius: var(--radius-md); }
.metric-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.metric-value { font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--fg-primary); line-height: 1; }
.metric-label { font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); text-align: center; }
.metric-divider { width: 1px; height: 36px; background: var(--border-primary); }
.pii-categories { display: flex; flex-wrap: wrap; gap: 6px; min-height: 28px; }
.pii-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 10px; font-weight: 500; border-radius: var(--radius-full); background: var(--bg-tertiary); border: 1px solid var(--border-primary); }
.pii-chip.person { border-color: rgba(79, 124, 255, 0.5); }
.pii-chip.email { border-color: rgba(168, 85, 247, 0.5); }
.pii-chip.phone { border-color: rgba(245, 158, 11, 0.5); }
.pii-chip.address { border-color: rgba(34, 211, 152, 0.5); }
.pii-chip.password { border-color: rgba(239, 68, 68, 0.5); }
.pii-chip.credit_card { border-color: rgba(236, 72, 153, 0.5); }
.pii-chip.ssn { border-color: rgba(239, 68, 68, 0.5); }
.pii-chip.dob { border-color: rgba(245, 158, 11, 0.5); }
.pii-chip.ip { border-color: rgba(100, 116, 139, 0.5); }
.pii-chip.other { border-color: var(--border-secondary); }
.pii-token { font-family: var(--font-mono); font-size: 9px; font-weight: 600; color: var(--fg-secondary); }
.pii-count { color: var(--fg-muted); }
.pii-none { font-size: 11px; color: var(--fg-muted); }
.debug-toggle { width: 100%; justify-content: center; gap: 8px; margin-top: 16px; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-primary); }
.debug-toggle:hover { background: var(--bg-card); border-color: var(--border-secondary); }
.btn-chevron { display: flex; align-items: center; justify-content: center; transition: transform var(--transition-fast); }
.debug-toggle[aria-expanded="true"] .btn-chevron { transform: rotate(180deg); }
.debug-panel { margin-top: 12px; padding: 12px; background: var(--bg-input); border: 1px solid var(--border-primary); border-radius: var(--radius-md); animation: slideDown 200ms ease; }
@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.debug-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.debug-header h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); }
.debug-badge { font-size: 9px; font-weight: 600; color: var(--accent-secondary); background: rgba(34, 211, 152, 0.1); padding: 2px 6px; border-radius: var(--radius-sm); }
.debug-subtitle { font-size: 11px; color: var(--fg-secondary); margin-bottom: 10px; line-height: 1.5; }
.json-display { max-height: 200px; overflow: auto; padding: 10px; font-family: var(--font-mono); font-size: 10px; line-height: 1.6; color: var(--fg-primary); background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: var(--radius-sm); white-space: pre-wrap; word-break: break-word; }""")
print("Part 4 appended")