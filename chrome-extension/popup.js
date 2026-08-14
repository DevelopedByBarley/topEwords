const APP_URL = 'https://topwords.eu';

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
// A weboldal POS_LABELS térképével azonos (components/words/types.ts): a szó-
// részletező ugyanazokat a szófaj-címkéket mutassa a panelben, mint az appban.
const POS_LABELS = {
    verb: 'ige',
    noun: 'főnév',
    adj: 'melléknév',
    adv: 'határozószó',
    prep: 'elöljáró',
    conj: 'kötőszó',
    det: 'névelő',
    pron: 'névmás',
    num: 'számnév',
    interj: 'indulatszó',
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

// Az AI-válaszok szerveroldalon cache-eltek, így egy cache-találat szinte
// azonnal visszatér — annyira gyorsan, hogy látszik, nem futott valódi modell.
// Ez a min. késleltetés ott tartja a töltő állapotot. (Másolat: src/shared.js —
// a popup nem tölti be a content script moduljait.)
function sendMsgMinDelay(msg, ms, callback) {
    const start = Date.now();

    sendMsg(msg, (response) => {
        setTimeout(() => callback(response), Math.max(0, ms - (Date.now() - start)));
    });
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

// A navigator.platform elavult, de a userAgentData nem mindenhol elérhető
// (és Chrome-on kívül sem garantált), ezért az új API-t próbáljuk előbb, és
// csak utána esünk vissza a régire.
const isMac = navigator.userAgentData
    ? navigator.userAgentData.platform === 'macOS'
    : navigator.platform.includes('Mac');
const modifierKey = isMac ? 'Option' : 'Alt';
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
        // A szerver egyáltalán nem válaszol (hálózati hiba, tűzfal, leállás).
        // Korábban ez az ág néma volt, és a popup üresen indult: a kereső nem
        // adott találatot, de semmi nem mondta meg, miért. Kimondjuk az okot,
        // különben törött bővítménynek látszik.
        document.getElementById('offline-banner').style.display = 'flex';
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

/**
 * Egy szóalak-cella: fölül halvány címke, alatta maga az alak.
 */
function formCell(label, value) {
    const cell = document.createElement('div');
    cell.className = 'form-cell';
    cell.append(
        detailText('form-cell-label', label),
        detailText('form-cell-value', value),
    );

    return cell;
}

/**
 * Szóalak-blokk a webes szó-részletező mintájára (Igealakok / Többes szám /
 * Fokozás). Csak a kitöltött alakok kerülnek bele. A `arrows` elrendezés a
 * képzés irányát mutatja (alap → képzett alak), a rácsos a párhuzamos alakokat
 * — utóbbi a 300 px-es panelen kétoszlopos, szemben a weboldal háromoszloposával.
 *
 * A `/`-szeparált változatokat (pl. „got/gotten") nyersen jelenítjük meg, épp
 * úgy, ahogy a weboldal — így a két felület ugyanazt mutatja.
 */
function formBlock(title, entries, { arrows = false } = {}) {
    const body = document.createElement('div');
    body.className = arrows ? 'form-arrows' : 'form-grid';

    entries
        .filter(([, value]) => value)
        .forEach(([label, value], index) => {
            if (arrows && index > 0) {
                const separator = detailText('form-arrow', '→');
                separator.setAttribute('aria-hidden', 'true');
                body.append(separator);
            }

            body.append(formCell(label, value));
        });

    const block = document.createElement('div');
    block.className = 'detail-forms';
    block.append(detailText('detail-label', title), body);

    return block;
}

// Egyszerre egy találat van nyitva: a 300 px-es panel különben átláthatatlanul
// elnyúlna. Itt a nyitott találat becsukó függvénye áll (null = nincs nyitva).
let closeOpenResult = null;

// Egyszerre csak egy státusz-mentés futhat. A gyors, egymás utáni kattintások
// különben átfedő kéréseket indítanának — ugyanaz a zár, mint a felirat-popupban.
let statusSaveInFlight = false;

// A keresés válaszából frissülő jogosultságok. Csak a FELÜLET igazodik hozzájuk
// (mit mutatunk meg) — a tényleges kaput mindig a szerver adja: a felvitel a
// verified + throttle:ext-write + canWriteFromExtension() hármason, az AI-hívás
// a throttle:ta-ai + ai.budget middleware-en megy át.
let searchCanWrite = false;
let searchHasAi = false;

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

    // Gyakorisági rang, szófaj, rendhagyóság — ugyanaz a három jelölő, mint a
    // webes szó-részletező fejlécében. Saját szónál nincs rang.
    const meta = document.createElement('div');
    meta.className = 'detail-meta';

    if (result.rank) {
        meta.append(detailText('detail-chip', `#${result.rank}`));
    }

    if (result.part_of_speech) {
        meta.append(
            detailText(
                'detail-chip pos',
                POS_LABELS[result.part_of_speech] ?? result.part_of_speech,
            ),
        );
    }

    if (result.is_irregular) {
        meta.append(detailText('detail-chip irregular', 'rendhagyó'));
    }

    if (meta.childElementCount) {
        detail.append(meta);
    }

    if (result.extra_meanings) {
        detail.append(detailText('detail-extra', result.extra_meanings));
    }

    if (result.synonyms) {
        const synonyms = document.createElement('div');
        synonyms.className = 'detail-synonyms';
        synonyms.append(
            ...result.synonyms
                .split(',')
                .map((synonym) => synonym.trim())
                .filter(Boolean)
                .map((synonym) => detailText('synonym-chip', synonym)),
        );

        detail.append(synonyms);
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

    // ── Szóalakok ───────────────────────────────────────────────────────────
    //
    // Ugyanaz a három blokk, mint a webes szó-részletezőben, és ugyanazzal a
    // feltétellel: a szófajtól FÜGGETLENÜL látszik, ha a szó hordozza az alakot
    // (pl. az „interest" főnév is, ige is). Az alakok a keresés válaszával
    // együtt érkeznek, ezért ez sem indít újabb kérést.

    const baseForm = result.form_base || result.word || '';

    if (result.verb_past) {
        detail.append(
            formBlock('Igealakok', [
                ['Alap', baseForm],
                ['Múlt idő', result.verb_past],
                ['Befejezett igenév', result.verb_past_participle],
                ['Folyamatos (-ing)', result.verb_present_participle],
                ['E/3 jelen', result.verb_third_person],
            ]),
        );
    }

    if (result.noun_plural) {
        detail.append(
            formBlock(
                'Többes szám',
                [
                    ['Egyes szám', baseForm],
                    ['Többes szám', result.noun_plural],
                ],
                { arrows: true },
            ),
        );
    }

    if (result.adj_comparative) {
        detail.append(
            formBlock(
                'Fokozás',
                [
                    ['Alapfok', baseForm],
                    ['Középfok', result.adj_comparative],
                    ['Felsőfok', result.adj_superlative],
                ],
                { arrows: true },
            ),
        );
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
            // A szóalak-blokkokkal a nyitott találat magasabb, mint a lista
            // látható sávja, ezért a tetejére görgetünk (a 'nearest' csak az
            // alját hozná be, és a szó maga kicsúszna felül).
            row.scrollIntoView({ block: 'start' });
        }
    });

    paintBadges();
    paintStatus();
    paintStars();
    row.append(head, detail);

    return row;
}

