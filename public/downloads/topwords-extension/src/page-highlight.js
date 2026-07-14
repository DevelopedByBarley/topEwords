// Oldal-szövegkiemelés + popup üzenetkezelő (TOGGLE_HIGHLIGHT / GET_PAGE_STATS).

// ── Page Highlighting ─────────────────────────────────────────────────────────

let highlightEnabled = false;
let hlWordMap = null;

const SKIP_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'TEXTAREA',
    'INPUT',
    'SELECT',
    'NOSCRIPT',
    'CODE',
    'PRE',
    'BUTTON',
]);

function initHighlight() {
    storageGet({ hlEnabled: false }, ({ hlEnabled }) => {
        if (!hlEnabled) {
            return;
        }

        highlightEnabled = true;

        // document_idle guarantees the DOM is already at least 'interactive'
        // (text nodes are present), so apply highlights immediately instead of
        // waiting for the full 'load' event (which fires only after images/fonts).
        loadAndApplyHighlights();

        // After all resources finish loading, re-apply if JS frameworks rendered
        // additional text nodes after DOMContentLoaded.
        if (document.readyState !== 'complete') {
            window.addEventListener(
                'load',
                () => {
                    if (highlightEnabled && hlWordMap) {
                        removeHighlights();
                        applyHighlights();
                    }
                },
                { once: true },
            );
        }
    });
}

function loadAndApplyHighlights(attempt = 0) {
    sendMsg({ type: 'GET_STATUSES' }, (resp) => {
        if (!resp || resp.error || !resp.statuses) {
            if (attempt < 3) {
                setTimeout(
                    () => loadAndApplyHighlights(attempt + 1),
                    1500 * (attempt + 1),
                );
            }

            return;
        }

        const entries = Object.entries(resp.statuses);

        if (!entries.length) {
            return;
        }

        hlWordMap = new Map(entries.map(([w, s]) => [w.toLowerCase(), s]));
        applyHighlights();
    });
}

function applyHighlights() {
    if (!hlWordMap?.size) {
        return;
    }

    removeHighlights();

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const el = node.parentElement;

                if (!el) {
                    return NodeFilter.FILTER_REJECT;
                }

                if ('twHl' in el.dataset) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (el.isContentEditable) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (SKIP_TAGS.has(el.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (
                    el.closest(
                        'a, button, [role="button"], [role="link"], [role="combobox"], [role="search"], [role="listbox"], [role="option"], [role="navigation"], ytd-searchbox, ytd-masthead, #search-form',
                    )
                ) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            },
        },
    );

    const nodes = [];

    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }

    nodes.forEach(highlightTextNode);

    document.addEventListener('click', handleHlClick, { capture: true });
}

/** Kiemelő span az élő oldalhoz. Háttérszín kiemelés, mint egy szövegkiemelő toll. */
function makeHlSpan(text, status, isPhrase) {
    const color = STATUS_COLORS[status];
    const span = document.createElement('span');
    span.dataset.twHl = hlKey(text);
    span.dataset.twStatus = status;
    span.style.setProperty('display', 'inline', 'important');
    span.style.setProperty('position', 'static', 'important');
    span.style.setProperty('float', 'none', 'important');
    span.style.setProperty('background-color', `${color}33`, 'important');
    span.style.setProperty('border-radius', '3px', 'important');
    span.style.setProperty('padding', '1px 2px', 'important');
    span.style.setProperty('cursor', 'pointer', 'important');

    if (isPhrase) {
        span.dataset.twPhrase = '1';
        span.style.setProperty('background-color', `${color}4d`, 'important');
    }

    span.textContent = text;

    return span;
}

function highlightTextNode(node) {
    const parentEl = node.parentElement;

    if (parentEl) {
        const display = window.getComputedStyle(parentEl).display;

        if (display.includes('flex') || display.includes('grid')) {
            return;
        }
    }

    const tokens = buildHlTokens(
        node.textContent,
        hlWordMap,
        mapHasPhrases(hlWordMap),
    );

    const hasMatch = tokens.some(
        (token) =>
            (token.kind === 'word' || token.kind === 'phrase') && token.status,
    );

    if (!hasMatch) {
        return;
    }

    const parts = tokens.map((token) => {
        if (
            (token.kind === 'word' || token.kind === 'phrase') &&
            token.status
        ) {
            return makeHlSpan(
                token.text,
                token.status,
                token.kind === 'phrase',
            );
        }

        return document.createTextNode(token.text);
    });

    const parent = node.parentNode;

    if (!parent) {
        return;
    }

    const fragment = document.createDocumentFragment();
    parts.forEach((p) => fragment.appendChild(p));
    parent.replaceChild(fragment, node);
}

function removeHighlights() {
    document.removeEventListener('click', handleHlClick, { capture: true });
    const parents = new Set();
    document.querySelectorAll('[data-tw-hl]').forEach((span) => {
        const parent = span.parentNode;

        if (parent) {
            parent.replaceChild(
                document.createTextNode(span.textContent),
                span,
            );
            parents.add(parent);
        }
    });
    parents.forEach((p) => p.normalize());
}

function handleHlClick(e) {
    const span = e.target?.closest?.('[data-tw-hl]');

    if (!span) {
        return;
    }

    if (e.target?.closest?.('a, button, [role="button"], [role="link"]')) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    const rect = span.getBoundingClientRect();
    showPopup(span.textContent, rect);
}

function toggleHighlight() {
    highlightEnabled = !highlightEnabled;
    storageSet({ hlEnabled: highlightEnabled });

    if (highlightEnabled) {
        loadAndApplyHighlights();
    } else {
        hlWordMap = null;
        removeHighlights();
    }

    return highlightEnabled;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'TOGGLE_HIGHLIGHT') {
        sendResponse({ enabled: toggleHighlight() });
    }

    if (msg.type === 'GET_HL_STATE') {
        sendResponse({ enabled: highlightEnabled });
    }

    if (msg.type === 'GET_PAGE_STATS') {
        if (hlWordMap) {
            sendResponse({ stats: getPageStats(hlWordMap) });
        } else {
            sendMsg({ type: 'GET_STATUSES' }, (resp) => {
                if (!resp || resp.error || !resp.statuses) {
                    sendResponse({ error: resp?.error ?? 'unknown' });

                    return;
                }

                const map = new Map(
                    Object.entries(resp.statuses).map(([w, s]) => [
                        w.toLowerCase(),
                        s,
                    ]),
                );
                sendResponse({ stats: getPageStats(map) });
            });

            return true;
        }
    }
});

initHighlight();

// A közös szókincs-frissítés (shared.js: refreshVocabHighlights) hookja: friss
// státusztérkép érkezésekor újrarajzolja az oldal-kiemeléseket.
registerVocabRefreshHook({
    isActive: () => !!hlWordMap,
    apply(map) {
        hlWordMap = map;
        removeHighlights();
        applyHighlights();
    },
});

function getPageStats(wordMap) {
    const seen = new Set();
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const el = node.parentElement;

                if (!el) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (SKIP_TAGS.has(el.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            },
        },
    );

    const regex = /\b([a-zA-Z]{2,})\b/g;

    while (walker.nextNode()) {
        const text = walker.currentNode.textContent;
        let match;

        while ((match = regex.exec(text)) !== null) {
            seen.add(match[1].toLowerCase());
        }
    }

    const counts = {
        learning: 0,
        saved: 0,
        known: 0,
        pronunciation: 0,
        practice: 0,
        total: seen.size,
    };

    for (const word of seen) {
        const status = wordMap.get(word);

        if (status && status in counts) {
            counts[status]++;
        }
    }

    return counts;
}
