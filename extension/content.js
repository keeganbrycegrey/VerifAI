let verifAI_panel = null;
let verifAI_popup = null;
let selectedClaim = '';

document.addEventListener('mouseup', () => {
    const selected_text = window.getSelection().toString().trim();

    // magt-trigger lang if the text is long enough to be a claim. pa-confirm also if the 20 character threshold is good na
    if (selected_text.length > 30) {
        console.log("VerifAI: Text selected, showing popup...");
        selectedClaim = selected_text;
        show_popup();
    }
});

// show floating popup on text selection
function show_popup() {
    if (verifAI_popup) {
        hide_popup();
    }

    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const popupTop = rect.bottom + window.scrollY + 10;
    const popupLeft = rect.left + window.scrollX + (rect.width / 2) - 160; // Center horizontally

    const host = document.createElement('div');
    host.id = 'verifai-popup-root';
    host.style.position = 'fixed';
    host.style.top = popupTop + 'px';
    host.style.left = Math.max(10, popupLeft) + 'px';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none'; // Allow clicks through host
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    Promise.all([
        fetch(chrome.runtime.getURL('popup.html')).then(res => res.text()),
        fetch(chrome.runtime.getURL('popup.css')).then(res => res.text()),
        fetch(chrome.runtime.getURL('popup.js')).then(res => res.text())
    ]).then(([html, css, js]) => {
        const style = document.createElement('style');
        style.textContent = css;

        const container = document.createElement('div');
        container.innerHTML = html;

        const script = document.createElement('script');
        script.textContent = js;

        shadow.appendChild(style);
        shadow.appendChild(container);
        shadow.appendChild(script);

        verifAI_popup = shadow;
        host.style.pointerEvents = 'auto'; // Now capture events

        // Underline the claim
        underlineClaim(range);

        // Update text preview
        const previewEl = shadow.getElementById('popup-text-preview');
        if (previewEl) {
            previewEl.textContent = selectedClaim.length > 60 ? selectedClaim.substring(0, 60) + '...' : selectedClaim;
        }

        // Listen for events from popup.js
        const factcheckHandler = () => request_verification(selectedClaim);
        const closeHandler = () => hide_popup();
        const trashHandler = () => {
            removeUnderline();
            hide_popup();
        };

        window.addEventListener('verifai:factcheck', factcheckHandler, { once: true });
        window.addEventListener('verifai:closepopup', closeHandler, { once: true });
        window.addEventListener('verifai:trashunderline', trashHandler, { once: true });
        window.addEventListener('verifai:viewpanel', () => {
            show_verdict_panel();
            hide_popup();
        }, { once: true });
    });
}

function hide_popup() {
    if (verifAI_popup) {
        const host = document.getElementById('verifai-popup-root');
        if (host) host.remove();
        verifAI_popup = null;
        selectedClaim = '';
    }
}

function underlineClaim(range) {
    const span = document.createElement('span');
    span.className = 'verifai-claim verifai-underlined';
    span.title = 'VerifAI claim - hover to select';
    span.onmouseenter = () => selectNode(span);
    try {
        range.surroundContents(span);
    } catch (e) {
        console.log('VerifAI: Could not underline (cross-node selection)');
    }
    injectUnderlineStyles();
}

