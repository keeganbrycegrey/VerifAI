let verifAI_panel = null
let verifAI_popup = null
let selectedClaim = ''
let _lastVerdictData = null
let _panelReady = false

const DASHBOARD_URL = "https://verifai-rosy.vercel.app/"
const MIN_CHAR_COUNT = 20

// Do not auto-show the popup on selection. Use the right-click context menu to verify text.
function show_popup() {
    if (verifAI_popup) hide_popup()

    const selection = window.getSelection()
    if (selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const popupTop = rect.bottom + window.scrollY + 10
    const popupLeft = rect.left + window.scrollX + (rect.width / 2) - 160

    const host = document.createElement('div')
    host.id = 'verifai-popup-root'
    host.style.cssText = `position:fixed;top:${popupTop}px;left:${Math.max(10, popupLeft)}px;z-index:2147483647;pointer-events:none`
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })

    Promise.all([
        fetch(chrome.runtime.getURL('popup.html')).then(r => r.text()),
        fetch(chrome.runtime.getURL('popup.css')).then(r => r.text()),
    ]).then(([html, css]) => {
        const style = document.createElement('style')
        style.textContent = css
        const container = document.createElement('div')
        container.innerHTML = html

        shadow.appendChild(style)
        shadow.appendChild(container)

        verifAI_popup = shadow
        host.style.pointerEvents = 'auto'

        underlineClaim(range)

        const previewEl = shadow.getElementById('popup-text-preview')
        if (previewEl) {
            previewEl.textContent = selectedClaim.length > 60
                ? selectedClaim.substring(0, 60) + '...'
                : selectedClaim
        }

        const closeBtn = shadow.getElementById('verif-close')
        if (closeBtn) closeBtn.onclick = () => hide_popup()

        window.addEventListener('verifai:factcheck', () => request_verification(selectedClaim), { once: true })
        window.addEventListener('verifai:closepopup', () => hide_popup(), { once: true })
        window.addEventListener('verifai:trashunderline', () => { removeUnderline(); hide_popup() }, { once: true })
        window.addEventListener('verifai:viewpanel', () => {
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
    const span = document.createElement('span')
    span.className = 'verifai-claim verifai-underlined'
    span.title = 'VerifAI claim'
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
    const style = document.createElement('style')
    style.id = 'verifai-underline-styles'
    style.textContent = `
        .verifai-claim {
            position: relative;
        }
        .verifai-underlined {
            text-decoration: underline 3b82f6 wavy 2px;
            cursor: pointer;
            border-radius: 1px;
        }
        .verifai-underlined:hover {
            text-decoration: underline 1d4ed8 dashed 2px;
        }
    `
        ; (document.head || document.documentElement).appendChild(style)
}

function removeUnderlineStyles() {
    const style = document.getElementById('verifai-underline-styles')
    if (style) style.remove()
}

async function request_verification(text) {
    const host = document.getElementById('verifai-popup-root')
    if (host) {
        const shadow = host.shadowRoot
        const loadingEl = shadow.querySelector('.preview-verdict')
        if (loadingEl) loadingEl.textContent = 'Verifying...'
    }

    try {
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Verification request timed out'))
            }, 30000) // 30 second timeout

            chrome.runtime.sendMessage(
                { action: "check_claim", content: text, type: "text" },
                (response) => {
                    clearTimeout(timeout)

                    if (chrome.runtime.lastError) {
                        console.error("VerifAI: Extension error -", chrome.runtime.lastError.message)
                        reject(new Error(chrome.runtime.lastError.message))
                        return
                    }

                    if (!response) {
                        console.error("VerifAI: Empty response from background")
                        reject(new Error("No response from verification service"))
                        return
                    }

                    resolve(response)
                }
            )
        })

        if (response.status === "success") {
            _lastVerdictData = response.data

            const host = document.getElementById('verifai-popup-root')
            if (host) {
                const shadow = host.shadowRoot
                const popup = shadow.querySelector('.verifai-popup')
                if (popup) {
                    popup.classList.add('expanded')

                    const rating = (response.data.rating || 'unverified').toLowerCase().replace(/\s+/g, '_')
                    popup.classList.add('verdict-' + rating)

                    const confidence = Math.round((response.data.confidence || 0) * 100)
                    const fill = shadow.querySelector('.bar-fill')
                    if (fill) fill.style.width = confidence + '%'

                    const verdictPreview = shadow.querySelector('.verdict-preview') || shadow.querySelector('.preview-verdict')
                    if (verdictPreview) {
                        verdictPreview.textContent = rating.toUpperCase()
                        if (response.data.explanation_en) {
                            verdictPreview.textContent += ': ' + response.data.explanation_en.substring(0, 40) + '...'
                        }
                    }
                }
                show_verdict_panel(response.data)
            } else {
                show_verdict_panel(response.data)
            }
        } else {
            throw new Error(response.message || "Verification failed")
        }
    } catch (err) {
        console.error("VerifAI: Verification error -", err.message)
        const host = document.getElementById('verifai-popup-root')
        if (host) {
            const shadow = host.shadowRoot
            const verdictPreview = shadow.querySelector('.verdict-preview') || shadow.querySelector('.preview-verdict')
            if (verdictPreview) {
                verdictPreview.textContent = 'ERROR: ' + err.message
            }
        } else {
            show_verdict_panel(null, `Verification failed: ${err.message}`)
        }
    }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SHOW_LOADING") {
        show_verdict_panel(null, null, true)
    }
    if (message.type === "SHOW_VERDICT") {
        _lastVerdictData = message.verdict
        const existing = document.getElementById('verifai-root')
        if (existing && _panelReady) {
            update_panel_ui(existing.shadowRoot, message.verdict)
        } else if (existing && !_panelReady) {
            _pendingVerdict = { data: message.verdict, errorMsg: null }
        } else {
            show_verdict_panel(message.verdict)
        }
    }
    if (message.type === "SHOW_ERROR") {
        const existing = document.getElementById('verifai-root')
        if (existing && _panelReady) {
            update_panel_ui(existing.shadowRoot, null, message.message)
        } else if (existing && !_panelReady) {
            _pendingVerdict = { data: null, errorMsg: message.message }
        } else {
            show_verdict_panel(null, message.message)
        }
    }
})

