const APP_URL = 'https://topwords.eu';

// ── Badge ─────────────────────────────────────────────────────────────────────

function refreshBadge() {
    fetch(`${APP_URL}/extension/badge`, {
        credentials: 'include',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
        },
    })
        .then((r) => r.json())
        .then(({ count }) => {
            chrome.action.setBadgeText({
                text: count > 0 ? String(count) : '',
            });
            chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
        })
        .catch(() => chrome.action.setBadgeText({ text: '' }));
}

// ── Státusz-cache ─────────────────────────────────────────────────────────────
// A szó→státusz térképet (GET_STATUSES) gyorsítótárazzuk, hogy az oldalkiemelés, a
// videófeliratok, a statisztika és a reconcile-tickek ne kérjék le minden alkalommal
// a szervertől. A cache a chrome.storage.local-ban él (túléli a service worker
// leállását is), egy memóriabeli másolattal a gyors elérésért. A szerver marad a
// forrás-igazság: minden sikeres írás (státuszváltás / új szó) érvényteleníti a
// cache-t, így a rá következő frissítés friss, teljes térképet tölt (a ragozott
// alakokkal együtt), TTL után pedig úgyis újratöltünk — így a más eszközön történt
// változások is bekerülnek.

const STATUS_CACHE_KEY = 'tw_statusCache';
const STATUS_CACHE_TTL = 5 * 60 * 1000; // 5 perc

// null = ismeretlen (a service worker most indult); egyébként { statuses, fetchedAt }.
// Érvénytelenítéskor „tombstone" kerül ide ({ statuses: null, fetchedAt: 0 }), hogy
// a memória maradjon a hiteles forrás, és ne olvassunk vissza elavult tárolt értéket.
let statusCacheMem = null;

function isFreshStatusCache(cache) {
    return Boolean(
        cache &&
        cache.statuses &&
        Date.now() - cache.fetchedAt < STATUS_CACHE_TTL,
    );
}

function readStatusCache() {
    if (statusCacheMem !== null) {
        return Promise.resolve(statusCacheMem);
    }

    return new Promise((resolve) => {
        chrome.storage.local.get({ [STATUS_CACHE_KEY]: null }, (data) => {
            statusCacheMem = data[STATUS_CACHE_KEY] ?? {
                statuses: null,
                fetchedAt: 0,
            };
            resolve(statusCacheMem);
        });
    });
}

function writeStatusCache(statuses) {
    statusCacheMem = { statuses, fetchedAt: Date.now() };
    chrome.storage.local.set({ [STATUS_CACHE_KEY]: statusCacheMem });
}

// Érvénytelenítés: a memóriát azonnal (szinkron) tombstone-ra állítjuk, hogy a
// közvetlenül ezután érkező GET_STATUSES már biztosan frisset töltsön, és a tárolóba
// is tombstone-t írunk a service worker újraindulás esetére.
function invalidateStatusCache() {
    statusCacheMem = { statuses: null, fetchedAt: 0 };
    chrome.storage.local.set({ [STATUS_CACHE_KEY]: statusCacheMem });
}

// Foltozás íráskor: a megváltozott szó felszíni alakjait helyben frissítjük a
// meglévő térképben, így a rákövetkező GET_STATUSES a memóriából szolgál ki, és
// NEM kell a teljes (akár több ezer soros) térképet újraletölteni — ez fogja
// vissza a szerverterhelést. Csak FRISS cache-t foltozunk: hideg/lejárt vagy üres
// cache-nél nincs mit foltozni (fél térképet írnánk), ezért invalidálunk, és a
// következő lekérés úgyis a teljes friss térképet tölti — vagyis nincs regresszió.
function patchStatusCache(forms, status) {
    if (!Array.isArray(forms) || forms.length === 0) {
        invalidateStatusCache();

        return Promise.resolve();
    }

    return readStatusCache().then((cache) => {
        if (!isFreshStatusCache(cache)) {
            invalidateStatusCache();

            return;
        }

        const next = { ...cache.statuses };

        for (const form of forms) {
            if (status) {
                next[form] = status;
            } else {
                delete next[form];
            }
        }

        writeStatusCache(next);
    });
}

// ── Context menus ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
    // removeAll előbb: frissítéskor/újratöltéskor elkerüli a "duplicate id" hibát.
    chrome.contextMenus.removeAll(() => {
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

    refreshBadge();
});

