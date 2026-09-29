# Append Action Section
with open('popup.css', 'a') as f:
    f.write("""
/* --- Action Section --- */
.action-section { background: var(--bg-secondary); }
.action-placeholder { display: flex; align-items: center; justify-content: center; height: 72px; color: var(--fg-muted); font-size: 13px; }
.action-card { padding: 12px; background: var(--bg-card); border: 1px solid var(--border-primary); border-radius: var(--radius-md); }
.action-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.action-type { padding: 3px 10px; font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; border-radius: var(--radius-full); }
.action-type.click { background: rgba(79, 124, 255, 0.2); color: var(--accent-primary); }
.action-type.type { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }
.action-type.select { background: rgba(34, 211, 152, 0.2); color: var(--accent-secondary); }
.action-type.scroll { background: rgba(245, 158, 11, 0.2); color: var(--accent-warning); }
.action-type.wait { background: rgba(100, 116, 139, 0.2); color: var(--fg-muted); }
.action-type.navigate { background: rgba(236, 72, 153, 0.2); color: #EC4899; }
.action-type.extract { background: rgba(34, 211, 152, 0.2); color: var(--accent-secondary); }
.action-type.done { background: rgba(34, 211, 152, 0.2); color: var(--accent-secondary); }
.action-target { font-family: var(--font-mono); font-size: 11px; color: var(--fg-muted); }
.action-meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; }
.confidence { color: var(--fg-secondary); }
.validation-status { color: var(--accent-secondary); }
.action-reasoning { font-size: 12px; color: var(--fg-secondary); line-height: 1.5; }""")
print("Part 3 appended")