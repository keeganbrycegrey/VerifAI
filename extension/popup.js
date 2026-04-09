const DASHBOARD_URL = "https://verifai-rosy.vercel.app/";

function updateConfidenceBar(percentage) {
  const bar = document.getElementById('confidence-bar')
  const percentEl = document.getElementById('confidence-percent')
  if (bar && percentEl) {
    bar.style.width = `${percentage}%`
    percentEl.innerText = `${percentage}%`
  }
}

function updateVerdictColor(element, verdict) {
  const verdictLower = (verdict || 'unverified').toLowerCase().replace(/\s+/g, '_')
  element.className = `verifai-value status-${verdictLower}`
}

async function loadLastVerdict() {
  try {
    const { history = [] } = await chrome.storage.local.get('history')
    if (history.length === 0) {
      document.getElementById('verif-verdict').innerText = 'Ready'
      document.getElementById('verif-explanation-en').innerHTML = 'Ready to fact-check. Highlight text or right-click an image.'
      document.getElementById('verif-explanation-tl').innerHTML = 'Handa nang mag-verify. I-highlight ang text o i-right-click ang larawan.'
      updateConfidenceBar(0)
      return
    }

    const last = history[0]
    const confidencePercent = Math.round((last.confidence || 0) * 100)
    const verdictEl = document.getElementById('verif-verdict')

    verdictEl.innerText = (last.rating || 'UNVERIFIED').toUpperCase()
    updateVerdictColor(verdictEl, last.rating)
    document.getElementById('verif-confidence').innerHTML = `${confidencePercent}%`
    document.getElementById('verif-source').innerHTML = last.source || 'VerifAI Cache'
    document.getElementById('verif-explanation-en').innerHTML = last.explanation_en || '—'
    document.getElementById('verif-explanation-tl').innerHTML = last.explanation_tl || '—'
    updateConfidenceBar(confidencePercent)
  } catch (e) {
    console.error('Failed to load verdict:', e)
  }
}

document.getElementById('verif-close').addEventListener('click', () => {
  window.close()
})

document.getElementById('btn-dashboard').addEventListener('click', () => {
  window.open(DASHBOARD_URL, '_blank');
})

loadLastVerdict()
