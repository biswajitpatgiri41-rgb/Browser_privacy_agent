# Append Stage Section
with open('popup.css', 'a') as f:
    f.write("""
/* --- Stage Section --- */
.stage-section { background: var(--bg-secondary); }
.stage-content { min-height: 80px; }
.stage-placeholder { display: flex; align-items: center; justify-content: center; height: 80px; color: var(--fg-muted); font-size: 13px; }
.stage-detail { padding: 12px; background: var(--bg-card); border: 1px solid var(--border-primary); border-radius: var(--radius-md); }
.stage-detail.error { border-color: var(--accent-danger); background: rgba(239, 68, 68, 0.05); }
.stage-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
.stage-icon { flex-shrink: 0; margin-top: 1px; }
.stage-title { font-size: 13px; font-weight: 600; color: var(--fg-primary); }
.stage-description { font-size: 11px; color: var(--fg-secondary); margin-top: 2px; }
.stage-action { padding: 10px; background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-primary); }
.action-type-badge { display: inline-block; padding: 2px 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; border-radius: var(--radius-full); margin-bottom: 6px; }
.action-type-badge.click { background: rgba(79, 124, 255, 0.2); color: var(--accent-primary); }
.action-type-badge.type { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }
.action-type-badge.select { background: rgba(34, 211, 152, 0.2); color: var(--accent-secondary); }
.action-type-badge.scroll { background: rgba(245, 158, 11, 0.2); color: var(--accent-warning); }
.action-type-badge.wait { background: rgba(100, 116, 139, 0.2); color: var(--fg-muted); }
.action-type-badge.navigate { background: rgba(236, 72, 153, 0.2); color: #EC4899; }
.action-type-badge.extract { background: rgba(34, 211, 152, 0.2); color: var(--accent-secondary); }
.action-type-badge.done { background: rgba(34, 211, 152, 0.2); color: var(--accent-secondary); }
.action-reasoning { font-size: 12px; color: var(--fg-secondary); line-height: 1.5; }
.privacy-gate-detail { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-primary); }
.gate-status { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 500; }
.gate-status.verifying { background: rgba(245, 158, 11, 0.1); color: var(--accent-warning); border: 1px solid rgba(245, 158, 11, 0.3); }
.gate-status.passed { background: rgba(34, 211, 152, 0.1); color: var(--accent-secondary); border: 1px solid rgba(34, 211, 152, 0.3); }""")
print("Part 2 appended")