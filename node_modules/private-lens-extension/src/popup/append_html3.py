with open('c:/Users/LOQ/Downloads/Python_programs/privacy-vision-browser-agent/extension/src/popup/popup.html', 'a', encoding='utf-8') as f:
    f.write("""
    <!-- Privacy Monitor -->
    <section class="privacy-section" aria-labelledby="privacy-title"><div class="section-title-row"><h2 id="privacy-title">Privacy Monitor</h2></div><div class="privacy-content" id="privacy-content" aria-live="polite">
      <div class="protection-status"><span class="status-dot protected"></span><span>Protected</span></div>
      <div class="privacy-metrics"><div class="metric-item"><div class="metric-value">0</div><div class="metric-label">PII Types</div></div><div class="metric-divider"></div><div class="metric-item"><div class="metric-value">0</div><div class="metric-label">Tokens</div></div><div class="metric-divider"></div><div class="metric-item"><div class="metric-value">0ms</div><div class="metric-label">Latency</div></div></div>
      <div class="pii-categories"><span class="pii-none">No PII detected</span></div>
      <button class="btn btn-secondary debug-toggle" id="debug-toggle" aria-expanded="false"><span>Debug Data</span><span class="btn-chevron">v</span></button>
      <div class="debug-panel" id="debug-panel" hidden><div class="debug-header"><h3>Sanitized Context</h3><span class="debug-badge">READ ONLY</span></div><p class="debug-subtitle">This is the exact data sent to the planner. PII has been tokenized.</p><pre class="json-display" id="json-display">No debug data available</pre></div>
    </div></section>

    <!-- Activity Log -->
    <section class="activity-section" aria-labelledby="activity-title"><div class="section-title-row"><h2 id="activity-title">Activity Log</h2></div><ul class="activity-list" id="activity-list" aria-live="polite" aria-label="Agent activity log"><li class="activity-item info"><span class="activity-time">--:--</span><span class="activity-message">No activity yet</span></li></ul></section>""")
print("Part 3 appended")