let verifAI_panel = null;

document.addEventListener('mouseup', () => {
    const selected_text = window.getSelection().toString().trim();

    // magt-trigger lang if the text is long enough to be a claim. pa-confirm also if the 20 character threshold is good na
    if (selected_text.length > 30) {
        console.log("VerifAI: Analyzing highlighted text...");
        request_verification(selected_text);
    }
});

// highlight txt -> bg.js
async function request_verification(text) {
    chrome.runtime.sendMessage({
        action: "check_claim",
        content: text,
        type: "text"
    }, (response) => {
        if (response && response.status === "success") {
            show_verdict_panel(response.data);
        } else {
            console.error("VerifAI: API match failed or backend is down.");
        }
    });
}

// panel.html, panel.css injection
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