let _pendingVerdict = null

function show_verdict_panel(data, errorMsg, isLoading = false) {
    if (document.getElementById('verifai-root') && _panelReady) {
        const existing = document.getElementById('verifai-root')
        if (isLoading) {
            update_panel_ui(existing.shadowRoot, null, null, true)
        } else {
            update_panel_ui(existing.shadowRoot, data, errorMsg)
        }
        return
    }

    if (document.getElementById('verifai-root') && !_panelReady) {
        if (!isLoading && (data !== null || errorMsg)) {
            _pendingVerdict = { data, errorMsg }
        }
        return
    }

    _panelReady = false
    _pendingVerdict = (!isLoading && (data !== null || errorMsg)) ? { data, errorMsg } : null

    const host = document.createElement('div')
    host.id = 'verifai-root'
    host.style.cssText = 'position:fixed;top:20px;right:20px;width:420px;height:100%;max-height:85vh;display:flex;flex-direction:column;z-index:2147483647;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3)'
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })

    Promise.all([
        fetch(chrome.runtime.getURL('panel.html')).then(r => r.text()),
        fetch(chrome.runtime.getURL('panel.css')).then(r => r.text()),
    ])
        .then(([html, css]) => {
            const style = document.createElement('style')
            style.textContent = css
            const container = document.createElement('div')
            container.innerHTML = html

            shadow.appendChild(style)
            shadow.appendChild(container)

            const closeBtn = shadow.querySelector('#verif-close')
            if (closeBtn) {
                closeBtn.onclick = () => {
                    const el = document.getElementById('verifai-root')
                    if (el) el.remove()
                    _panelReady = false
                }
            }

            const checkerBtn = shadow.querySelector('#btn-checker')
            const historyBtn = shadow.querySelector('#btn-history')
            if (checkerBtn) checkerBtn.onclick = () => _switchTab(shadow, 'checker')
            if (historyBtn) historyBtn.onclick = () => _switchTab(shadow, 'history')

            const copyBtn = shadow.querySelector('#btn-copy')
            if (copyBtn) copyBtn.onclick = () => _copyResults(shadow)

            const dashBtn = shadow.querySelector('#btn-dashboard')
            if (dashBtn) dashBtn.onclick = () => chrome.runtime.sendMessage({ action: 'open_tab', url: DASHBOARD_URL })

            const reportBtn = shadow.querySelector('#btn-report')
            if (reportBtn) reportBtn.onclick = () => alert("Thank you for the report. This will help us improve VerifAI.")

            window.addEventListener('verifai:closepanel', () => {
                const el = document.getElementById('verifai-root')
                if (el) el.remove()
                _panelReady = false
            })

            _panelReady = true
            console.log('[VerifAI] Panel ready')

            if (_pendingVerdict) {
                update_panel_ui(shadow, _pendingVerdict.data, _pendingVerdict.errorMsg)
                _pendingVerdict = null
            } else if (isLoading) {
                update_panel_ui(shadow, null, null, true)
            } else if (data !== null) {
                update_panel_ui(shadow, data, errorMsg)
            }
        })
        .catch(err => {
            console.error('[VerifAI] Panel loading error:', err)
            _panelReady = true
            const el = document.getElementById('verifai-root')
            if (el) {
                const shadow = el.shadowRoot
                if (shadow) {
                    shadow.innerHTML = `<div style="padding:20px;background:#0d1117;color:#ef4444;font-family:monospace">Failed to load panel: ${err.message}</div>`
                }
            }
        })
}

