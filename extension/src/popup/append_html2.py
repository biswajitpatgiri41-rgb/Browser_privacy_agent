with open('c:/Users/LOQ/Downloads/Python_programs/privacy-vision-browser-agent/extension/src/popup/popup.html', 'a', encoding='utf-8') as f:
    f.write("""
    <!-- Workflow Visualization -->
    <section class="workflow-section" aria-labelledby="workflow-title">
      <div class="section-title-row"><h2 id="workflow-title">Workflow</h2><div class="flow-legend" aria-label="Stage status legend"><span class="legend-item"><span class="legend-dot idle"></span>Idle</span><span class="legend-item"><span class="legend-dot running"></span>Running</span><span class="legend-item"><span class="legend-dot success"></span>Done</span><span class="legend-item"><span class="legend-dot error"></span>Error</span></div></div>
      <div class="workflow-container" id="workflow-container">
        <div class="workflow-canvas" aria-hidden="true"><svg class="workflow-svg" viewBox="0 0 4 100" preserveAspectRatio="none"><defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 Z" fill="var(--border-primary)"/></marker></defs><path class="workflow-path" d="M2,0 L2,100" stroke="var(--border-primary)" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/></svg></div>
        <div class="workflow-nodes" id="workflow-nodes" role="list" aria-label="Workflow stages"></div>
      </div>
    </section>

    <!-- Stage Detail -->
    <section class="stage-section" aria-labelledby="stage-title"><div class="section-title-row"><h2 id="stage-title">Current Stage</h2></div><div class="stage-content" id="stage-content" aria-live="polite"><div class="stage-placeholder">Waiting for task...</div></div></section>

    <!-- Action Detail -->
    <section class="action-section" aria-labelledby="action-title"><div class="section-title-row"><h2 id="action-title">Current Action</h2></div><div class="action-content" id="action-content" aria-live="polite"><div class="action-placeholder">No action yet</div></div></section>""")
print("Part 2 appended")