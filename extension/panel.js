let currentHistory = [];
let loadingTimeout;

function showLoading() {
  const loadingState = document.getElementById('loading-state');
  const contentState = document.getElementById('content-state');
  if (loadingState) loadingState.classList.remove('hidden');
  if (contentState) contentState.classList.add('hidden');

  clearTimeout(loadingTimeout);
  loadingTimeout = setTimeout(() => {
    if (!loadingState && !loadingState.classList.contains('hidden')) {
      showErrorMessage("Verification is taking longer than expected. Please check your connection and try again.");
    }
  }, 20000);
}

function showContent() {
  clearTimeout(loadingTimeout);
  const loadingState = document.getElementById('loading-state');
  const contentState = document.getElementById('content-state');
  if (loadingState) loadingState.classList.add('hidden');
  if (contentState) contentState.classList.remove('hidden');
}

function showErrorMessage(message) {
  showContent();
  const explanationEn = document.getElementById('verif-explanation-en');
  const explanationTl = document.getElementById('verif-explanation-tl');
  if (explanationEn) explanationEn.innerHTML = `<span style="color:#ef4444">${message}</span>`;
  if (explanationTl) explanationTl.innerHTML = "Hindi ma-proseso ang request. Pakisubukan muli.";

  const verdictEl = document.getElementById('verif-verdict');
  if (verdictEl) {
    verdictEl.innerText = 'ERROR';
    verdictEl.className = `verdict-value rating-false`;
  }
}

function updatePanelUI(data, errorMsg, isLoading) {
  if (isLoading) {
    showLoading();
    return;
  }

  if (errorMsg) {
    showErrorMessage(errorMsg);
    return;
  }

  showContent();

  const rating = data.rating ?? 'unverified';
  const confidence = Math.round((data.confidence ?? 0) * 100);

  const verdictEl = document.getElementById('verif-verdict');
  if (verdictEl) {
    verdictEl.innerText = rating.toUpperCase().replace(/_/g, ' ');
    verdictEl.className = `verdict-value rating-${rating.toLowerCase().replace(/\s+/g, '_')}`;
  }

  const confidenceEl = document.getElementById('verif-confidence');
  if (confidenceEl) confidenceEl.innerText = `${confidence}%`;

  const sourceEl = document.getElementById('verif-source');
  if (sourceEl) sourceEl.innerText = (data.sources && data.sources[0]) || data.source_surface || 'VerifAI Cache';

  const explanationEn = document.getElementById('verif-explanation-en');
  if (explanationEn) explanationEn.innerText = data.explanation_en || '—';

  const explanationTl = document.getElementById('verif-explanation-tl');
  if (explanationTl) explanationTl.innerText = data.explanation_tl || '—';

  const traceSection = document.getElementById('verif-trace-section');
  const traceSteps = document.getElementById('verif-trace-steps');
  const traceSummary = document.getElementById('verif-trace-summary');

  if (traceSection && data.trace?.steps?.length > 0) {
    traceSection.classList.remove('hidden');
    const weightClass = { high: 'weight-high', medium: 'weight-medium', low: 'weight-low' };
    if (traceSteps) {
      traceSteps.innerHTML = data.trace.steps.map(step => `
        <div class="trace-step">
          <span class="trace-icon">${step.icon || '🔹'}</span>
          <div class="trace-body">
            <div class="trace-step-name">${step.step}</div>
            <div class="trace-finding">${step.finding}</div>
          </div>
          <span class="trace-weight ${weightClass[step.weight] || 'weight-medium'}">${step.weight}</span>
        </div>
      `).join('');
    }
    if (traceSummary) traceSummary.innerText = data.trace.summary || '';
  } else if (traceSection) {
    traceSection.classList.add('hidden');
  }

  const credSection = document.getElementById('verif-cred-section');
  const credList = document.getElementById('verif-cred-list');

  if (credSection && data.source_credibility?.length > 0) {
    credSection.classList.remove('hidden');
    const scoreColor = (score) => {
      if (score >= 0.80) return '#22c55e';
      if (score >= 0.60) return '#3b82f6';
      if (score >= 0.40) return '#f97316';
      return '#ef4444';
    };

    if (credList) {
      credList.innerHTML = data.source_credibility.slice(0, 6).map(sc => `
        <div class="cred-item">
          <span class="cred-outlet">${sc.outlet}</span>
          <div class="cred-score-bar">
            <div class="cred-score-fill" style="width:${Math.round(sc.score * 100)}%;background:${scoreColor(sc.score)}"></div>
          </div>
          <span class="cred-pct">${Math.round(sc.score * 100)}%</span>
          <span class="cred-badge cred-${sc.classification}">${sc.classification.replace(/_/g, ' ')}</span>
        </div>
      `).join('');
    }
  } else if (credSection) {
    credSection.classList.add('hidden');
  }
}

