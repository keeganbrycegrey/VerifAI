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
      document.getElementById('verif-verdict').innerText = 'No recent checks'
      document.getElementById('verif-confidence').innerText = '—'
      document.getElementById('verif-source').innerText = '—'
      document.getElementById('verif-explanation-en').innerText = 'Highlight text or right-click an image on any webpage to check it.'
      document.getElementById('verif-explanation-tl').innerText = 'I-highlight ang text o right-click ang larawan para mag-fact-check.'
      updateConfidenceBar(0)
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
    updateConfidenceBar(confidencePercent)
  } catch (e) {
    console.error('Failed to load verdict:', e)
  }
}

document.getElementById('verif-close').addEventListener('click', () => {
  window.close();
});

loadLastVerdict()
