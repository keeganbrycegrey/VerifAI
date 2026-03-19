const API_BASE_URL = "http://localhost:8000";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== "check_claim") return;

    const payload = {
        input_type: request.type || "text",
        content: request.content,
        source_surface: "extension",
        language_hint: "auto",
    };

    fetch(`${API_BASE_URL}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
        .then(res => res.json())
        .then(data => {
            sendResponse({ status: "success", data });
        })
        .catch(err => {
            sendResponse({ status: "error", message: "Cannot connect to VerifAI server." });
        });

    return true; 
});
