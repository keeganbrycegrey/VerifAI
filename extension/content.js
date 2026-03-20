let verifAI_panel   = null
let verifAI_popup   = null
let selectedClaim   = ''
let _lastVerdictData = null  // stores verdict so panel can access it on viewpanel event

document.addEventListener('mouseup', () => {
    const selected_text = window.getSelection().toString().trim()
    if (selected_text.length > 30) {
        selectedClaim = selected_text
        show_popup()
    }
})

function show_popup() {
    if (verifAI_popup) hide_popup()

    const selection = window.getSelection()
    if (selection.rangeCount === 0) return

    const range     = selection.getRangeAt(0)
    const rect      = range.getBoundingClientRect()
    const popupTop  = rect.bottom + window.scrollY + 10
    const popupLeft = rect.left + window.scrollX + (rect.width / 2) - 160

    const host      = document.createElement('div')
    host.id         = 'verifai-popup-root'
    host.style.cssText = `position:fixed;top:${popupTop}px;left:${Math.max(10, popupLeft)}px;z-index:2147483647;pointer-events:none`
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })

    Promise.all([
        fetch(chrome.runtime.getURL('popup.html')).then(r => r.text()),
        fetch(chrome.runtime.getURL('popup.css')).then(r => r.text()),
        fetch(chrome.runtime.getURL('popup.js')).then(r => r.text()),
    ]).then(([html, css, js]) => {
        const style           = document.createElement('style')
        style.textContent     = css
        const container       = document.createElement('div')
        container.innerHTML   = html
        const script          = document.createElement('script')
        script.textContent    = js

        shadow.appendChild(style)
        shadow.appendChild(container)
        shadow.appendChild(script)

        verifAI_popup             = shadow
        host.style.pointerEvents  = 'auto'

        underlineClaim(range)

        const previewEl = shadow.getElementById('popup-text-preview')
        if (previewEl) {
            previewEl.textContent = selectedClaim.length > 60
                ? selectedClaim.substring(0, 60) + '...'
                : selectedClaim
        }

        window.addEventListener('verifai:factcheck',     () => request_verification(selectedClaim), { once: true })
        window.addEventListener('verifai:closepopup',    () => hide_popup(), { once: true })
        window.addEventListener('verifai:trashunderline', () => { removeUnderline(); hide_popup() }, { once: true })
        window.addEventListener('verifai:viewpanel', () => {
            // use stored verdict data
            show_verdict_panel(_lastVerdictData)
            hide_popup()
        }, { once: true })
    })
}

function hide_popup() {
    if (verifAI_popup) {
        const host = document.getElementById('verifai-popup-root')
        if (host) host.remove()
        verifAI_popup = null
        selectedClaim = ''
    }
}

function underlineClaim(range) {
    const span       = document.createElement('span')
    span.className   = 'verifai-claim verifai-underlined'
    span.title       = 'VerifAI claim'
    span.onmouseenter = () => selectNode(span)
    try { range.surroundContents(span) }
    catch (e) { console.log('VerifAI: could not underline (cross-node selection)') }
    injectUnderlineStyles()
}

function selectNode(node) {
    const range = document.createRange()
    range.selectNodeContents(node)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
}

function removeUnderline() {
    const span = document.querySelector('.verifai-claim')
    if (span) {
        const parent = span.parentNode
        while (span.firstChild) parent.insertBefore(span.firstChild, span)
        parent.removeChild(span)
        removeUnderlineStyles()
    }
}

function injectUnderlineStyles() {
    if (document.getElementById('verifai-underline-styles')) return
    const style      = document.createElement('style')
    style.id         = 'verifai-underline-styles'
    style.textContent = `
        .verifai-claim { position: relative; }
        .verifai-underlined {
            text-decoration: underline #3b82f6 wavy 2px !important;
            background: rgba(59,130,246,0.1) !important;
            cursor: pointer !important;
            border-radius: 2px;
            padding: 0 2px;
        }
        .verifai-underlined:hover {
            background: rgba(59,130,246,0.25) !important;
        }
    `
    ;(document.head || document.documentElement).appendChild(style)
}

function removeUnderlineStyles() {
    const style = document.getElementById('verifai-underline-styles')
    if (style) style.remove()
}

