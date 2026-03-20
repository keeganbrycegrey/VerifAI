// panel.js — moved out of inline script to fix CSP blocking on news sites
// replace YOUR_VERCEL_URL with your actual Vercel dashboard URL

const DASHBOARD_URL = "https://YOUR_VERCEL_URL.vercel.app"

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
  const v = document.getElementById('verif-verdict').innerText
  const e = document.getElementById('verif-explanation-en').innerText
  navigator.clipboard.writeText(`VerifAI Verdict: ${v}\n${e}`)
}

function reportError() {
  alert("Thank you for the report. This will help us improve VerifAI.")
}

document.getElementById('verif-close').addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('verifai:closepanel'))
})