function _switchTab(shadow, tab) {
    const checkerTab = shadow.querySelector('#tab-checker')
    const historyTab = shadow.querySelector('#tab-history')
    const checkerBtn = shadow.querySelector('#btn-checker')
    const historyBtn = shadow.querySelector('#btn-history')

    if (tab === 'checker') {
        if (checkerTab) checkerTab.classList.remove('hidden')
        if (historyTab) historyTab.classList.add('hidden')
        if (checkerBtn) checkerBtn.classList.add('active')
        if (historyBtn) historyBtn.classList.remove('active')
    } else {
        if (checkerTab) checkerTab.classList.add('hidden')
        if (historyTab) historyTab.classList.remove('hidden')
        if (checkerBtn) checkerBtn.classList.remove('active')
        if (historyBtn) historyBtn.classList.add('active')
        _loadHistoryTab(shadow)
    }
}

function _copyResults(shadow) {
    const v = shadow.querySelector('#verif-verdict').innerText
    const e = shadow.querySelector('#verif-explanation-en').innerText
    navigator.clipboard.writeText(`VerifAI Verdict: ${v}\n${e}`)
}

async function _loadHistoryTab(shadow) {
    const historyListEl = shadow.querySelector('#history-list')

    if (!historyListEl) return

    try {
        const { history = [] } = await chrome.storage.local.get('history')

        if (history.length === 0) {
            historyListEl.innerHTML = `<div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">No checks yet.<br/>Highlight text or right-click an image to start.</div>
            </div>`
            return
        }

        let html = ''
        history.forEach((entry, idx) => {
            const confidence = Math.round((entry.confidence || 0) * 100)
            const rating = (entry.rating || 'unverified').toUpperCase().replace(/_/g, ' ')
            const claimPreview = entry.claim.substring(0, 60) + (entry.claim.length > 60 ? '...' : '')

            html += `<div class="history-item" data-index="${idx}">
                <div class="history-verdict rating-${entry.rating}">${rating}</div>
                <div class="history-claim">${claimPreview}</div>
                <div class="history-meta">
                    <span>${confidence}% Confidence</span>
                    <span>${new Date(entry.timestamp).toLocaleDateString()}</span>
                </div>
            </div>`
        })
        historyListEl.innerHTML = html

        const items = historyListEl.querySelectorAll('.history-item')
        items.forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index)
                _showDetailView(shadow, history[idx])
            })
        })
    } catch (e) {
        console.error('Failed to load history:', e)
        historyListEl.innerHTML = '<div class="empty-state"><div class="empty-state-text" style="color:#f87171">Failed to load history</div></div>'
    }
}