async function request_verification(text) {
    const host = document.getElementById('verifai-popup-root')
    if (host) {
        const shadow    = host.shadowRoot
        const loadingEl = shadow.querySelector('.preview-verdict')
        if (loadingEl) loadingEl.textContent = 'Verifying...'
    }

    chrome.runtime.sendMessage({ action: "check_claim", content: text, type: "text" }, (response) => {
        if (response && response.status === "success") {
            // store verdict data for the panel
            _lastVerdictData = response.data

            const host = document.getElementById('verifai-popup-root')
            if (host) {
                const shadow = host.shadowRoot
                const popup  = shadow.querySelector('.verifai-popup')
                if (popup) {
                    popup.classList.add('expanded')

                    const rating     = (response.data.rating || 'unverified').toLowerCase().replace(/\s+/g, '_')
                    popup.classList.add('verdict-' + rating)

                    const confidence = Math.round((response.data.confidence || 0) * 100)
                    const fill       = shadow.querySelector('.bar-fill')
                    if (fill) fill.style.width = confidence + '%'

                    const verdictPreview = shadow.querySelector('.verdict-preview') || shadow.querySelector('.preview-verdict')
                    if (verdictPreview) {
                        verdictPreview.textContent = rating.toUpperCase()
                        if (response.data.explanation_en) {
                            verdictPreview.textContent += ': ' + response.data.explanation_en.substring(0, 40) + '...'
                        }
                    }
                }
            } else {
                show_verdict_panel(response.data)
            }
        } else {
            console.error("VerifAI: backend error or unreachable")
        }
    })
}

// handle context menu verdicts from background.js
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SHOW_LOADING") {
        // show panel in loading state
        show_verdict_panel(null)
    }
    if (message.type === "SHOW_VERDICT") {
        _lastVerdictData = message.verdict
        show_verdict_panel(message.verdict)
    }
    if (message.type === "SHOW_ERROR") {
        show_verdict_panel(null, message.message)
    }
})

function show_verdict_panel(data, errorMsg) {
    if (document.getElementById('verifai-root')) {
        // panel already open , just update it
        const existing = document.getElementById('verifai-root')
        update_panel_ui(existing.shadowRoot, data, errorMsg)
        return
    }

    const host          = document.createElement('div')
    host.id             = 'verifai-root'
    host.style.cssText  = 'position:fixed;top:20px;right:20px;z-index:2147483647'
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })

    Promise.all([
        fetch(chrome.runtime.getURL('panel.html')).then(r => r.text()),
        fetch(chrome.runtime.getURL('panel.css')).then(r => r.text()),
    ]).then(([html, css]) => {
        const style         = document.createElement('style')
        style.textContent   = css
        const container     = document.createElement('div')
        container.innerHTML = html

        shadow.appendChild(style)
        shadow.appendChild(container)

        // listen for close event from panel
        window.addEventListener('verifai:closepanel', () => {
            const el = document.getElementById('verifai-root')
            if (el) el.remove()
        })

        update_panel_ui(shadow, data, errorMsg)
    })
}

function update_panel_ui(shadow, data, errorMsg) {
    if (errorMsg) {
        const el = shadow.getElementById('verif-explanation-en')
        if (el) el.innerText = errorMsg
        return
    }
    if (!data) return

    const rating     = data.rating ?? 'unverified'
    const confidence = Math.round((data.confidence ?? 0) * 100)
    const sourceUrl  = (data.sources && data.sources[0]) || data.source_surface || 'VerifAI Cache'

    const verdict_el      = shadow.getElementById('verif-verdict')
    const confidence_el   = shadow.getElementById('verif-confidence')
    const source_el       = shadow.getElementById('verif-source')
    const explanation_en  = shadow.getElementById('verif-explanation-en')
    const explanation_tl  = shadow.getElementById('verif-explanation-tl')

    if (verdict_el) {
        verdict_el.innerText = rating.toUpperCase()
        verdict_el.className = `text-${rating.replace(/\s+/g, '_')}`
    }
    if (confidence_el) confidence_el.innerText = `${confidence}% Confidence`
    if (source_el)     source_el.innerText     = `Source: ${sourceUrl}`
    if (explanation_en) explanation_en.innerText = data.explanation_en || ''
    if (explanation_tl) explanation_tl.innerText = data.explanation_tl || ''

    const close_btn = shadow.getElementById('verif-close')
    if (close_btn) {
        close_btn.onclick = () => window.dispatchEvent(new CustomEvent('verifai:closepanel'))
    }
}