// Badge frissítése böngészőindításkor is (az onInstalled csak telepítéskor fut)
chrome.runtime.onStartup.addListener(refreshBadge);

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'lookup-word') {
        const word = (info.selectionText ?? '').trim().split(/\s+/)[0];

        if (!word) {
            return;
        }

        chrome.tabs.create({
            url: `${APP_URL}/words?search=${encodeURIComponent(word)}`,
        });
    }

    if (info.menuItemId === 'analyze-page') {
        if (!tab?.url) {
            return;
        }

        chrome.tabs.create({
            url: `${APP_URL}/text-analysis?url=${encodeURIComponent(tab.url)}`,
        });
    }
});

// ── Message handler (from content script) ────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Csak a saját extensionünk content scriptjeitől/popupjától fogadunk üzenetet
    // (defense-in-depth). Web-origin amúgy sem érheti el — nincs externally_connectable.
    if (sender.id !== chrome.runtime.id) {
        return;
    }

    if (msg.type === 'LOOKUP_WORD') {
        fetch(
            `${APP_URL}/extension/lookup?word=${encodeURIComponent(msg.word)}`,
            {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            },
        )
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
                Accept: 'application/json',
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
                status: msg.status,
                importance: msg.importance,
            }),
        })
            .then((r) => r.json())
            .then((data) => {
                // Új szó bekerült a szótárba — a térkép elavult, dobjuk a cache-t.
                if (data && data.ok) {
                    invalidateStatusCache();
                }

                sendResponse(data);
            })
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'SEARCH_WORD') {
        fetch(`${APP_URL}/extension/search?q=${encodeURIComponent(msg.q)}`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json',
            },
        })
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'GET_STATUSES') {
        const fetchFresh = () => {
            fetch(`${APP_URL}/extension/statuses`, {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            })
                .then((r) => r.json())
                .then((data) => {
                    if (data && data.statuses) {
                        writeStatusCache(data.statuses);
                    }

                    sendResponse(data);
                })
                .catch(() => sendResponse({ error: 'network' }));
        };

        // forceFresh: a fülre visszatéréskor (visibilitychange) megkerüljük a cache-t,
        // hogy a más eszközön/fülön végzett változások is azonnal látszódjanak.
        if (msg.forceFresh) {
            fetchFresh();

            return true;
        }

        readStatusCache().then((cache) => {
            if (isFreshStatusCache(cache)) {
                sendResponse({ statuses: cache.statuses });

                return;
            }

            fetchFresh();
        });

        return true;
    }

    if (msg.type === 'GET_YT_TRANSCRIPT') {
        fetch(
            `${APP_URL}/extension/youtube-transcript?v=${encodeURIComponent(msg.videoId)}`,
            {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            },
        )
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'UPDATE_STATUS') {
        const url = msg.is_custom
            ? `${APP_URL}/custom-words/${msg.id}/status`
            : `${APP_URL}/words/${msg.id}/status`;

        const body = msg.status
            ? JSON.stringify({ status: msg.status })
            : JSON.stringify({ status: '' });

        fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': msg.csrf,
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json',
            },
            body,
        })
            .then(async (r) => {
                if (!r.ok) {
                    sendResponse({ ok: false });

                    return;
                }

                // A válasz tartalmazza a megváltozott szó összes felszíni alakját;
                // ezekkel helyben foltozzuk a cache-t (await: a content script
                // rákövetkező GET_STATUSES-e már a friss térképet lássa), így a
                // teljes újraletöltés elmarad.
                const data = await r.json().catch(() => ({}));
                await patchStatusCache(data.forms, data.status ?? null);
                refreshBadge();

                sendResponse({ ok: true, status: data.status ?? null });
            })
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'UPDATE_IMPORTANCE') {
        const url = msg.is_custom
            ? `${APP_URL}/custom-words/${msg.id}/importance`
            : `${APP_URL}/words/${msg.id}/importance`;

        fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': msg.csrf,
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json',
            },
            body: JSON.stringify({ importance: msg.importance ?? null }),
        })
            .then((r) => sendResponse({ ok: r.ok }))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'GET_DECKS') {
        fetch(`${APP_URL}/extension/decks`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json',
            },
        })
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'CREATE_FLASHCARD') {
        fetch(`${APP_URL}/extension/create-flashcard`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': msg.csrf,
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json',
            },
            body: JSON.stringify(msg.card),
        })
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'GEMINI_FLASHCARD') {
        fetch(
            `${APP_URL}/text-analysis/gemini-flashcard?word=${encodeURIComponent(msg.word)}`,
            {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            },
        )
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'GEMINI_LOOKUP') {
        fetch(
            `${APP_URL}/text-analysis/gemini-lookup?word=${encodeURIComponent(msg.word)}`,
            {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            },
        )
            .then((r) => r.json())
            .then((data) => sendResponse(data))
            .catch(() => sendResponse({ error: 'network' }));

        return true;
    }

    if (msg.type === 'REFRESH_BADGE') {
        refreshBadge();
    }
});