// ── Felvitel új szóként ──────────────────────────────────────────────────────
//
// Ha a keresés nem hozott PONTOS találatot, a lista végén felajánljuk a beírt
// szó felvitelét saját szóként. A mezőkészlet és a viselkedés a felirat-kereső
// űrlapjáéval azonos (src/search-modal.js), csak DOM-API-val építve — a popup
// bővítmény-privilégiumú lap, ide nyers HTML nem kerülhet.

function formField(placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input';
    input.placeholder = placeholder;

    return input;
}

function formRow(...fields) {
    const row = document.createElement('div');
    row.className = 'form-row';
    row.append(...fields);

    return row;
}

/**
 * Szófaj-specifikus alak-blokk. Alapból rejtett: a `updateFormSections()`
 * nyitja ki, ha az adott szófaj van kiválasztva vagy a „További alakok" be van
 * kapcsolva.
 */
function formSection(label, ...fields) {
    const section = document.createElement('div');
    section.className = 'form-section';
    section.hidden = true;
    section.append(detailText('form-section-label', label), ...fields);

    return section;
}

/**
 * Helyi státusz-választó a felviteli űrlaphoz: nem ment azonnal, az értéket a
 * „Hozzáadás" viszi el. (A találat-panel státusz-sora ezzel szemben minden
 * kattintásra menteni akar, ezért ott külön kód áll.)
 */
