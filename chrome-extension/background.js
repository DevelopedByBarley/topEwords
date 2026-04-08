const APP_URL = 'http://localhost:8000';

// ── Context menus ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'lookup-word',
        title: 'Szó keresése: "%s"',
        contexts: ['selection'],
    });

    chrome.contextMenus.create({
        id: 'analyze-page',
        title: 'Oldal szövegelemzése',
        contexts: ['page', 'selection'],
    });
});

// Extension icon click → analyze current page
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: `${APP_URL}/text-analysis?url=${encodeURIComponent(tab.url)}` });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'lookup-word') {
        const word = (info.selectionText ?? '').trim().split(/\s+/)[0];
        if (!word) return;
        chrome.tabs.create({ url: `${APP_URL}/words?search=${encodeURIComponent(word)}` });
    }

    if (info.menuItemId === 'analyze-page') {
        chrome.tabs.create({ url: `${APP_URL}/text-analysis?url=${encodeURIComponent(tab.url)}` });
    }
});

// ── Message handler (from content script) ────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'LOOKUP_WORD') {
        fetch(`${APP_URL}/extension/lookup?word=${encodeURIComponent(msg.word)}`, {
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
        })
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true; // keep channel open for async response
    }

    if (msg.type === 'UPDATE_STATUS') {
        const url = msg.is_custom
            ? `${APP_URL}/custom-words/${msg.id}/status`
            : `${APP_URL}/words/${msg.id}/status`;

        const body = msg.status ? JSON.stringify({ status: msg.status }) : JSON.stringify({ status: '' });

        fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': msg.csrf,
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json',
            },
            body,
        })
            .then((r) => sendResponse({ ok: r.ok }))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }
});
