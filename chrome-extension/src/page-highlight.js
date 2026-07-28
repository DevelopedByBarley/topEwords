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

/** Igaz, ha a szövegcsomópont kiemelhető (nem beviteli mező, link, már kiemelt szó…). */
function isHighlightableTextNode(node) {
    const el = node.parentElement;

    if (!el) {
        return false;
    }

    if ('twHl' in el.dataset) {
        return false;
    }

    if (el.isContentEditable) {
        return false;
    }

    if (SKIP_TAGS.has(el.tagName)) {
        return false;
    }

    return !el.closest(
        'a, button, [role="button"], [role="link"], [role="combobox"], [role="search"], [role="listbox"], [role="option"], [role="navigation"], ytd-searchbox, ytd-masthead, #search-form',
    );
}

/** Egy részfa (vagy egyetlen szövegcsomópont) kiemelése. */
function highlightWithin(root) {
    if (root.nodeType === Node.TEXT_NODE) {
        if (isHighlightableTextNode(root)) {
            highlightTextNode(root);
        }

        return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE) {
        return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            return isHighlightableTextNode(node)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        },
    });

    const nodes = [];

    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }

    nodes.forEach(highlightTextNode);
}

function applyHighlights() {
    if (!hlWordMap?.size) {
        return;
    }

    hlApplying = true;
    removeHighlights();
    highlightWithin(document.body);
    hlApplying = false;
    // A saját DOM-írásaink rekordjait eldobjuk, hogy ne indítsanak új kört.
    hlObserver?.takeRecords();

    document.addEventListener('click', handleHlClick, { capture: true });
    document.addEventListener('mousedown', handleHlMouseDown, { capture: true });
    document.addEventListener('mouseup', handleHlMouseUp, { capture: true });
    document.addEventListener('dblclick', handleHlDblClick, { capture: true });

    startHlObserver();
}

// ── Utólag érkező szöveg kiemelése ────────────────────────────────────────────
//
// SPA-oldalakon (pl. Next.js-alapú hírportálok) a linkre kattintás nem tölti újra
// a lapot, így a content script sem fut le újra: az újrarajzolt DOM kiemelés
// nélkül maradna, és csak a kapcsoló ki/be nyomása hozná vissza. Ugyanez a
// helyzet a hidratálással és a lusta betöltésű (végtelen görgetés) tartalommal.
// Ezért egy MutationObserverrel figyeljük az új szöveget, és csak az újonnan
// beszúrt részfákat emeljük ki — teljes újrarajzolás nélkül.

const HL_RESCAN_DEBOUNCE_MS = 400;

let hlObserver = null;
let hlApplying = false; // saját írásaink alatt igaz — ilyenkor nem reagálunk
let hlRescanTimer = null;
const hlPendingRoots = new Set();

/** Igaz, ha a beszúrt csomópontban van kiemelendő szöveg (és nem a mi spanunk). */
function hasHighlightableText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return /\S/.test(node.textContent ?? '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    if ('twHl' in node.dataset) {
        return false;
    }

    return /\S/.test(node.textContent ?? '');
}

function startHlObserver() {
    if (hlObserver) {
        return;
    }

    hlObserver = new MutationObserver((records) => {
        if (!extAlive()) {
            stopHlObserver();

            return;
        }

        if (hlApplying || !highlightEnabled || !hlWordMap?.size) {
            return;
        }

        records.forEach((record) => {
            record.addedNodes.forEach((node) => {
                if (hasHighlightableText(node)) {
                    hlPendingRoots.add(node);
                }
            });
        });

        if (!hlPendingRoots.size) {
            return;
        }

        // Debounce: a keretrendszerek egy renderelés alatt sok mutációt küldenek.
        clearTimeout(hlRescanTimer);
        hlRescanTimer = setTimeout(flushHlRescan, HL_RESCAN_DEBOUNCE_MS);
    });

    hlObserver.observe(document.body, { childList: true, subtree: true });
}

function stopHlObserver() {
    hlObserver?.disconnect();
    hlObserver = null;
    clearTimeout(hlRescanTimer);
    hlRescanTimer = null;
    hlPendingRoots.clear();
}

