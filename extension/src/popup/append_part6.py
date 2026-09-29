# Append Footer, Modal, Reduced Motion, Focus
with open('popup.css', 'a') as f:
    f.write("""
/* --- Footer --- */
.footer-nav { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-secondary); border-top: 1px solid var(--border-primary); }
#footer-status { font-family: var(--font-mono); font-size: 11px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
.footer-separator { width: 1px; height: 16px; background: var(--border-primary); margin: 0 12px; }
.footer-nav button { padding: 6px 12px; font-family: var(--font-sans); font-size: 11px; font-weight: 500; color: var(--fg-secondary); background: transparent; border: none; border-radius: var(--radius-sm); cursor: pointer; transition: color var(--transition-fast); }
.footer-nav button:hover { color: var(--accent-primary); }

/* --- Modal --- */
.modal-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); z-index: 100; animation: fadeIn 150ms ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal-container { width: 100%; max-width: 480px; max-height: 80vh; background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden; animation: slideUp 200ms ease; }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border-primary); }
.modal-header h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); }
.modal-close { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; color: var(--fg-secondary); border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition-fast); }
.modal-close:hover { background: var(--bg-tertiary); color: var(--fg-primary); }
.modal-subtitle { padding: 12px 16px; font-size: 11px; color: var(--fg-secondary); border-bottom: 1px solid var(--border-primary); }
.modal-json { max-height: 350px; overflow: auto; padding: 16px; font-family: var(--font-mono); font-size: 10px; line-height: 1.6; color: var(--fg-primary); background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); margin: 12px 16px; white-space: pre-wrap; word-break: break-word; }
.modal-footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-top: 1px solid var(--border-primary); }
.modal-badge { font-size: 10px; font-weight: 600; color: var(--accent-secondary); background: rgba(34, 211, 152, 0.1); padding: 3px 8px; border-radius: var(--radius-full); }

/* --- Reduced Motion --- */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* --- Focus Visible Polyfill --- */
:focus:not(:focus-visible) { outline: none; }
:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }""")
print("Part 6 appended - CSS complete")