function statusPicker(initial) {
    const row = document.createElement('div');
    row.className = 'status-row';

    let selected = initial;

    const buttons = Object.entries(STATUS_LABELS).map(([status, label]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'status-btn';
        btn.textContent = label;
        btn.addEventListener('click', () => {
            selected = selected === status ? null : status;
            paint();
        });

        return { status, btn };
    });

    function paint() {
        buttons.forEach(({ status, btn }) => {
            const isActive = selected === status;

            btn.classList.toggle('active', isActive);
            btn.style.background = isActive ? STATUS_COLORS[status] : '';
            btn.style.borderColor = isActive ? STATUS_COLORS[status] : '';
            btn.style.color = isActive ? '#fff' : '';
        });
    }

    row.append(...buttons.map(({ btn }) => btn));
    paint();

    return {
        row,
        get value() {
            return selected;
        },
    };
}

/** Helyi fontosság-választó a felviteli űrlaphoz — lásd statusPicker(). */
function importancePicker() {
    const row = document.createElement('div');
    row.className = 'importance-row';

    let selected = null;

    const stars = [1, 2, 3, 4, 5].map((value) => {
        const star = document.createElement('button');
        star.type = 'button';
        star.className = 'imp-star';
        star.textContent = '★';
        star.setAttribute('aria-label', `${value} csillag`);
        star.addEventListener('click', () => {
            selected = selected === value ? null : value;
            paint();
        });

        return { value, star };
    });

    function paint() {
        stars.forEach(({ value, star }) => {
            star.classList.toggle('on', value <= (selected ?? 0));
        });
    }

    row.append(...stars.map(({ star }) => star));

    return {
        row,
        get value() {
            return selected;
        },
    };
}

/**
 * Az AI-tartalom mellett kötelező tájékoztató — a content scriptek
 * AI_DISCLAIMER_HTML-jével azonos szöveg (src/shared.js).
 */
function aiDisclaimer() {
    const note = document.createElement('div');
    note.className = 'ai-note';

    const terms = document.createElement('a');
    terms.href = `${APP_URL}/terms`;
    terms.target = '_blank';
    terms.rel = 'noopener noreferrer';
    terms.textContent = 'ÁSZF';

    note.append(
        document.createTextNode(
            '✨ A tartalmat külső AI-szolgáltató (Google Gemini) generálta. Az AI ' +
                'tévedhet — mentés előtt ellenőrizd. A TopWords a generált tartalom ' +
                'helyességéért felelősséget nem vállal. ',
        ),
        terms,
    );

    return note;
}

function upgradeHint() {
    const hint = document.createElement('a');
    hint.className = 'upgrade-hint';
    hint.href = `${APP_URL}/pricing`;
    hint.target = '_blank';
    hint.rel = 'noopener noreferrer';
    hint.textContent =
        '🔒 Elérted a bővítmény napi ingyenes keretét — holnap folytathatod, vagy válts Prora →';

    return hint;
}

/**
 * A lista végén álló „felvitel új szóként" sor. Ugyanúgy lenyitható, mint egy
 * találat, de a panelben űrlap áll: szófaj, jelentések, példamondatok, a három
 * alak-blokk, státusz és fontosság — opcionális AI-kitöltéssel.
 */