function flushHlRescan() {
    hlRescanTimer = null;

    const roots = [...hlPendingRoots];
    hlPendingRoots.clear();

    if (!highlightEnabled || !hlWordMap?.size) {
        return;
    }

    hlApplying = true;
    roots.forEach((root) => {
        // A közben eltávolított (pl. lecserélt) részfákkal nincs teendő. Egymásba
        // ágyazott gyökereknél a külső menet is leválaszthat, ezért itt ellenőrizzük.
        if (root.isConnected) {
            highlightWithin(root);
        }
    });
    hlApplying = false;
    hlObserver?.takeRecords();
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
    document.removeEventListener('mousedown', handleHlMouseDown, { capture: true });
    document.removeEventListener('mouseup', handleHlMouseUp, { capture: true });
    document.removeEventListener('dblclick', handleHlDblClick, { capture: true });
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

// ── Kiemelt szó gyorsgesztusai ─────────────────────────────────────────────────
//
// A kiemelt szón a felhasználó a popup megnyitása nélkül is állíthat státuszt:
//   • dupla-klikk  → „Tudom" (known)
//   • hosszú-nyomás (500 ms) → „Később" (saved)
//   • sima (egyszeri, rövid) klikk → a szokásos szó-popup
//
// A sima klikk popupját késleltetve nyitjuk, hogy egy közvetlenül utána érkező
// dupla-klikk elnyomhassa (különben a popup felvillanna). A hosszú-nyomás a
// mousedown-timerrel dől el, és elnyeli a rákövetkező click-et.

const LONG_PRESS_MS = 500;
const CLICK_DELAY_MS = 260; // > a rendszer dblclick-ablaka, hogy a dbl megelőzze
const QUICK_STATUS = { dbl: 'known', long: 'saved' };

let hlPendingClick = null; // { timer, word, rect }
let hlLongPress = null; // { timer, span, fired }

/** A kiemelt szó spanja, ha az esemény azon (vagy leszármazottján) történt. */
function hlSpanFromEvent(e) {
    if (!e.isTrusted) {
        return null;
    }

    const span = e.target?.closest?.('[data-tw-hl]');

    if (!span || e.target?.closest?.('a, button, [role="button"], [role="link"]')) {
        return null;
    }

    return span;
}

function cancelPendingClick() {
    if (hlPendingClick) {
        clearTimeout(hlPendingClick.timer);
        hlPendingClick = null;
    }
}

function cancelLongPress() {
    if (hlLongPress) {
        clearTimeout(hlLongPress.timer);
        hlLongPress = null;
    }
}

function handleHlMouseDown(e) {
    const span = hlSpanFromEvent(e);

    if (!span || e.button !== 0) {
        return;
    }

    cancelLongPress();
    const state = { span, fired: false };
    state.timer = setTimeout(() => {
        state.fired = true;
        // A hosszú-nyomás státuszt állít; a rákövetkező click-et elnyeljük.
        quickStatusOnSpan(span, QUICK_STATUS.long);
    }, LONG_PRESS_MS);
    hlLongPress = state;
}

function handleHlMouseUp() {
    // A tényleges státusz-állítás a timerben / dblclick-ben történik; itt csak a
    // le nem járt hosszú-nyomás timert töröljük (rövid kattintás volt).
    cancelLongPress();
}

function handleHlDblClick(e) {
    const span = hlSpanFromEvent(e);

    if (!span) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    // A dupla-klikk „Tudom"-ot állít — a késleltetett sima-klikk popup elmarad.
    cancelPendingClick();
    quickStatusOnSpan(span, QUICK_STATUS.dbl);
}

function handleHlClick(e) {
    const span = hlSpanFromEvent(e);

    if (!span) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Ha épp hosszú-nyomás zajlott le ezen a nyomáson, a click a gesztus
    // „elengedése" — ne nyisson popupot.
    if (hlLongPress?.fired) {
        cancelLongPress();

        return;
    }

    // A popupot késleltetjük: ha rögtön dupla-klikk jön, azt fenn elnyomjuk.
    cancelPendingClick();
    const rect = span.getBoundingClientRect();
    const word = span.textContent;
    hlPendingClick = {
        word,
        rect,
        timer: setTimeout(() => {
            hlPendingClick = null;
            showPopup(word, rect);
        }, CLICK_DELAY_MS),
    };
}

/**
 * Gyors státusz-állítás a kiemelt szóra (dupla-klikk / hosszú-nyomás). A háttér
 * egy körben elvégzi a lookupot és a státusz-állítást (toggle-szemantika), majd
 * frissítjük a kiemeléseket. Ismeretlen / nem menthető szónál röviden jelezzük.
 */
function quickStatusOnSpan(span, status) {
    const word = span.textContent;
    const rect = span.getBoundingClientRect();

    // Azonnali vizuális visszajelzés a gesztusról (a szerver válaszáig).
    flashSpan(span, STATUS_COLORS[status]);

    sendMsg({ type: 'QUICK_STATUS', word, status }, (resp) => {
        if (resp?.ok) {
            refreshVocabHighlights();

            return;
        }

        // Ismeretlen szó / hiba: nyíljon a szokásos popup, hogy a felhasználó
        // felvehesse / kezelhesse a szót (ne „némuljon el" a gesztus).
        showPopup(word, rect);
    });
}

/** Rövid keret-villanás a spanon, a gesztus visszaigazolásaként. */
function flashSpan(span, color) {
    if (!color) {
        return;
    }

    const prev = span.style.outline;
    span.style.outline = `2px solid ${color}`;
    setTimeout(() => {
        span.style.outline = prev;
    }, 400);
}

function toggleHighlight() {
    highlightEnabled = !highlightEnabled;
    storageSet({ hlEnabled: highlightEnabled });

    if (highlightEnabled) {
        loadAndApplyHighlights();
    } else {
        stopHlObserver();
        hlWordMap = null;
        removeHighlights();
    }

    return highlightEnabled;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Csak a saját bővítményünk üzeneteit dolgozzuk fel (popup / más content
    // script). A weboldal-eredetű üzeneteknek nincs sender.id-je, ezeket
    // eldobjuk — paritás a background üzenetkezelőjével (defense-in-depth).
    if (sender.id !== chrome.runtime.id) {
        return;
    }

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
