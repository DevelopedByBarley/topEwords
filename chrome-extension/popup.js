const APP_URL = 'https://topwords.eu';

chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' });

const STATUS_COLORS = {
    learning: '#3b82f6',
    saved: '#f97316',
    known: '#22c55e',
    pronunciation: '#8b5cf6',
    practice: '#f43f5e',
};
const STATUS_LABELS = {
    known: 'Tudom',
    learning: 'Tanulom',
    saved: 'Mentett',
    pronunciation: 'Kiejtés',
    practice: 'Gyakorlásra',
};

// ── Mac/Win gyorsbillentyű felirat ───────────────────────────────────────────
// A modál mindkét nyelvi blokkjában szerepel a módosító billentyű, ezért az
// összes előfordulást állítjuk.

const modifierKey = navigator.platform.includes('Mac') ? 'Option' : 'Alt';
document.querySelectorAll('.js-mod').forEach((el) => {
    el.textContent = modifierKey;
});

// ── Súgó-modál ───────────────────────────────────────────────────────────────

const infoOverlay = document.getElementById('info-overlay');

function setInfoOpen(open) {
    infoOverlay.hidden = !open;
}

document.getElementById('info-btn').addEventListener('click', () => setInfoOpen(true));
document.getElementById('info-link').addEventListener('click', () => setInfoOpen(true));
document.getElementById('info-close').addEventListener('click', () => setInfoOpen(false));

// Kattintás a sötétített háttérre (nem a kártyára) bezár.
infoOverlay.addEventListener('click', (e) => {
    if (e.target === infoOverlay) {
        setInfoOpen(false);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !infoOverlay.hidden) {
        setInfoOpen(false);
    }
});

// Nyelvváltó: a HU és EN blokk is a statikus HTML-ben van, csak láthatóságot váltunk.
document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;

        document.querySelectorAll('.lang-btn').forEach((other) => {
            other.classList.toggle('active', other === btn);
        });

        document.querySelectorAll('.lang-block').forEach((block) => {
            block.hidden = block.dataset.lang !== lang;
        });

        // A modál címe is kövesse a választott nyelvet.
        document.getElementById('info-title').textContent =
            lang === 'en' ? 'Help' : 'Súgó';
    });
});

// ── Bejelentkezés-állapot ────────────────────────────────────────────────────

fetch(`${APP_URL}/extension/lookup?word=the`, {
    credentials: 'include',
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
    },
})
    .then((r) => r.json())
    .then((data) => {
        if (data?.error === 'unauthenticated') {
            document.getElementById('login-banner').style.display = 'flex';
        }
    })
    .catch(() => {
        // Nincs kapcsolat — nem mutatunk bannert, a funkciók maguk jeleznek.
    });

// ── Szövegelemzés gomb ───────────────────────────────────────────────────────

document.getElementById('open-ta-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        const url =
            tab?.url && /^https?:/.test(tab.url)
                ? `${APP_URL}/text-analysis?url=${encodeURIComponent(tab.url)}`
                : `${APP_URL}/text-analysis`;
        chrome.tabs.create({ url });
    });
});

// ── Szókereső ────────────────────────────────────────────────────────────────
//
// A bővítmény EGYETLEN olyan keresője, amely minden lapon elérhető: nem content
// scriptből fut, hanem innen, a popupból hívja a szervert — így a böngésző saját
// lapjain is működik. Az 1.29 óta ez váltja ki az oldalankénti szókeresést.
//
// A találatokat DOM-API-val építjük (textContent), nem innerHTML-lel: a popup
// bővítmény-privilégiumú lap, a jelentés-szövegek pedig user-tartalmat is
// hordozhatnak (saját szavak), ezért ide nyers HTML nem kerülhet be.

const searchInput = document.getElementById('word-search');
const searchResults = document.getElementById('search-results');

let searchDebounce = null;
// A válaszok sorrendje nem garantált: csak a legutóbb indított kérés renderelhet,
// különben egy lassabb, korábbi keresés felülírná a frissebb találatokat.
let searchSeq = 0;

function searchMessage(text) {
    const el = document.createElement('div');
    el.className = 'search-msg';
    el.textContent = text;

    searchResults.replaceChildren(el);
}

function statusBadge(status) {
    const badge = document.createElement('span');
    badge.className = 'search-badge';
    badge.style.background = STATUS_COLORS[status];
    badge.textContent = STATUS_LABELS[status];

    return badge;
}

function searchResultItem(result) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'search-item';

    const main = document.createElement('div');
    main.className = 'search-main';

    const word = document.createElement('div');
    word.className = 'search-word';
    word.textContent = result.word ?? '';

    const meaning = document.createElement('div');
    meaning.className = 'search-meaning';
    meaning.textContent = result.meaning_hu ?? '';

    main.append(word, meaning);
    item.append(main);

    if (result.is_custom) {
        const badge = document.createElement('span');
        badge.className = 'search-badge custom';
        badge.textContent = 'saját';
        item.append(badge);
    }

    if (result.status && STATUS_LABELS[result.status]) {
        item.append(statusBadge(result.status));
    }

    item.addEventListener('click', () => openInTopWords(result.word ?? ''));

    return item;
}

function openInTopWords(word) {
    chrome.tabs.create({
        url: `${APP_URL}/words?search=${encodeURIComponent(word)}`,
    });
}

function renderSearchResults(results) {
    if (!results.length) {
        searchMessage('Nincs találat. Az Entert megnyomva a TopWords-ben keresheted tovább.');

        return;
    }

    searchResults.replaceChildren(...results.map(searchResultItem));
}

function runSearch(query) {
    const seq = ++searchSeq;

    fetch(`${APP_URL}/extension/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
        },
    })
        .then((r) => r.json().catch(() => null))
        .then((data) => {
            // Közben újabb keresés indult — ezt a választ eldobjuk.
            if (seq !== searchSeq) {
                return;
            }

            if (data?.error === 'unauthenticated') {
                searchMessage('Jelentkezz be a TopWords-be a kereséshez.');

                return;
            }

            if (!data || data.error) {
                searchMessage('Hiba történt — próbáld újra.');

                return;
            }

            renderSearchResults(data.results ?? []);
        })
        .catch(() => {
            if (seq === searchSeq) {
                searchMessage('Nincs kapcsolat a TopWords-szel.');
            }
        });
}

searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const query = searchInput.value.trim();

    if (!query) {
        // A futó kérés válasza se rendereljen az üres mező alá.
        searchSeq += 1;
        searchResults.replaceChildren();

        return;
    }

    searchMessage('Keresés…');
    searchDebounce = setTimeout(() => runSearch(query), 250);
});

// Enter: az első találat megnyitása; találat nélkül a szólista keresője nyílik meg,
// ahol a szó saját szóként is felvehető.
searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') {
        return;
    }

    const query = searchInput.value.trim();

    if (!query) {
        return;
    }

    const first = searchResults.querySelector('.search-item');

    if (first) {
        first.click();

        return;
    }

    openInTopWords(query);
});

searchInput.focus();
