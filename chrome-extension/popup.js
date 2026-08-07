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

// A session-CSRF-token a szerver olvasó válaszaiból jön (lookup / search), és a
// státusz/fontosság mentéséhez kell. Két helyen frissül, ezért itt, közösen áll.
let csrfToken = null;

function sendMsg(msg, callback) {
    try {
        chrome.runtime.sendMessage(msg, (response) => {
            if (chrome.runtime.lastError) {
                callback({ error: 'network' });

                return;
            }

            callback(response);
        });
    } catch {
        callback({ error: 'network' });
    }
}

// A content scriptek extErrorMessage-ével azonos szövegek (src/shared.js) — a
// popup nem tölti be azt a modult, ezért itt külön áll.
function errorMessage(error, fallback) {
    const messages = {
        network: 'Nincs kapcsolat a TopWords-szel.',
        unauthenticated: 'Jelentkezz be a TopWords-be.',
        unverified: 'Erősítsd meg az e-mail-címed a TopWords-en a mentéshez.',
        csrf: 'A munkameneted lejárt — jelentkezz be újra a TopWords-be.',
        rate_limit: 'Túl sok kérés — várj egy kicsit, és próbáld újra.',
        plan: 'Elérted a bővítmény napi ingyenes keretét — holnap folytathatod.',
    };

    return messages[error] ?? fallback;
}

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
        if (data?.csrf) {
            csrfToken = data.csrf;
        }

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
// A találat lenyitható: alatta a jelentés és a példamondat, plusz a státusz-
// gombok és a fontosság-csillagok — ezek a gyakori, egykattintásos műveletek itt
// elvégezhetők, weboldalra átlépés nélkül.
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

// A találatlistát mindig ezen keresztül írjuk felül: az előző elemek eltűnnek,
// így nem maradhat „nyitva" egy már törölt találat.
function setSearchResults(...nodes) {
    closeOpenResult = null;
    searchResults.replaceChildren(...nodes);
}

function searchMessage(text) {
    const el = document.createElement('div');
    el.className = 'search-msg';
    el.textContent = text;

    setSearchResults(el);
}

function statusBadge(status) {
    const badge = document.createElement('span');
    badge.className = 'search-badge';
    badge.style.background = STATUS_COLORS[status];
    badge.textContent = STATUS_LABELS[status];

    return badge;
}

function detailText(className, text) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;

    return el;
}

// Egyszerre egy találat van nyitva: a 300 px-es panel különben átláthatatlanul
// elnyúlna. Itt a nyitott találat becsukó függvénye áll (null = nincs nyitva).
let closeOpenResult = null;

// Egyszerre csak egy státusz-mentés futhat. A gyors, egymás utáni kattintások
// különben átfedő kéréseket indítanának — ugyanaz a zár, mint a felirat-popupban.
let statusSaveInFlight = false;

/**
 * Egy találat sora a lenyitható részletezővel: jelentés, példamondat, az 5
 * státusz-gomb és a fontosság-csillagok. Ezek a gyakori, egykattintásos
 * műveletek — a weboldalra átlépés nélkül elvégezhetők. Minden megjelenített
 * adat a keresés válaszából jön, ezért a lenyitás nem indít újabb kérést.
 */
