// popup.js — extracted from inline script to fix CSP blocking

function updateVerdict(verdict, confidence, source) {
  document.getElementById('verif-verdict').innerText = verdict;
  document.getElementById('verif-confidence').innerText = confidence;
  document.getElementById('verif-source').innerText = source;
}

document.getElementById('verif-close').addEventListener('click', () => {
  window.close();
});