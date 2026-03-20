// popup controller - minimal and expanded states
// IIFE required
(function () {
    const factCheckBtn  = document.getElementById('fact-check-btn')
    const closeBtn      = document.getElementById('popup-close')
    const trashBtn      = document.getElementById('trash-btn')
    const viewPanelBtn  = document.getElementById('view-panel-btn')
    const closeExpanded = document.getElementById('popup-close-expanded')
    const trashExpanded = document.getElementById('trash-btn-expanded')

    if (factCheckBtn)  factCheckBtn.onclick  = () => window.dispatchEvent(new CustomEvent('verifai:factcheck'))
    if (closeBtn)      closeBtn.onclick      = () => window.dispatchEvent(new CustomEvent('verifai:closepopup'))
    if (trashBtn)      trashBtn.onclick      = () => window.dispatchEvent(new CustomEvent('verifai:trashunderline'))
    if (viewPanelBtn)  viewPanelBtn.onclick  = () => window.dispatchEvent(new CustomEvent('verifai:viewpanel'))
    if (closeExpanded) closeExpanded.onclick = () => window.dispatchEvent(new CustomEvent('verifai:closepopup'))
    if (trashExpanded) trashExpanded.onclick = () => window.dispatchEvent(new CustomEvent('verifai:trashunderline'))
})()