function switchTab(tab) {
  const checkerTab = document.getElementById('tab-checker');
  const historyTab = document.getElementById('tab-history');
  const checkerBtn = document.getElementById('btn-checker');
  const historyBtn = document.getElementById('btn-history');

  if (tab === 'checker') {
    if (checkerTab) checkerTab.classList.remove('hidden');
    if (historyTab) historyTab.classList.add('hidden');
    if (checkerBtn) checkerBtn.classList.add('active');
    if (historyBtn) historyBtn.classList.remove('active');
  } else {
    if (checkerTab) checkerTab.classList.add('hidden');
    if (historyTab) historyTab.classList.remove('hidden');
    if (checkerBtn) checkerBtn.classList.remove('active');
    if (historyBtn) historyBtn.classList.add('active');
    loadHistory();
  }
}

async function loadHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  const container = document.getElementById('history-list');

  if (!history.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">No checks yet.<br/>Highlight text or right-click an image to start.</div>
      </div>
    `;
    return;
  }

  let html = '';
  history.forEach((entry, idx) => {
    const confidence = Math.round((entry.confidence || 0) * 100);
    const rating = (entry.rating || 'unverified').toUpperCase().replace(/_/g, ' ');
    const claimPreview = entry.claim.substring(0, 55) + (entry.claim.length > 55 ? '...' : '');

    html += `<div class="history-item" data-index="${idx}">
      <div class="history-verdict rating-${entry.rating}">${rating}</div>
      <div class="history-claim">${claimPreview}</div>
      <div class="history-meta">
        <span>${confidence}% Confidence</span>
        <span>${new Date(entry.timestamp).toLocaleDateString()}</span>
      </div>
    </div>`;
  });

  container.innerHTML = html;

  const items = container.querySelectorAll('.history-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      _showDetailView(history[idx]);
    });
  });
}

function _showDetailView(entry) {
  const tabHistory = document.getElementById('tab-history');
  const detailView = document.getElementById('detail-view');
  const detailBackBtn = document.getElementById('detail-back');
  const detailContent = document.getElementById('detail-content');

  if (!detailView) return;

  const confidence = Math.round((entry.confidence || 0) * 100);
  const rating = (entry.rating || 'unverified').toUpperCase().replace(/_/g, ' ');
  const timestamp = new Date(entry.timestamp).toLocaleString();
  let ratingClass = 'rating-unverified';
  if (entry.rating === 'true') ratingClass = 'rating-true';
  else if (entry.rating === 'false') ratingClass = 'rating-false';
  else if (entry.rating === 'misleading') ratingClass = 'rating-misleading';
  else if (entry.rating === 'needs_context') ratingClass = 'rating-needs_context';

  detailContent.innerHTML = `
    <div class="detail-row">
      <div class="detail-label">Verdict</div>
      <div class="detail-verdict ${ratingClass}">${rating}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Confidence</div>
      <div class="detail-confidence">${confidence}%</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Checked</div>
      <div class="detail-value">${timestamp}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Claim</div>
      <div class="detail-value">${entry.claim || '—'}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Explanation</div>
      <div class="detail-value">${entry.explanation_en || '—'}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Paliwanag</div>
      <div class="detail-value">${entry.explanation_tl || '—'}</div>
    </div>
  `;

  if (tabHistory) tabHistory.classList.add('hidden');
  detailView.classList.remove('hidden');

  detailBackBtn.onclick = () => {
    detailView.classList.add('hidden');
    if (tabHistory) tabHistory.classList.remove('hidden');
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const btnChecker = document.getElementById('btn-checker');
  const btnHistory = document.getElementById('btn-history');
  const btnDashboard = document.getElementById('btn-dashboard');
  const btnClose = document.getElementById('verif-close');
  const btnCopy = document.getElementById('btn-copy');
  const btnReport = document.getElementById('btn-report');

  if (btnChecker) btnChecker.addEventListener('click', () => switchTab('checker'));
  if (btnHistory) btnHistory.addEventListener('click', () => switchTab('history'));
  if (btnDashboard) {
    btnDashboard.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'open_tab', url: 'https://verifai-rosy.vercel.app/' });
    });
  }
  if (btnClose) btnClose.addEventListener('click', () => window.dispatchEvent(new CustomEvent('verifai:closepanel')));
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const v = document.getElementById('verif-verdict')?.innerText || '';
      const e = document.getElementById('verif-explanation-en')?.innerText || '';
      navigator.clipboard.writeText(`VerifAI Verdict: ${v}\n${e}`);
    });
  }
  if (btnReport) {
    btnReport.addEventListener('click', () => {
      alert("Thank you for the report. This will help us improve VerifAI.");
    });
  }
});

window.updatePanelUI = updatePanelUI;
