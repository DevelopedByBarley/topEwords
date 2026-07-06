// Jelentés-popup (dupla-klikk / kiemelt szóra) + kijelölés- és billentyűkezelők.

let host = null;
let shadow = null;
let currentWord = null;
let currentData = null;
let holdTimer = null;

// ── Selection detection ───────────────────────────────────────────────────────

document.addEventListener('mousedown', (e) => {
    if (host && host.contains(e.target)) {
        return;
    }

    clearTimeout(holdTimer);

    if (e.detail === 2) {
        // Dupla klikk + nyomva tartás → popup
        holdTimer = setTimeout(() => {
            const selection = window.getSelection();
            const text = selection?.toString().trim();

            if (!text) {
                return;
            }

            const word = text.replace(/[^a-zA-Z'-]/g, '').trim();

            if (!word || word.length < 2 || text.split(/\s+/).length > 1) {
                return;
            }

            if (word === currentWord && host) {
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            showPopup(word, rect);
        }, 300);
    }
});

document.addEventListener('mouseup', () => {
    clearTimeout(holdTimer);
});

function isTypingTarget() {
    const el = document.activeElement;

    return (
        el &&
        (el.tagName === 'INPUT' ||
            el.tagName === 'TEXTAREA' ||
            el.isContentEditable)
    );
}

// Capture fázisban figyelünk (true), hogy a gyorsbillentyűink akkor is működjenek,
// ha az oldal saját billentyű-kezelője elnyelné az eseményt.
document.addEventListener(
    'keydown',
    (e) => {
        if (e.key === 'Escape') {
            if (searchHost || host) {
                e.stopPropagation();
            }

            hidePopup();
            hideSearch();

            return;
        }

        // Option+W (Alt+W) vagy Cmd/Ctrl+Shift+F → keresőmodal
        if (
            (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyW') ||
            ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyF')
        ) {
            e.preventDefault();
            e.stopPropagation();
            toggleSearch();

            return;
        }

        // 1–4 státusz billentyűk nyitott popup-nál — gépelés közben nem
        if (shadow && currentData?.found && !isTypingTarget()) {
            const statusByKey = {
                1: 'learning',
                2: 'saved',
                3: 'known',
                4: 'pronunciation',
                5: 'practice',
            };
            const status = statusByKey[e.key];

            if (status && !e.metaKey && !e.ctrlKey && !e.altKey) {
                const btn = shadow.querySelector(
                    `.status-btn[data-status="${status}"]`,
                );

                if (btn) {
                    e.preventDefault();
                    handleStatusClick(btn, currentData);
                }
            }
        }
    },
    true,
);

// Ha a felhasználó máshol (appban / másik fülön) módosította a szavait, a fülre
// visszatérve frissítjük a kiemeléseket, hogy ne maradjon elavult a szín.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && anyVocabUiActive()) {
        refreshVocabHighlights(true);
    }
});

// ── Popup ─────────────────────────────────────────────────────────────────────

function showPopup(word, rect, preferAbove = false) {
    hidePopup();
    currentWord = word;

    // Teljes képernyőn csak a fullscreen elem leszármazottai látszanak, ezért a
    // popupot oda tesszük (fix pozícióval, viewport-koordinátákkal). Egyébként a
    // body-ba, abszolút pozícióval (görgetéssel együtt).
    const fsEl = document.fullscreenElement;

    // Shadow DOM host
    host = document.createElement('div');
    host.style.cssText = `
        position: ${fsEl ? 'fixed' : 'absolute'};
        z-index: 2147483647;
        pointer-events: auto;
    `;
    (fsEl ?? document.body).appendChild(host);
    positionHost(host, rect, !!fsEl, preferAbove);

    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = POPUP_CSS;
    shadow.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'wrap';
    wrap.innerHTML = `
        <div class="header">
            <span class="word">${esc(word)}</span>
            <button class="close" title="Bezárás">×</button>
        </div>
        <div class="body">
            <span class="loading">Keresés…</span>
        </div>
    `;
    shadow.appendChild(wrap);

    shadow.querySelector('.close').addEventListener('click', hidePopup);

    setTimeout(() => {
        document.addEventListener('mousedown', onOutsideClick);
    }, 0);

    sendMsg({ type: 'LOOKUP_WORD', word }, (response) => {
        if (!shadow) {
            return;
        }

        currentData = response;
        renderBody(response);
        // A popup a tartalomtól megnőtt — igazítsuk újra, hogy ne lógjon a feliratra.
        positionHost(host, rect, !!fsEl, preferAbove);
    });
}

function positionHost(el, rect, fixed = false, preferAbove = false) {
    // Fix pozíciónál (fullscreen) viewport-koordináták kellenek, görgetés nélkül.
    const offsetX = fixed ? 0 : window.scrollX;
    const offsetY = fixed ? 0 : window.scrollY;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    // A popup tényleges mérete (ha már renderelt) — különben becslés. A tartalom
    // beérkezésekor a showPopup újrahívja ezt a megnőtt mérettel.
    const popupH = el.offsetHeight || 200;
    const popupW = el.offsetWidth || 260;

    let left = rect.left + offsetX;

    if (left + popupW + 15 > viewportW + offsetX) {
        left = Math.max(0, viewportW + offsetX - popupW - 15);
    }

    const spaceBelow = viewportH - rect.bottom;
    // Alapból a szó alá; feliratból nyitva (preferAbove) a szó fölé, hacsak ott
    // nincs elég hely, de lent igen.
    const placeBelow = preferAbove
        ? rect.top < popupH + 16 && spaceBelow >= popupH
        : spaceBelow >= popupH || rect.top < popupH;
    let top = placeBelow
        ? rect.bottom + offsetY + 8
        : rect.top + offsetY - popupH - 16;

    // Ne lógjon ki a viewport tetején/alján.
    const minTop = offsetY + 8;
    const maxTop = offsetY + viewportH - popupH - 8;
    top = Math.max(minTop, Math.min(top, maxTop));

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
}

function hidePopup() {
    if (host) {
        host.remove();
        host = null;
        shadow = null;
        currentWord = null;
        currentData = null;
        document.removeEventListener('mousedown', onOutsideClick);
    }

    // Bezáráskor (vagy elkattintáskor) a felirat-kijelölés is megszűnik.
    twSelClear();
}

function onOutsideClick(e) {
    if (host && !host.contains(e.target)) {
        hidePopup();
    }
}

// ── Felirat: többszavas kijelölés Shifttel ──────────────────────────────────
// A felirat-sáv és az átirat-panel szavai `.tw-word` span-ek. Shift+kattintással
// NEM nyílik meg a popup, csak a horgony és a kattintott szó közötti tartomány
// jelölődik ki ugyanabban a felirat-sorban. A Shift elengedésekor nyílik meg a
// popup az összefűzött kifejezéssel; a popup bezárásakor a kijelölés törlődik.

let twSelAnchor = null;
let twSelRange = [];
let twShiftUsed = false;

function twSelUnpaint() {
    twSelRange.forEach((span) => {
        span.style.outline = '';
        span.style.outlineOffset = '';
        span.style.borderRadius = '';
    });
}

function twSelPaint() {
    twSelRange.forEach((span) => {
        span.style.outline = '2px solid #ffffff';
        span.style.outlineOffset = '1px';
        span.style.borderRadius = '3px';
    });
}

function twSelClear() {
    twSelUnpaint();
    twSelRange = [];
    twSelAnchor = null;
    twShiftUsed = false;
}

/**
 * Shift+kattintás kezelése egy felirat-szón. A kattintott span konténerén belül
 * kijelöli a horgony és a kattintott szó közötti összes `.tw-word` elemet.
 */
function twSelHandleShiftClick(span) {
    if (!span) {
        return;
    }

    const words = Array.from(span.parentElement.querySelectorAll('.tw-word'));

    // Másik felirat-sorba kattintva újrakezdjük a kijelölést.
    if (twSelAnchor && !words.includes(twSelAnchor)) {
        twSelUnpaint();
        twSelRange = [];
        twSelAnchor = null;
    }

    if (!twSelAnchor) {
        twSelAnchor = span;
    }

    const a = words.indexOf(twSelAnchor);
    const b = words.indexOf(span);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);

    twSelUnpaint();
    twSelRange = words.slice(lo, hi + 1);
    twSelPaint();
    twShiftUsed = true;
}

