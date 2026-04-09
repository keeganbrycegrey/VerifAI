const DASHBOARD_URL = "https://verifai-rosy.vercel.app/"

let currentHistory = []

function switchTab(tab) {
  document.getElementById('tab-checker').classList.toggle('hidden', tab !== 'checker')
  document.getElementById('tab-history').classList.toggle('hidden', tab !== 'history')
  document.getElementById('btn-checker').classList.toggle('active', tab === 'checker')
  document.getElementById('btn-history').classList.toggle('active', tab === 'history')
}

function openDashboard() {
  chrome.tabs.create({ url: DASHBOARD_URL })
}

function copyResults() {
  const verdict = document.getElementById('verif-verdict').innerText
  const confidence = document.getElementById('verif-confidence').innerText
  const explanation = document.getElementById('verif-explanation-en').innerText
  navigator.clipboard.writeText(`VerifAI Verdict: ${verdict}\nConfidence: ${confidence}\n\n${explanation}`)
}

function reportError() {
  alert("Thank you for the report. This will help us improve VerifAI.")
}

function updateVerdictColor(element, verdict) {
  const verdictLower = (verdict || 'unverified').toLowerCase().replace(/\s+/g, '_')
  element.className = `verdict-value rating-${verdictLower}`
}

function loadHistory() {
  chrome.storage.local.get('history', (data) => {
    currentHistory = data.history || []
    renderHistoryList()
  })
}

function renderHistoryList() {
  const container = document.getElementById('history-list')
  if (!container) return

  if (currentHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">No history yet.<br>Highlight text or right-click images to fact-check.</div>
      </div>
    `
    return
  }

  container.innerHTML = currentHistory.map((item, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-verdict">${(item.rating || 'UNVERIFIED').toUpperCase()}</div>
      <div class="history-claim">${(item.text || item.claim || '—').substring(0, 80)}${(item.text || item.claim || '').length > 80 ? '...' : ''}</div>
      <div class="history-meta">
        <span>${new Date(item.timestamp).toLocaleString()}</span>
        <span>${Math.round((item.confidence || 0) * 100)}%</span>
      </div>
    </div>
  `).join('')

  document.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => showDetail(parseInt(el.dataset.index)))
  })
}

function showDetail(index) {
  const item = currentHistory[index]
  if (!item) return

  const verdictEl = document.getElementById('detail-verdict')
  const verdict = (item.rating || 'UNVERIFIED').toUpperCase()
  verdictEl.innerText = verdict
  verdictEl.className = `verdict-value rating-${(item.rating || 'unverified').toLowerCase().replace(/\s+/g, '_')}`

  document.getElementById('detail-confidence').innerText = `${Math.round((item.confidence || 0) * 100)}%`
  document.getElementById('detail-timestamp').innerText = new Date(item.timestamp).toLocaleString()
  document.getElementById('detail-claim').innerText = item.text || item.claim || '—'
  document.getElementById('detail-explanation-en').innerText = item.explanation_en || '—'
  document.getElementById('detail-explanation-tl').innerText = item.explanation_tl || '—'

  document.getElementById('tab-history').classList.add('hidden')
  document.getElementById('detail-view').classList.remove('hidden')
}

function hideDetail() {
  document.getElementById('detail-view').classList.add('hidden')
  document.getElementById('tab-history').classList.remove('hidden')
}

async function loadLastVerdict() {
  try {
    const { history = [] } = await chrome.storage.local.get('history')
    if (history.length === 0) {
      document.getElementById('verif-verdict').innerText = 'No recent checks'
      document.getElementById('verif-confidence').innerText = '—'
      document.getElementById('verif-source').innerText = '—'
      document.getElementById('verif-explanation-en').innerText = 'Highlight text or right-click an image on any webpage to check it.'
      document.getElementById('verif-explanation-tl').innerText = 'I-highlight ang text o right-click ang larawan para mag-fact-check.'
      return
    }

    const last = history[0]
    const confidencePercent = Math.round((last.confidence || 0) * 100)
    const verdictEl = document.getElementById('verif-verdict')
    const verdict = (last.rating || 'UNVERIFIED').toUpperCase()

    verdictEl.innerText = verdict
    updateVerdictColor(verdictEl, last.rating)
    document.getElementById('verif-confidence').innerText = confidencePercent + '%'
    document.getElementById('verif-source').innerText = last.source || 'VerifAI Cache'
    document.getElementById('verif-explanation-en').innerText = last.explanation_en || '—'
    document.getElementById('verif-explanation-tl').innerText = last.explanation_tl || '—'
  } catch (e) {
    console.error('Failed to load verdict:', e)
  }
}

document.getElementById('verif-close').addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('verifai:closepanel'))
})

document.getElementById('btn-checker').addEventListener('click', () => switchTab('checker'))
document.getElementById('btn-history').addEventListener('click', () => {
  switchTab('history')
  loadHistory()
})
document.getElementById('btn-dashboard').addEventListener('click', openDashboard)
document.getElementById('btn-copy').addEventListener('click', copyResults)
document.getElementById('btn-report').addEventListener('click', reportError)
document.getElementById('detail-back').addEventListener('click', hideDetail)

loadLastVerdict()
