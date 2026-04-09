let currentHistory = [];
let loadingTimeout;

function showLoading() {
  const loadingState = document.getElementById('loading-state');
  const contentState = document.getElementById('content-state');
  if (loadingState) loadingState.classList.remove('hidden');
  if (contentState) contentState.classList.add('hidden');

  clearTimeout(loadingTimeout);
  loadingTimeout = setTimeout(() => {
    if (!loadingState.classList.contains('hidden')) {
      showErrorMessage("Verification is taking longer than expected. Please check your connection and try again.");
    }
  }, 15000);
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
    verdictEl.innerText = 'TIMEOUT';
    verdictEl.className = 'verdict-value rating-false';
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
    verdictEl.innerText = rating.toUpperCase();
    verdictEl.className = `verdict-value rating-${rating.toLowerCase().replace(/\s+/g, '_')}`;
  }

  document.getElementById('verif-confidence').innerText = `${confidence}%`;
  document.getElementById('verif-source').innerText = data.source_surface || 'Web Analysis';
  document.getElementById('verif-explanation-en').innerText = data.explanation_en || '—';
  document.getElementById('verif-explanation-tl').innerText = data.explanation_tl || '—';

  const traceSection = document.getElementById('verif-trace-section');
  if (traceSection && data.trace?.steps?.length > 0) {
    traceSection.classList.remove('hidden');
    document.getElementById('verif-trace-steps').innerHTML = data.trace.steps.map(s => `
      <div style="font-size:11px; margin-bottom:8px; padding-left:10px; border-left:2px solid var(--accent-blue)">
        <div style="color:var(--accent-blue); font-weight:bold; font-size:9px">${s.step.toUpperCase()}</div>
        <div>${s.finding}</div>
      </div>
    `).join('');
  }
}

function switchTab(tab) {
  document.getElementById('tab-checker').classList.toggle('hidden', tab !== 'checker');
  document.getElementById('tab-history').classList.toggle('hidden', tab !== 'history');
  document.getElementById('btn-checker').classList.toggle('active', tab === 'checker');
  document.getElementById('btn-history').classList.toggle('active', tab === 'history');
  if (tab === 'history') loadHistory();
}

async function loadHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  const container = document.getElementById('history-list');
  if (!history.length) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted)">No history found.</div>';
    return;
  }
  container.innerHTML = history.slice().reverse().map(item => `
    <div class="history-item">
      <div style="font-size:10px; font-weight:bold; color:var(--accent-yellow)">${(item.rating || 'CHECKED').toUpperCase()}</div>
      <div style="font-size:12px; margin:4px 0">${(item.claim || '').substring(0, 60)}...</div>
      <div style="font-size:9px; color:var(--text-muted)">${new Date(item.timestamp).toLocaleDateString()}</div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-checker').addEventListener('click', () => switchTab('checker'));
  document.getElementById('btn-history').addEventListener('click', () => switchTab('history'));
  document.getElementById('btn-dashboard').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_tab', url: 'https://verifai-rosy.vercel.app/' });
  });
  document.getElementById('verif-close').addEventListener('click', () => window.dispatchEvent(new CustomEvent('verifai:closepanel')));
  document.getElementById('btn-copy').addEventListener('click', () => {
    const text = `Verdict: ${document.getElementById('verif-verdict').innerText}\nExplanation: ${document.getElementById('verif-explanation-en').innerText}`;
    navigator.clipboard.writeText(text);
  });

  // Listen for panel updates from content script
  document.addEventListener('verifai:updatePanel', (e) => {
    const { data, error, isLoading } = e.detail;
    updatePanelUI(data, error, isLoading);
  });
});

window.updatePanelUI = updatePanelUI;
