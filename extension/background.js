const API_BASE_URL = "RAILWAY_URL" 

// register context menus on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id:       "check-image",
        title:    "VerifAI this image",
        contexts: ["image"],
    })
    chrome.contextMenus.create({
        id:       "check-text",
        title:    "VerifAI this text",
        contexts: ["selection"],
    })
})

// handle context menu clicks 
chrome.contextMenus.onClicked.addListener(async (info, tab) => {

    if (info.menuItemId === "check-image") {
        chrome.tabs.sendMessage(tab.id, { type: "SHOW_LOADING" })
        try {
            let content, input_type
            try {
                content    = await _fetchImageAsBase64(info.srcUrl)
                input_type = "image_base64"
            } catch {
                // cors blocked — fall back to url
                content    = info.srcUrl
                input_type = "url"
            }
            const verdict = await _callBackend({ input_type, content })
            chrome.tabs.sendMessage(tab.id, { type: "SHOW_VERDICT", verdict })
        } catch (err) {
            chrome.tabs.sendMessage(tab.id, {
                type:    "SHOW_ERROR",
                message: "Hindi ma-check ang larawan. Subukan muli.",
            })
        }
    }

    if (info.menuItemId === "check-text") {
        chrome.tabs.sendMessage(tab.id, { type: "SHOW_LOADING" })
        try {
            const verdict = await _callBackend({ input_type: "text", content: info.selectionText })
            chrome.tabs.sendMessage(tab.id, { type: "SHOW_VERDICT", verdict })
        } catch (err) {
            chrome.tabs.sendMessage(tab.id, {
                type:    "SHOW_ERROR",
                message: "Hindi ma-check ang teksto. Subukan muli.",
            })
        }
    }
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== "check_claim") return

    _callBackend({
        input_type: request.type || "text",
        content:    request.content,
    })
        .then(data => sendResponse({ status: "success", data }))
        .catch(() => sendResponse({ status: "error", message: "Cannot connect to VerifAI server." }))

    return true  // keep channel open for async response
})

// ── helpers ────────────────────────────────────────────────────────────────────

async function _callBackend(payload) {
    const response = await fetch(`${API_BASE_URL}/check`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
            ...payload,
            source_surface: "extension",
            language_hint:  "auto",
        }),
    })
    if (!response.ok) throw new Error(`backend error: ${response.status}`)
    return response.json()
}

async function _fetchImageAsBase64(url) {
    const response = await fetch(url)
    const blob     = await response.blob()
    return new Promise((resolve, reject) => {
        const reader       = new FileReader()
        reader.onloadend   = () => resolve(reader.result.split(",")[1])
        reader.onerror     = reject
        reader.readAsDataURL(blob)
    })
}