function addWordItem(query) {
    // A felvett szó. Az AI lemmatizálhatja (pl. „helped" → „help"); ilyenkor
    // erre áll át, az eredeti alak pedig extra_forms-ként megy el, hogy a
    // szó-felismerés arra is találjon.
    let word = query;
    let extraForm = null;

    const row = document.createElement('div');
    row.className = 'search-row';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'search-item';
    head.setAttribute('aria-expanded', 'false');

    const wordText = detailText('search-word', word);
    const subtitle = detailText('search-meaning', 'Felvitel saját szóként');

    const main = document.createElement('div');
    main.className = 'search-main';
    main.append(wordText, subtitle);

    const badges = document.createElement('span');
    badges.className = 'search-badges';
    badges.append(detailText('search-badge new', 'új'));

    const chevron = detailText('search-chev', '▾');
    chevron.setAttribute('aria-hidden', 'true');

    head.append(main, badges, chevron);

    const detail = document.createElement('div');
    detail.className = 'search-detail';
    detail.hidden = true;

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
            row.scrollIntoView({ block: 'start' });
        }
    });

    row.append(head, detail);

    // Betelt napi keret: a felvitel ilyenkor nem megy, a szerver 403-mal
    // utasítaná el — űrlap helyett csak a keret-hint jelenik meg.
    if (!searchCanWrite) {
        detail.append(upgradeHint());

        return row;
    }

    const feedback = detailText('add-feedback', '');
    feedback.hidden = true;

    function showFeedback(text, tone) {
        feedback.textContent = text;
        feedback.className = `add-feedback ${tone}`;
        feedback.hidden = false;
    }

    // ── Mezők ───────────────────────────────────────────────────────────────

    const posSelect = document.createElement('select');
    posSelect.className = 'form-input';
    posSelect.append(
        new Option('Szófaj (opcionális)', ''),
        ...Object.entries(POS_LABELS).map(([value, label]) => new Option(label, value)),
    );

    const meaningField = formField('Magyar jelentés');
    const extraField = formField('További jelentések');
    const synonymsField = formField('Szinonimák (pl. consent, accept)');
    const exampleEnField = formField('Példamondat (angol)');
    const exampleHuField = formField('Példamondat (magyar)');

    const formBaseField = formField('Alap (to ...)');
    const verbPastField = formField('Múlt idő');
    const verbParticipleField = formField('Bef. igenév');
    const verbProgressiveField = formField('Folyamatos (-ing)');
    const verbThirdField = formField('E/3 jelen');

    const irregularCheck = document.createElement('input');
    irregularCheck.type = 'checkbox';

    const irregularLabel = document.createElement('label');
    irregularLabel.className = 'form-check';
    irregularLabel.append(irregularCheck, document.createTextNode(' Rendhagyó ige'));

    const verbSection = formSection(
        'Igealakok',
        formRow(formBaseField, verbPastField),
        formRow(verbParticipleField, verbProgressiveField),
        verbThirdField,
        irregularLabel,
    );

    const nounPluralField = formField('Többes szám');
    const nounSection = formSection('Főnév', nounPluralField);

    const adjComparativeField = formField('Középfok');
    const adjSuperlativeField = formField('Felsőfok');
    const adjSection = formSection('Fokozás', formRow(adjComparativeField, adjSuperlativeField));

    // Egy szó több szófaj alakjait is hordozhatja (pl. „interest" → főnév +
    // igealakok), mert a szó-felismerés a szófajtól függetlenül mind a kilenc
    // alak-oszlopot olvassa. Az elsődleges szófaj blokkja mindig látszik; a
    // többit a „További alakok" kapcsoló nyitja ki.
    let showOtherForms = false;

    function updateFormSections() {
        const pos = posSelect.value;

        verbSection.hidden = !(pos === 'verb' || showOtherForms);
        nounSection.hidden = !(pos === 'noun' || showOtherForms);
        adjSection.hidden = !(pos === 'adj' || showOtherForms);
    }

    posSelect.addEventListener('change', updateFormSections);

    const otherChevron = detailText('form-toggle-chev', '▾');
    otherChevron.setAttribute('aria-hidden', 'true');

    const otherToggle = document.createElement('button');
    otherToggle.type = 'button';
    otherToggle.className = 'form-toggle';
    otherToggle.append(otherChevron, document.createTextNode('További alakok (más szófaj)'));
    otherToggle.addEventListener('click', () => {
        showOtherForms = !showOtherForms;
        otherChevron.classList.toggle('open', showOtherForms);
        updateFormSections();
    });

    const fields = document.createElement('div');
    fields.className = 'form-fields';
    fields.append(
        posSelect,
        meaningField,
        extraField,
        synonymsField,
        exampleEnField,
        exampleHuField,
        verbSection,
        nounSection,
        adjSection,
        otherToggle,
    );

    detail.append(fields);

    // ── AI-kitöltés ─────────────────────────────────────────────────────────

    if (searchHasAi) {
        const aiButton = document.createElement('button');
        aiButton.type = 'button';
        aiButton.className = 'ai-fill-btn';
        aiButton.textContent = '✨ AI kitöltés';

        aiButton.addEventListener('click', () => {
            aiButton.disabled = true;
            aiButton.textContent = '⏳ Töltés…';
            feedback.hidden = true;

            sendMsgMinDelay({ type: 'GEMINI_LOOKUP', word }, 2000, (response) => {
                aiButton.disabled = false;
                aiButton.textContent = '✨ AI kitöltés';

                if (response?.error === 'ai_limit') {
                    showFeedback(
                        response.message ?? 'Elérted a havi AI-felhasználási kereted.',
                        'warn',
                    );

                    return;
                }

                if (!response || response.error) {
                    showFeedback(
                        errorMessage(
                            response?.error,
                            'Az AI-kitöltés nem sikerült — próbáld újra.',
                        ),
                        'warn',
                    );

                    return;
                }

                // Az AI nem létező szónak ítélte (elgépelés / halandzsa).
                if (response.is_real_word === false) {
                    showFeedback(
                        response.message ??
                            'Ez nem tűnik valódi angol szónak. Ellenőrizd a helyesírást.',
                        'warn',
                    );

                    return;
                }

                // A beírt szó ragozott alak volt: az AI az alapszóra
                // lemmatizált, és minden mezőt arra töltött ki.
                if (response.normalized_from_input) {
                    const original = word;

                    word = response.base_form;
                    extraForm = original;
                    wordText.textContent = word;
                    showFeedback(
                        `A(z) „${original}" a(z) „${word}" ragozott alakja — az alapszóból indultunk ki.`,
                        'info',
                    );
                }

                const setValue = (field, value) => {
                    if (value) {
                        field.value = value;
                    }
                };

                const pos = response.part_of_speech ?? '';

                if (pos) {
                    posSelect.value = pos;
                }

                setValue(meaningField, response.meaning_hu);
                setValue(extraField, response.extra_meanings);
                setValue(synonymsField, response.synonyms);
                setValue(exampleEnField, response.example_en);
                setValue(exampleHuField, response.example_hu);

                // Minden visszakapott alakot kitöltünk, a szófajtól függetlenül.
                setValue(verbPastField, response.verb_past);
                setValue(verbParticipleField, response.verb_past_participle);
                setValue(verbProgressiveField, response.verb_present_participle);
                setValue(verbThirdField, response.verb_third_person);
                setValue(nounPluralField, response.noun_plural);
                setValue(adjComparativeField, response.adj_comparative);
                setValue(adjSuperlativeField, response.adj_superlative);
                irregularCheck.checked = Boolean(response.is_irregular);

                // Ha az elsődleges szófajon kívüli alak is érkezett, nyissuk ki
                // a „További alakok" szekciót, hogy a felhasználó lássa.
                const filledOther =
                    (pos !== 'verb' &&
                        (response.verb_past ||
                            response.verb_past_participle ||
                            response.verb_present_participle ||
                            response.verb_third_person)) ||
                    (pos !== 'noun' && response.noun_plural) ||
                    (pos !== 'adj' && (response.adj_comparative || response.adj_superlative));

                if (filledOther && !showOtherForms) {
                    showOtherForms = true;
                    otherChevron.classList.add('open');
                }

                updateFormSections();
            });
        });

        const aiRow = document.createElement('div');
        aiRow.className = 'ai-row';
        aiRow.append(aiButton);

        detail.prepend(aiRow);
        detail.append(aiDisclaimer());
    }

    // ── Státusz, fontosság, mentés ──────────────────────────────────────────

    const status = statusPicker('known');
    const importance = importancePicker();

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'add-btn';
    addButton.textContent = 'Hozzáadás';

    addButton.addEventListener('click', () => {
        const meaning = meaningField.value.trim();

        // A jelentés kötelező — a szerver is elutasítaná üresen.
        if (!meaning) {
            showFeedback('A magyar jelentés megadása kötelező.', 'warn');
            meaningField.focus();

            return;
        }

        addButton.disabled = true;
        addButton.textContent = '…';

        const trimmed = (field) => field.value.trim() || null;

        sendMsg(
            {
                type: 'ADD_WORD',
                csrf: csrfToken,
                word,
                meaning_hu: meaning,
                extra_meanings: trimmed(extraField),
                synonyms: trimmed(synonymsField),
                part_of_speech: posSelect.value || null,
                example_en: trimmed(exampleEnField),
                example_hu: trimmed(exampleHuField),
                form_base: trimmed(formBaseField),
                verb_past: trimmed(verbPastField),
                verb_past_participle: trimmed(verbParticipleField),
                verb_present_participle: trimmed(verbProgressiveField),
                verb_third_person: trimmed(verbThirdField),
                is_irregular: irregularCheck.checked,
                noun_plural: trimmed(nounPluralField),
                adj_comparative: trimmed(adjComparativeField),
                adj_superlative: trimmed(adjSuperlativeField),
                extra_forms: extraForm,
                status: status.value,
                importance: importance.value,
            },
            (response) => {
                if (response?.ok) {
                    // A szó bekerült — az űrlapnak nincs többé dolga, csak a
                    // visszajelzés marad. (A sor fejléce a felvett — esetleg
                    // lemmatizált — alakot mutatja.)
                    subtitle.textContent = 'Hozzáadva a saját szavaidhoz';
                    detail.replaceChildren(feedback);
                    showFeedback(`„${word}" hozzáadva!`, 'ok');

                    return;
                }

                addButton.disabled = false;
                addButton.textContent = 'Hozzáadás';

                if (response?.error === 'duplicate') {
                    showFeedback('Már szerepel a saját szavaid között.', 'warn');

                    return;
                }

                showFeedback(
                    errorMessage(response?.error, 'Nem sikerült menteni — próbáld újra.'),
                    'error',
                );
            },
        );
    });

    detail.append(
        detailText('detail-label', 'Státusz'),
        status.row,
        detailText('detail-label', 'Fontosság'),
        importance.row,
        addButton,
        feedback,
    );

    return row;
}