function _showDetailView(shadow, entry) {
    const tabHistory = shadow.querySelector('#tab-history')
    const detailView = shadow.querySelector('#detail-view')
    const detailBackBtn = shadow.querySelector('#detail-back')
    const detailContent = shadow.querySelector('#detail-content')

    if (!detailView) return

    const confidence = Math.round((entry.confidence || 0) * 100)
    const rating = (entry.rating || 'unverified').toUpperCase().replace(/_/g, ' ')
    const timestamp = new Date(entry.timestamp).toLocaleString()
    let ratingClass = 'rating-unverified'
    if (entry.rating === 'true') ratingClass = 'rating-true'
    else if (entry.rating === 'false') ratingClass = 'rating-false'
    else if (entry.rating === 'misleading') ratingClass = 'rating-misleading'
    else if (entry.rating === 'needs_context') ratingClass = 'rating-needs_context'

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
    `

    if (tabHistory) tabHistory.classList.add('hidden')
    detailView.classList.remove('hidden')

    detailBackBtn.onclick = () => {
        detailView.classList.add('hidden')
        if (tabHistory) tabHistory.classList.remove('hidden')
    }
}

function update_panel_ui(shadow, data, errorMsg, isLoading = false) {
    const loadingEl = shadow.querySelector('#loading-state')
    const contentEl = shadow.querySelector('#content-state')

    if (isLoading) {
        if (loadingEl) loadingEl.classList.remove('hidden')
        if (contentEl) contentEl.classList.add('hidden')
        return
    }

    if (loadingEl) loadingEl.classList.add('hidden')
    if (contentEl) contentEl.classList.remove('hidden')

    if (errorMsg) {
        const el = shadow.querySelector('#verif-explanation-en')
        if (el) el.innerText = errorMsg
        return
    }
    if (!data) return

    const rating = data.rating ?? 'unverified'
    const confidenceFrac = data.confidence ?? 0
    const confidence = Math.round(confidenceFrac * 100)
    const sourceUrl = (data.sources && data.sources[0]) || data.source_surface || 'VerifAI Cache'

    const verdict_el = shadow.querySelector('#verif-verdict')
    const confidence_el = shadow.querySelector('#verif-confidence')
    const source_el = shadow.querySelector('#verif-source')
    const explanation_en = shadow.querySelector('#verif-explanation-en')
    const explanation_tl = shadow.querySelector('#verif-explanation-tl')

    if (verdict_el) {
        verdict_el.innerText = rating.toUpperCase().replace(/_/g, ' ')
        verdict_el.className = `verdict-value rating-${rating.replace(/\s+/g, '_')}`
    }
    if (confidence_el) confidence_el.innerText = `${confidence}%`
    if (source_el) source_el.innerText = sourceUrl
    if (explanation_en) explanation_en.innerText = data.explanation_en || ''
    if (explanation_tl) explanation_tl.innerText = data.explanation_tl || ''

    const traceSection = shadow.querySelector('#verif-trace-section')
    const traceStepsEl = shadow.querySelector('#verif-trace-steps')
    const traceSummary = shadow.querySelector('#verif-trace-summary')

    if (traceSection && data.trace?.steps?.length > 0) {
        const weightClass = { high: 'weight-high', medium: 'weight-medium', low: 'weight-low' };
        if (traceStepsEl) {
            traceStepsEl.innerHTML = data.trace.steps.map(step => `
                <div class="trace-step">
                    <span class="trace-icon">${step.icon || '🔹'}</span>
                    <div class="trace-body">
                        <div class="trace-step-name">${step.step}</div>
                        <div class="trace-finding">${step.finding}</div>
                    </div>
                    <span class="trace-weight ${weightClass[step.weight] || 'weight-medium'}">${step.weight}</span>
                </div>
            `).join('')
        }
        if (traceSummary) traceSummary.innerText = data.trace.summary || ''
        traceSection.style.display = 'block'
    } else if (traceSection) {
        traceSection.style.display = 'none'
    }

    const credSection = shadow.querySelector('#verif-cred-section')
    const credList = shadow.querySelector('#verif-cred-list')

    if (credSection && data.source_credibility?.length > 0) {
        const scoreColor = (score) => {
            if (score >= 0.80) return '#22c55e'
            if (score >= 0.60) return '#3b82f6'
            if (score >= 0.40) return '#f97316'
            return '#ef4444'
        }

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
            `).join('')
        }
        credSection.style.display = 'block'
    } else if (credSection) {
        credSection.style.display = 'none'
    }

    const transparencySection = shadow.querySelector('#verif-transparency-section')
    const transparencyContent = shadow.querySelector('#transparency-content')

    if (transparencySection) {
        if (data.decision_context) {
            const ctx = data.decision_context
            const mode = ctx.mode || 'unknown'
            const fact_score = ctx.fact_score ?? 0
            const coverage_score = ctx.coverage_score ?? 0
            const bias_balance = ctx.bias_balance ?? 0
            const total_articles = ctx.total_articles ?? 0

            let html = `
                <div class="transparency-card">
                    <div class="transparency-header">
                        Decision Mode
                        <span class="mode-badge">${mode.replace(/_/g, ' ')}</span>
                    </div>
                </div>
            `

            if (mode === 'fact-check') {
                html += `
                    <div class="transparency-card">
                        <div class="transparency-header">Fact-Check Analysis</div>
                        <div class="calculation-row">
                            <span class="calculation-label">Fact-Check Score</span>
                            <span class="calculation-value">${(fact_score * 100).toFixed(1)}%</span>
                        </div>
                        <div class="score-bar-mini">
                            <div class="score-bar-mini-fill" style="width: ${fact_score * 100}%"></div>
                        </div>
                    </div>
                    <div class="transparency-card">
                        <div class="transparency-header">Coverage Support</div>
                        <div class="calculation-row">
                            <span class="calculation-label">Coverage Score</span>
                            <span class="calculation-value">${(coverage_score * 100).toFixed(1)}%</span>
                        </div>
                        <div class="calculation-row">
                            <span class="calculation-label">Bias Balance</span>
                            <span class="calculation-value">${(bias_balance * 100).toFixed(1)}%</span>
                        </div>
                        <div class="calculation-row">
                            <span class="calculation-label">Articles Found</span>
                            <span class="calculation-value">${total_articles}</span>
                        </div>
                    </div>
                `
            } else if (mode === 'coverage_support') {
                html += `
                    <div class="transparency-card">
                        <div class="transparency-header">Coverage-Based Decision</div>
                        <div class="calculation-row">
                            <span class="calculation-label">Coverage Score</span>
                            <span class="calculation-value">${(coverage_score * 100).toFixed(1)}%</span>
                        </div>
                        <div class="calculation-row">
                            <span class="calculation-label">Bias Balance</span>
                            <span class="calculation-value">${(bias_balance * 100).toFixed(1)}%</span>
                        </div>
                        <div class="calculation-row">
                            <span class="calculation-label">Articles Found</span>
                            <span class="calculation-value">${total_articles}</span>
                        </div>
                        <div class="score-bar-mini">
                            <div class="score-bar-mini-fill" style="width: ${coverage_score * 100}%"></div>
                        </div>
                    </div>
                `
            } else if (mode === 'coverage_weak') {
                html += `
                    <div class="transparency-card">
                        <div class="transparency-header">Limited Coverage</div>
                        <div class="calculation-row">
                            <span class="calculation-label">Coverage Score</span>
                            <span class="calculation-value">${(coverage_score * 100).toFixed(1)}%</span>
                        </div>
                        <div class="calculation-row">
                            <span class="calculation-label">Articles Found</span>
                            <span class="calculation-value">${total_articles}</span>
                        </div>
                        <p class="no-data">Insufficient coverage to make a definitive determination</p>
                    </div>
                `
            } else {
                html += `
                    <div class="transparency-card">
                        <p class="no-data">No evidence found to evaluate this claim</p>
                    </div>
                `
            }

            html += `
                <div class="transparency-card">
                    <div class="transparency-header">Confidence Calculation</div>
                    <div class="confidence-breakdown">
                        <div class="breakdown-item">
                            <span>Base Score</span>
                            <span class="breakdown-value">${mode === 'fact-check' ? '65%' : mode === 'coverage_support' ? '35%' : mode === 'coverage_weak' ? '20%' : '10%'}</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Evidence Adjustment</span>
                            <span class="breakdown-value">${(confidence * 100).toFixed(0)}% (final)</span>
                        </div>
                        <div class="final-confidence">
                            Final Confidence: ${(confidence * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>
            `

            transparencyContent.innerHTML = html
            transparencySection.classList.remove('hidden')
        } else {
            transparencyContent.innerHTML = `<div class="no-data">Transparency details are not available for this verdict yet. The score is based on model reasoning and supporting evidence when available.</div>`
            transparencySection.classList.remove('hidden')
        }
    }
}