function searchResultItem(result) {
    const row = document.createElement('div');
    row.className = 'search-row';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'search-item';
    head.setAttribute('aria-expanded', 'false');

    const main = document.createElement('div');
    main.className = 'search-main';

    const word = document.createElement('div');
    word.className = 'search-word';
    word.textContent = result.word ?? '';

    const meaning = document.createElement('div');
    meaning.className = 'search-meaning';
    meaning.textContent = result.meaning_hu ?? '';

    main.append(word, meaning);

    // A jelölések a mentés után újrarajzolódnak, ezért külön konténerben állnak.
    const badges = document.createElement('span');
    badges.className = 'search-badges';

    const chevron = document.createElement('span');
    chevron.className = 'search-chev';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '▾';

    head.append(main, badges, chevron);

    const detail = document.createElement('div');
    detail.className = 'search-detail';
    detail.hidden = true;

    const error = detailText('detail-error', '');
    error.hidden = true;

    function paintBadges() {
        badges.replaceChildren();

        if (result.is_custom) {
            const custom = document.createElement('span');
            custom.className = 'search-badge custom';
            custom.textContent = 'saját';
            badges.append(custom);
        }

        if (result.status && STATUS_LABELS[result.status]) {
            badges.append(statusBadge(result.status));
        }
    }

    function showError(message) {
        error.textContent = message;
        error.hidden = false;
    }

    // ── Jelentés és példa ────────────────────────────────────────────────────
    //
    // A fő jelentés a sorban áll (lenyitva teljes terjedelmében látszik, lásd a
    // .search-row.open szabályt), ezért a panel csak a többletet mutatja.

    if (result.extra_meanings) {
        detail.append(detailText('detail-extra', result.extra_meanings));
    }

    if (result.synonyms) {
        detail.append(detailText('detail-synonyms', `≈ ${result.synonyms}`));
    }

    if (result.example_en) {
        const example = document.createElement('div');
        example.className = 'detail-example';
        example.append(detailText('example-en', `„${result.example_en}”`));

        if (result.example_hu) {
            example.append(detailText('example-hu', `„${result.example_hu}”`));
        }

        detail.append(example);
    }

    // ── Státusz ─────────────────────────────────────────────────────────────

    const statusRow = document.createElement('div');
    statusRow.className = 'status-row';

    const statusButtons = Object.entries(STATUS_LABELS).map(([status, label]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'status-btn';
        btn.textContent = label;
        btn.addEventListener('click', () => saveStatus(status));

        return { status, btn };
    });

    function paintStatus() {
        statusButtons.forEach(({ status, btn }) => {
            const isActive = result.status === status;

            btn.classList.toggle('active', isActive);
            btn.style.background = isActive ? STATUS_COLORS[status] : '';
            btn.style.borderColor = isActive ? STATUS_COLORS[status] : '';
            btn.style.color = isActive ? '#fff' : '';
        });
    }

    // A szerver toggle-szemantikája: az aktív státusz újraküldése levétel.
    function saveStatus(status) {
        if (statusSaveInFlight) {
            return;
        }

        const previous = result.status ?? null;
        const next = previous === status ? null : status;

        result.status = next;
        paintStatus();
        paintBadges();
        error.hidden = true;

        statusSaveInFlight = true;
        statusRow.classList.add('saving');

        sendMsg(
            {
                type: 'UPDATE_STATUS',
                id: result.id,
                is_custom: result.is_custom,
                status: next,
                csrf: csrfToken,
            },
            (response) => {
                statusSaveInFlight = false;
                statusRow.classList.remove('saving');

                if (response?.ok) {
                    return;
                }

                // Sikertelen mentés → az előző állapot visszaállítása.
                result.status = previous;
                paintStatus();
                paintBadges();
                showError(
                    errorMessage(
                        response?.error,
                        'Nem sikerült menteni — próbáld újra.',
                    ),
                );
            },
        );
    }

    statusRow.append(...statusButtons.map(({ btn }) => btn));

    // ── Fontosság ───────────────────────────────────────────────────────────

    const importanceRow = document.createElement('div');
    importanceRow.className = 'importance-row';

    const stars = [1, 2, 3, 4, 5].map((value) => {
        const star = document.createElement('button');
        star.type = 'button';
        star.className = 'imp-star';
        star.textContent = '★';
        star.setAttribute('aria-label', `${value} csillag`);
        star.addEventListener('click', () => saveImportance(value));

        return { value, star };
    });

    function paintStars() {
        stars.forEach(({ value, star }) => {
            star.classList.toggle('on', value <= (result.importance ?? 0));
        });
    }

    function saveImportance(value) {
        const previous = result.importance ?? null;
        const next = previous === value ? null : value;

        result.importance = next;
        paintStars();
        error.hidden = true;

        sendMsg(
            {
                type: 'UPDATE_IMPORTANCE',
                id: result.id,
                is_custom: result.is_custom,
                importance: next,
                csrf: csrfToken,
            },
            (response) => {
                if (response?.ok) {
                    // A szerver a még nem jelölt szót a csillagozáskor 'known'
                    // státusszal veszi fel (a webes felülettel egyezően), ezért a
                    // gombok és a fejléc-jelölés is kövesse — különben a panel
                    // mást mutatna, mint ami mentődött. Saját szónál a fontosság
                    // önmagában áll, ott nincs ilyen mellékhatás.
                    if (!result.is_custom && next !== null && result.status === null) {
                        result.status = 'known';
                        paintStatus();
                        paintBadges();
                    }

                    return;
                }

                result.importance = previous;
                paintStars();
                showError(
                    errorMessage(
                        response?.error,
                        'Nem sikerült menteni — próbáld újra.',
                    ),
                );
            },
        );
    }

    importanceRow.append(...stars.map(({ star }) => star));

    const openLink = document.createElement('a');
    openLink.className = 'detail-open';
    openLink.href = `${APP_URL}/words?search=${encodeURIComponent(result.word ?? '')}`;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = 'Megnyitás a TopWords-ben →';

    detail.append(
        detailText('detail-label', 'Státusz'),
        statusRow,
        detailText('detail-label', 'Fontosság'),
        importanceRow,
        error,
        openLink,
    );

    function setOpen(open) {
        detail.hidden = !open;
        row.classList.toggle('open', open);
        head.setAttribute('aria-expanded', String(open));
    }

    head.addEventListener('click', () => {
        const open = detail.hidden;

        if (closeOpenResult) {
            closeOpenResult();
        }

        setOpen(open);
        closeOpenResult = open ? () => setOpen(false) : null;

        if (open) {
            row.scrollIntoView({ block: 'nearest' });
        }
    });

    paintBadges();
    paintStatus();
    paintStars();
    row.append(head, detail);

    return row;
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

    setSearchResults(...results.map(searchResultItem));
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

            // A státusz/fontosság mentése ezzel a tokennel megy ki.
            if (data.csrf) {
                csrfToken = data.csrf;
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
        setSearchResults();

        return;
    }

    searchMessage('Keresés…');
    searchDebounce = setTimeout(() => runSearch(query), 250);
});

// Enter: az első találat lenyitása (ugyanaz, mint a kattintás); találat nélkül a
// szólista keresője nyílik meg, ahol a szó saját szóként is felvehető.
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
