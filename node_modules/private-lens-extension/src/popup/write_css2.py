import sys

# Read the existing parts
with open('write_css.py', 'r') as f:
    content = f.read()

# Remove the last write logic
content = content.replace(
    '# Write part 1\nwith open(\'popup.css\', \'w\') as f:\n    f.write(parts[0] + parts[1] + parts[2])\nprint("Part 1 written")',
    ''
).rstrip()

# Add new parts
new_parts = '''

parts.append("""section { padding: 16px; border-bottom: 1px solid var(--border-primary); }
section:last-of-type { border-bottom: none; }
.section-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.section-title-row h2 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-muted); }
.section-kicker { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-muted); margin-bottom: 4px; }""")

parts.append("""
/* --- Agent Section --- */
.agent-section { background: var(--bg-secondary); }
.task-input-wrapper { position: relative; }
.task-input { width: 100%; min-height: 84px; padding: 12px; font-family: var(--font-sans); font-size: 13px; line-height: 1.5; color: var(--fg-primary); background: var(--bg-input); border: 1px solid var(--border-secondary); border-radius: var(--radius-md); resize: vertical; transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
.task-input::placeholder { color: var(--fg-muted); }
.task-input:focus { outline: none; border-color: var(--border-focus); box-shadow: 0 0 0 3px rgba(79,124,255,0.15); }
.task-examples { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.examples-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); margin-right: 8px; align-self: center; }
.example-chip { padding: 5px 10px; font-family: var(--font-sans); font-size: 11px; font-weight: 500; color: var(--fg-secondary); background: var(--bg-tertiary); border: 1px solid var(--border-primary); border-radius: var(--radius-full); cursor: pointer; transition: all var(--transition-fast); white-space: nowrap; }
.example-chip:hover { background: var(--bg-card); border-color: var(--border-secondary); color: var(--fg-primary); }
.example-chip:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }

.agent-controls { display: flex; gap: 10px; margin-top: 16px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; font-family: var(--font-sans); font-size: 13px; font-weight: 600; border: none; border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); white-space: nowrap; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-icon { display: flex; align-items: center; justify-content: center; }
.btn-primary { flex: 1; background: linear-gradient(135deg, var(--accent-primary), #3B6CE8); color: var(--fg-inverse); box-shadow: var(--shadow-md); }
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-lg), var(--shadow-glow); }
.btn-primary:active:not(:disabled) { transform: translateY(0); }
.btn-danger { flex: 1; background: var(--bg-tertiary); color: var(--accent-danger); border: 1px solid rgba(239,68,68,0.3); }
.btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.1); border-color: var(--accent-danger); }
.btn-secondary { background: var(--bg-tertiary); color: var(--fg-primary); border: 1px solid var(--border-secondary); }
.btn-secondary:hover { background: var(--bg-card); border-color: var(--border-secondary); }

.status-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-primary); }
.status-main { display: flex; align-items: center; gap: 10px; }
.status-indicator { width: 8px; height: 8px; border-radius: 50%; background: var(--fg-muted); transition: all var(--transition-fast); }
.status-indicator[data-state="ready"] { background: var(--fg-muted); }
.status-indicator[data-state="running"] { background: var(--accent-primary); box-shadow: 0 0 8px var(--accent-primary); animation: pulse 1.5s ease-in-out infinite; }
.status-indicator[data-state="success"] { background: var(--accent-secondary); }
.status-indicator[data-state="error"] { background: var(--accent-danger); }
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.9); } }
.status-text { font-size: 13px; font-weight: 500; color: var(--fg-primary); }
.step-counter { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 12px; color: var(--fg-muted); }
.step-current { color: var(--fg-primary); font-weight: 600; }
.step-max { color: var(--fg-muted); }
.planner-badge { display: inline-flex; align-items: center; margin-top: 10px; padding: 4px 10px; font-size: 10px; font-weight: 500; color: var(--fg-muted); background: var(--bg-tertiary); border-radius: var(--radius-full); }""")

# Write all parts
with open('popup.css', 'w') as f:
    f.write(''.join(parts))
print("All parts written")
'''

with open('write_css.py', 'w') as f:
    f.write(content + new_parts)

print("Script updated")