# Append Activity Section
with open('popup.css', 'a') as f:
    f.write("""
/* --- Activity Section --- */
.activity-section { background: var(--bg-secondary); }
.activity-list { list-style: none; max-height: 200px; overflow-y: auto; padding-right: 4px; }
.activity-list::-webkit-scrollbar { width: 4px; }
.activity-list::-webkit-scrollbar-track { background: transparent; }
.activity-list::-webkit-scrollbar-thumb { background: var(--border-secondary); border-radius: 2px; }
.activity-item { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-primary); }
.activity-item:last-child { border-bottom: none; }
.activity-time { flex-shrink: 0; font-family: var(--font-mono); font-size: 10px; color: var(--fg-muted); min-width: 55px; }
.activity-message { font-size: 12px; color: var(--fg-secondary); line-height: 1.4; }
.activity-item.info .activity-message { color: var(--fg-secondary); }
.activity-item.success .activity-message { color: var(--accent-secondary); }
.activity-item.warning .activity-message { color: var(--accent-warning); }
.activity-item.error .activity-message { color: var(--accent-danger); }

/* --- Metrics Section --- */
.metrics-section { background: var(--bg-secondary); }
.metrics-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.metric-chip { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; background: var(--bg-card); border: 1px solid var(--border-primary); border-radius: var(--radius-md); transition: all var(--transition-fast); }
.metric-chip:hover { border-color: var(--border-secondary); background: var(--bg-tertiary); }
.chip-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); }
.chip-value { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--fg-primary); }
.chip-value.verified { color: var(--accent-secondary); }
.chip-value.warning { color: var(--accent-warning); }
.chip-value.safe { color: var(--accent-secondary); }
.chip-value.danger { color: var(--accent-danger); }
.chip-suffix { font-family: var(--font-mono); font-size: 11px; color: var(--fg-muted); }""")
print("Part 5 appended")