/** Shift elengedése → az összefűzött kifejezésre megnyitjuk a popupot. */
function twSelCommit() {
    const range = twSelRange.slice();
    twShiftUsed = false;

    if (!range.length) {
        twSelClear();

        return;
    }

    const phrase = range
        .map((span) => (span.dataset.ytWord ?? '').replace(/^'|'$/g, ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!phrase) {
        twSelClear();

        return;
    }

    const rect = range[range.length - 1].getBoundingClientRect();
    speakWord(phrase);
    // showPopup → hidePopup → twSelClear törli a kiemelést, ezért utána
    // visszaállítjuk, hogy a popup nyitva tartja a kijelölést a bezárásig.
    showPopup(phrase, rect, true);
    twSelRange = range;
    twSelPaint();
}

document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' && twShiftUsed) {
        twSelCommit();
    }
});

// ── Render ────────────────────────────────────────────────────────────────────

function renderBody(data) {
    if (!shadow) {
        return;
    }

    const body = shadow.querySelector('.body');

    // Bármilyen hiba (429 throttle, lejárt session, szerverhiba…) itt áll meg —
    // korábban a not-found ágba esett, és „«undefined» nincs az adatbázisban"
    // jelent meg, felkínálva a duplikált saját-szó felvételét.
    if (!data || data.error) {
        const msg =
            data?.error === 'unauthenticated'
                ? 'Jelentkezz be a TopWords-be a szókereséshez.'
                : extErrorMessage(data?.error, 'Hiba történt — próbáld újra.');
        body.innerHTML = `<span class="msg">${msg}</span>`;

        return;
    }

    if (!data.found) {
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(data.word + ' angol szó: jelentése magyarul, szinonimák, példamondat angolul és magyarul, szófaj, igeragozás ha ige')}&udm=50`;
        body.innerHTML = `
            <span class="msg">„${esc(data.word)}" nincs az adatbázisban.</span>
            <div class="footer" style="margin-top:8px;gap:8px;flex-wrap:wrap">
                <button class="link add-custom-btn" type="button">
                    Saját szóként hozzáadom →
                </button>
                <a class="link" href="${googleUrl}" target="_blank" style="color:#4285f4">
                    🔍 Google AI
                </a>
            </div>
        `;

        body.querySelector('.add-custom-btn')?.addEventListener('click', () => {
            const word = data.word;
            hidePopup();
            openAddWordForm(word);
        });

        return;
    }

    const {
        word,
        meaning_hu,
        extra_meanings,
        part_of_speech,
        rank,
        status,
        is_custom,
    } = data;

    // Update header
    const header = shadow.querySelector('.header');
    header.innerHTML = `
        <span class="word">${esc(word)}</span>
        ${part_of_speech ? `<span class="pos">${esc(part_of_speech)}</span>` : ''}
        ${rank ? `<span class="rank">#${rank}</span>` : ''}
        ${is_custom ? `<span class="custom-badge">saját</span>` : ''}
        <button class="close" title="Bezárás">×</button>
    `;
    header.querySelector('.close').addEventListener('click', hidePopup);

    // A státusz/fontosság a weboldalon is mindenkinek elérhető, ezért itt sincs
    // csomaghoz kötve. Csak a flashcard-készítés bővítményből Pro+napi-keretes
    // (canWriteFromExtension), azt jelzi a has_active_access:false — ilyenkor a
    // flashcard-gomb helyén előfizetésre buzdító hint jelenik meg.
    const canWrite = data.has_active_access !== false;

    const statusBtns = Object.entries(STATUS_LABELS)
        .map(([key, label]) => {
            const isActive = status === key;
            const color = STATUS_COLORS[key];
            const activeStyle = isActive
                ? `background:${color};border-color:${color};color:#fff`
                : '';

            return `<button class="status-btn${isActive ? ' active' : ''}" data-status="${key}" style="${activeStyle}">${label}</button>`;
        })
        .join('');

    const statusSection = `<div class="statuses">${statusBtns}</div>`;

    const importanceSection = `<div class="meta-label">Fontosság</div><div class="importance-row" id="hover-importance">${starsHtml(data.importance)}</div>`;

    const upgradeHint = `<a class="upgrade-hint" href="${APP_URL}/pricing" target="_blank">🔒 A flashcard-készítés Pro csomaggal érhető el →</a>`;

    body.innerHTML = `
        <span class="meaning">${esc(meaning_hu)}</span>
        ${extra_meanings ? `<span class="extra">${esc(extra_meanings)}</span>` : ''}
        ${data.synonyms ? `<span class="synonyms">≈ ${esc(data.synonyms)}</span>` : ''}
        ${data.example_en ? `<span class="example">"${esc(data.example_en)}"${data.example_hu ? `<br><span class="example-hu">"${esc(data.example_hu)}"</span>` : ''}</span>` : ''}
        ${statusSection}
        ${importanceSection}
        <div class="footer">
            <a class="link" href="${APP_URL}/words?search=${encodeURIComponent(word)}" target="_blank">Megnyitás →</a>
            <button class="tts-btn" title="Kiejtés angolul">🔊</button>
            ${canWrite ? `<button class="fc-btn" title="Flashcard készítése" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;border:1px solid #e2e8f0;background:none;cursor:pointer;font-size:12px;flex-shrink:0;margin-left:6px">📇</button>` : ''}
        </div>
        ${canWrite ? '' : upgradeHint}
    `;

    body.querySelectorAll('.status-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleStatusClick(btn, data));
    });

    const impRow = body.querySelector('#hover-importance');

    impRow?.querySelectorAll('.imp-star').forEach((star) => {
        star.addEventListener('click', () =>
            handleImportanceClick(parseInt(star.dataset.star), data, impRow),
        );
    });

    body.querySelector('.tts-btn')?.addEventListener('click', () =>
        speakWord(word),
    );

    body.querySelector('.fc-btn')?.addEventListener('click', () => {
        openFlashcardModal(data, data.csrf);
    });
}

function handleImportanceClick(n, data, impRow) {
    const prevImportance = data.importance ?? null;
    const next = prevImportance === n ? null : n;

    // Optimistic UI — a data-t is frissítjük, hogy az újrakattintás toggle-öljön.
    paintStars(impRow, next);
    data.importance = next;
    currentData = data;

    sendMsg(
        {
            type: 'UPDATE_IMPORTANCE',
            id: data.id,
            is_custom: data.is_custom,
            importance: next,
            csrf: data.csrf,
        },
        (resp) => {
            if (resp?.ok || !shadow) {
                return;
            }

            // Sikertelen mentés → előző érték visszaállítása
            data.importance = prevImportance;
            paintStars(impRow, prevImportance);
        },
    );
}

// Egyszerre csak egy státusz-mentés futhat. A gyors, egymás utáni kattintások
// különben átfedő kéréseket indítanának, ami lassuláshoz és „Nem sikerült menteni"
// hibához vezet — ez a zár eldobja a kattintást, amíg az előző mentés be nem fejeződik.
let statusSaveInFlight = false;

function handleStatusClick(btn, data) {
    if (statusSaveInFlight) {
        return;
    }

    const newStatus = btn.dataset.status;
    const isSame = btn.classList.contains('active');

    // Optimistic UI
    shadow.querySelectorAll('.status-btn').forEach((b) => {
        b.classList.remove('active');
        b.style.background = '';
        b.style.borderColor = '';
        b.style.color = '';
    });

    if (!isSame) {
        btn.classList.add('active');
        const color = STATUS_COLORS[newStatus];
        btn.style.background = color;
        btn.style.borderColor = color;
        btn.style.color = '#fff';
    }

    // Update local data so toggling works correctly
    currentData = { ...data, status: isSame ? null : newStatus };

    // Mentés folyamatban: gombok letiltása + halvány „mentés…" állapot.
    statusSaveInFlight = true;
    shadow.querySelector('.statuses')?.classList.add('saving');

    const finishSave = () => {
        statusSaveInFlight = false;
        shadow?.querySelector('.statuses')?.classList.remove('saving');
    };

    sendMsg(
        {
            type: 'UPDATE_STATUS',
            id: data.id,
            is_custom: data.is_custom,
            status: isSame ? null : newStatus,
            csrf: data.csrf,
        },
        (resp) => {
            finishSave();

            if (resp?.ok) {
                // A státusz a szerveren is frissült — frissítsük a kiemeléseket azonnal.
                refreshVocabHighlights();

                return;
            }

            if (!shadow) {
                return;
            }

            // Sikertelen mentés → visszaállítás + hibajelzés
            currentData = data;
            renderBody(data);

            const body = shadow.querySelector('.body');

            if (body) {
                const err = document.createElement('span');
                err.className = 'error-feedback';
                err.textContent =
                    resp?.error === 'plan'
                        ? 'Elérted a bővítmény napi ingyenes keretét — holnap folytathatod.'
                        : extErrorMessage(
                              resp?.error,
                              'Nem sikerült menteni — próbáld újra.',
                          );
                body.prepend(err);
            }
        },
    );
}
