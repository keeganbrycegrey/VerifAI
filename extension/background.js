const API_BASE_URL = "http://localhost:8000";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "check_claim") {
        performFactCheck(request.content, request.type)
            .then(data => sendResponse({ status: "success", data }))
            .catch(err => sendResponse({ status: "error", message: err.message }));
        return true;
    }
});

async function performFactCheck(content, type = "text") {
    try {
        const response = await fetch(`${API_BASE_URL}/check`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                input_type: type,
                content: content,
                source_surface: "extension",
                language_hint: "auto"
            })
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("VerifAI API Error:", error);
        throw error;
    }
}
