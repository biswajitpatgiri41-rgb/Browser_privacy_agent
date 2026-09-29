with open('c:/Users/LOQ/Downloads/Python_programs/privacy-vision-browser-agent/extension/src/popup/popup.html', 'a', encoding='utf-8') as f:
    f.write("""
    <!-- Metrics Grid -->
    <section class="metrics-section" aria-labelledby="metrics-title"><div class="section-title-row"><h2 id="metrics-title">Metrics</h2></div><div class="metrics-grid" id="metrics-grid" role="list" aria-label="Performance metrics"><div class="metric-chip"><span class="chip-label">Steps</span><span class="chip-value">0<span class="chip-suffix">/0</span></span></div><div class="metric-chip"><span class="chip-label">Actions</span><span class="chip-value">0</span></div><div class="metric-chip"><span class="chip-label">PII Types</span><span class="chip-value safe">0</span></div><div class="metric-chip"><span class="chip-label">Tokens</span><span class="chip-value">0</span></div><div class="metric-chip"><span class="chip-label">Latency</span><span class="chip-value safe">0ms</span></div></div></section>

    <!-- Footer -->
    <footer class="footer-nav" role="navigation" aria-label="Footer navigation"><span id="footer-status">Ready</span><div class="footer-separator" aria-hidden="true"></div><button type="button">Privacy</button><button type="button">Settings</button><button type="button">Help</button></footer>

    <!-- Modal Overlay -->
    <div class="modal-overlay" id="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" hidden>
      <div class="modal-container"><header class="modal-header"><h3 id="modal-title">Debug Data</h3><button class="modal-close" id="modal-close" aria-label="Close modal"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></header><div class="modal-subtitle">Full sanitized context sent to planner</div><pre class="modal-json" id="modal-json"></pre><footer class="modal-footer"><span class="modal-badge">READ ONLY</span></footer></div>
    </div>
  </div>
  <script type="module" src="popup.ts"></script>
</body>
</html>""")
print("Part 4 appended")