function openInTopWords(word) {
    chrome.tabs.create({
        url: `${APP_URL}/words?search=${encodeURIComponent(word)}`,
    });
}

function renderSearchResults(results, query) {
    const nodes = results.map(searchResultItem);

    // A felvitelt csak akkor ajánljuk fel, ha a beírt szó PONTOSAN nincs a
    // találatok között — a prefix-egyezés (pl. „goo" → „good, goose") nem
    // számít találatnak arra, amit a felhasználó beírt.
    const lower = query.toLowerCase();
    const exactMatch = results.some((result) => (result.word ?? '').toLowerCase() === lower);

    if (!exactMatch) {
        if (!results.length) {
            nodes.push(detailText('search-msg', 'Nincs találat a szótárban.'));
        }

        nodes.push(addWordItem(query));
    }

    setSearchResults(...nodes);
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

            // A státusz/fontosság mentése és a felvitel ezzel a tokennel megy ki.
            if (data.csrf) {
                csrfToken = data.csrf;
            }

            searchCanWrite = data.can_write === true;
            // Az adminnak a webes felületen is jár az AI, keret nélkül.
            searchHasAi = data.has_ai_access === true || data.is_admin === true;

            renderSearchResults(data.results ?? [], query);
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

// Enter: az első sor lenyitása (ugyanaz, mint a kattintás). Pontos találat
// híján az utolsó sor a felviteli űrlap, tehát az Enter is elvezet oda; a
// TopWords-re csak akkor lépünk ki, ha egyetlen sor sincs (pl. hiba után).
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
