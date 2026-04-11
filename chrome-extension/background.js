const APP_URL = 'https://topwords.eu';

// ── Badge ─────────────────────────────────────────────────────────────────────

function refreshBadge() {
    fetch(`${APP_URL}/extension/badge`, {
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
    })
        .then((r) => r.json())
        .then(({ count }) => {
            chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
            chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
        })
        .catch(() => chrome.action.setBadgeText({ text: '' }));
}

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

    refreshBadge();
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

    if (msg.type === 'ADD_WORD') {
        fetch(`${APP_URL}/extension/add-word`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': msg.csrf,
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                word: msg.word,
                meaning_hu: msg.meaning_hu,
                extra_meanings: msg.extra_meanings,
                synonyms: msg.synonyms,
                part_of_speech: msg.part_of_speech,
                example_en: msg.example_en,
                example_hu: msg.example_hu,
                form_base: msg.form_base,
                verb_past: msg.verb_past,
                verb_past_participle: msg.verb_past_participle,
                verb_present_participle: msg.verb_present_participle,
                verb_third_person: msg.verb_third_person,
                is_irregular: msg.is_irregular,
                noun_plural: msg.noun_plural,
                adj_comparative: msg.adj_comparative,
                adj_superlative: msg.adj_superlative,
            }),
        })
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'SEARCH_WORD') {
        fetch(`${APP_URL}/extension/search?q=${encodeURIComponent(msg.q)}`, {
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
        })
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'GET_STATUSES') {
        fetch(`${APP_URL}/extension/statuses`, {
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
        })
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
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
            .then((r) => {
                if (r.ok) { refreshBadge(); }
                sendResponse({ ok: r.ok });
            })
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'REFRESH_BADGE') {
        refreshBadge();
    }
});