function selectNode(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function removeUnderline() {
    const claimSpan = document.querySelector('.verifai-claim');
    if (claimSpan) {
        const parent = claimSpan.parentNode;
        while (claimSpan.firstChild) {
            parent.insertBefore(claimSpan.firstChild, claimSpan);
        }
        parent.removeChild(claimSpan);
        removeUnderlineStyles();
    }
}

function injectUnderlineStyles() {
    if (document.getElementById('verifai-underline-styles')) return;
    const style = document.createElement('style');
    style.id = 'verifai-underline-styles';
    style.textContent = `
        .verifai-claim { position: relative; }
        .verifai-underlined {
            text-decoration: underline #3b82f6 wavy 2px !important;
            background: linear-gradient(to right, transparent 80%, rgba(59,130,246,0.1) 100%) !important;
            cursor: pointer !important;
            border-radius: 2px;
            padding: 0 2px;
        }
        .verifai-underlined:hover {
            background: rgba(59,130,246,0.25) !important;
            text-shadow: 0 0 4px rgba(59,130,246,0.5) !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
}

function removeUnderlineStyles() {
    const style = document.getElementById('verifai-underline-styles');
    if (style) style.remove();
}

// highlight txt -> bg.js
async function request_verification(text) {
    const host = document.getElementById('verifai-popup-root');
    if (host) {
        const shadow = host.shadowRoot;
        const loadingEl = shadow.getElementById('preview-verdict') || shadow.querySelector('.preview-verdict');
        if (loadingEl) loadingEl.textContent = 'Verifying...';
    }

    chrome.runtime.sendMessage({
        action: "check_claim",
        content: text,
        type: "text"
    }, (response) => {
        if (response && response.status === "success") {
            const host = document.getElementById('verifai-popup-root');
            if (host) {
                const shadow = host.shadowRoot;
                const popup = shadow.querySelector('.verifai-popup');
                popup.classList.add('expanded');

                const rating = (response.data.rating || response.data.verdict || 'unverified').toLowerCase().replace(/\\s+/g, '_');
                popup.classList.add('verdict-' + rating);

                const confidence = Math.round((response.data.confidence || response.data.confidence_score || 0) * 100);
                const fill = shadow.querySelector('.bar-fill');
                if (fill) fill.style.width = confidence + '%';

                const verdictPreview = shadow.querySelector('.verdict-preview') || shadow.querySelector('.preview-verdict');
                if (verdictPreview) {
                    verdictPreview.textContent = rating.toUpperCase();
                    if (response.data.explanation_en) {
                        verdictPreview.textContent += ': ' + response.data.explanation_en.substring(0, 40) + '...';
                    }
                }
            } else {
                show_verdict_panel(response.data);
            }
        } else {
            console.error("VerifAI: API match failed or backend is down.");
        }
    });
    return true;
}

function show_verdict_panel(data) {
    if (document.getElementById('verifai-root')) return;

    const host = document.createElement('div');
    host.id = 'verifai-root';
    host.style.position = 'fixed';
    host.style.top = '20px';
    host.style.right = '20px';
    host.style.zIndex = '2147483647';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    Promise.all([
        fetch(chrome.runtime.getURL('panel.html')).then(res => res.text()),
        fetch(chrome.runtime.getURL('panel.css')).then(res => res.text())
    ]).then(([html, css]) => {
        const style = document.createElement('style');
        style.textContent = css;

        const container = document.createElement('div');
        container.innerHTML = html;

        shadow.appendChild(style);
        shadow.appendChild(container);

        update_panel_ui(shadow, data);
    });
}

// data mapping from backend -> panel.html
function update_panel_ui(shadow, data) {
    const verdict_el = shadow.getElementById('verif-verdict');
    const confidence_el = shadow.getElementById('verif-confidence');
    const source_el = shadow.getElementById('verif-source');
    const explanation_en_el = shadow.getElementById('verif-explanation-en');
    const explanation_tl_el = shadow.getElementById('verif-explanation-tl');

    const rating = data.rating ?? data.verdict ?? 'unverified';
    const confidence = Math.round((data.confidence ?? data.confidence_score ?? 0) * 100);
    const sourceUrl = (data.sources && data.sources.length > 0 && data.sources[0]) || data.source_surface || 'Global Cache';

    if (verdict_el) {
        verdict_el.innerText = rating.toUpperCase();
        verdict_el.className = '';
        verdict_el.classList.add(`text-${rating.replace(/\s+/g, '_')}`);
    }
    if (confidence_el) confidence_el.innerText = `${confidence}% Confidence`;
    if (source_el) source_el.innerText = `Source: ${sourceUrl}`;

    if (explanation_en_el) explanation_en_el.innerText = data.explanation_en || '';
    if (explanation_tl_el) explanation_tl_el.innerText = data.explanation_tl || '';

    const close_btn = shadow.getElementById('verif-close');
    if (close_btn) {
        close_btn.onclick = () => document.getElementById('verifai-root').remove();
    }
}
