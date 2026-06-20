const APP_URL = 'https://topwords.eu';

const STATUS_LABELS = {
    learning: 'Tanulom',
    saved: 'Mentett',
    known: 'Tudom',
    pronunciation: 'Kiejtés',
    practice: 'Gyakorlásra',
};

const STATUS_COLORS = {
    learning: '#3b82f6',
    saved: '#f97316',
    known: '#22c55e',
    pronunciation: '#8b5cf6',
    practice: '#f43f5e',
};

const POPUP_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
        position: absolute;
        z-index: 2147483647;
        display: block;
    }

    #wrap {
        width: 260px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.13), 0 2px 6px rgba(0,0,0,0.08);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        color: #1e293b;
        line-height: 1.5;
        overflow: hidden;
    }

    .header {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 10px 14px 8px;
        border-bottom: 1px solid #f1f5f9;
    }

    .word {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
    }

    .pos {
        font-size: 11px;
        color: #94a3b8;
        font-style: italic;
    }

    .rank {
        font-size: 11px;
        color: #cbd5e1;
        margin-left: auto;
    }

    .custom-badge {
        font-size: 11px;
        padding: 1px 7px;
        border-radius: 20px;
        background: #ede9fe;
        color: #7c3aed;
        font-weight: 500;
        margin-left: auto;
    }

    .close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        color: #94a3b8;
        background: none;
        border: none;
        flex-shrink: 0;
        margin-left: auto;
    }

    .close:hover { background: #f1f5f9; color: #475569; }

    .body {
        padding: 10px 14px 12px;
    }

    .loading, .msg {
        display: block;
        color: #94a3b8;
        font-size: 13px;
        text-align: center;
        padding: 6px 0;
    }

    .meaning {
        display: block;
        font-size: 14px;
        color: #334155;
        margin-bottom: 6px;
    }

    .extra {
        display: block;
        font-size: 12px;
        color: #94a3b8;
        margin-bottom: 10px;
    }

    .synonyms {
        display: block;
        font-size: 12px;
        color: #64748b;
        margin-bottom: 8px;
    }

    .example {
        display: block;
        font-size: 12px;
        font-style: italic;
        color: #64748b;
        margin-bottom: 10px;
        padding-left: 8px;
        border-left: 2px solid #e2e8f0;
    }

    .example-hu {
        color: #94a3b8;
    }

    .error-feedback {
        display: block;
        font-size: 12px;
        color: #ef4444;
        font-weight: 500;
        margin-bottom: 6px;
    }

    .statuses {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 10px;
    }

    .status-btn {
        display: inline-flex;
        align-items: center;
        padding: 4px 11px;
        border-radius: 20px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        font-size: 12px;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        transition: all 0.15s;
    }

    .status-btn:hover {
        border-color: #6366f1;
        color: #6366f1;
        background: #eef2ff;
    }

    .status-btn.active {
        color: #fff;
        border-color: transparent;
    }

    .importance-row { display: flex; gap: 2px; margin-bottom: 10px; }

    .imp-star {
        flex: 1;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 2px 0;
        color: #cbd5e1;
        transition: color 0.12s;
        font-family: inherit;
    }

    .imp-star.filled { color: #fbbf24; }
    .imp-star:hover { color: #f59e0b; }

    .meta-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-bottom: 4px;
    }

    .footer {
        display: flex;
        align-items: center;
        padding-top: 8px;
        border-top: 1px solid #f1f5f9;
    }

    a.link, button.link {
        font-size: 12px;
        color: #6366f1;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    button.link {
        border: none;
        background: none;
        padding: 0;
        font-family: inherit;
    }

    a.link:hover, button.link:hover { color: #4f46e5; }

    .tts-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1px solid #e2e8f0;
        background: none;
        cursor: pointer;
        font-size: 13px;
        margin-left: auto;
        flex-shrink: 0;
        transition: background 0.15s;
    }

    .tts-btn:hover { background: #f1f5f9; }

    .feedback {
        display: block;
        font-size: 12px;
        color: #22c55e;
        font-weight: 500;
        margin-bottom: 6px;
    }
`;

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
        if (
            shadow &&
            currentData?.found &&
            currentData?.has_active_access &&
            !isTypingTarget()
        ) {
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
    if (document.visibilityState === 'visible' && (hlWordMap || ytStatusMap)) {
        refreshVocabHighlights();
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
}

function onOutsideClick(e) {
    if (host && !host.contains(e.target)) {
        hidePopup();
    }
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderBody(data) {
    if (!shadow) {
        return;
    }

    const body = shadow.querySelector('.body');

    if (!data || data.error === 'unauthenticated' || data.error === 'network') {
        body.innerHTML = `<span class="msg">${data?.error === 'network' ? 'Nincs kapcsolat a TopWords-szel.' : 'Jelentkezz be a TopWords-be a szókereséshez.'}</span>`;

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

    let statusSection;

    if (data.has_active_access) {
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
        statusSection = `<div class="statuses">${statusBtns}</div>`;
    } else {
        statusSection = `<a class="link" href="${APP_URL}/pricing" target="_blank" style="display:block;margin-bottom:10px;">⭐ Prémiumra váltva státuszokat is menthetsz</a>`;
    }

    const importanceSection = data.has_active_access
        ? `<div class="meta-label">Fontosság</div><div class="importance-row" id="hover-importance">${starsHtml(data.importance)}</div>`
        : '';

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
            <button class="fc-btn" title="Flashcard készítése" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;border:1px solid #e2e8f0;background:none;cursor:pointer;font-size:12px;flex-shrink:0;margin-left:6px">📇</button>
        </div>
    `;

    if (data.has_active_access) {
        body.querySelectorAll('.status-btn').forEach((btn) => {
            btn.addEventListener('click', () => handleStatusClick(btn, data));
        });

        const impRow = body.querySelector('#hover-importance');

        impRow?.querySelectorAll('.imp-star').forEach((star) => {
            star.addEventListener('click', () =>
                handleImportanceClick(parseInt(star.dataset.star), data, impRow),
            );
        });
    }

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

function handleStatusClick(btn, data) {
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

    sendMsg(
        {
            type: 'UPDATE_STATUS',
            id: data.id,
            is_custom: data.is_custom,
            status: isSame ? null : newStatus,
            csrf: data.csrf,
        },
        (resp) => {
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
                err.textContent = 'Nem sikerült menteni — próbáld újra.';
                body.prepend(err);
            }
        },
    );
}

// ── Search modal ──────────────────────────────────────────────────────────────

const SEARCH_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 80px;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(2px);
    }

    #modal {
        width: 480px;
        max-height: 520px;
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        color: #1e293b;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    #search-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
    }

    #search-icon {
        color: #94a3b8;
        flex-shrink: 0;
    }

    #search-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 16px;
        color: #0f172a;
        background: transparent;
    }

    #search-input::placeholder { color: #cbd5e1; }

    #shortcut-hint {
        font-size: 11px;
        color: #cbd5e1;
        flex-shrink: 0;
    }

    #results {
        overflow-y: auto;
        flex: 1;
    }

    .result-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        cursor: pointer;
        border-bottom: 1px solid #f8fafc;
        transition: background 0.1s;
    }

    .result-item:hover { background: #f8fafc; }
    .result-item.selected { background: #eef2ff; }
    .result-item:last-child { border-bottom: none; }

    .result-main { flex: 1; min-width: 0; }

    .result-word {
        font-weight: 600;
        font-size: 14px;
        color: #0f172a;
    }

    .result-meaning {
        font-size: 12px;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
    }

    .result-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        flex-shrink: 0;
    }

    .result-rank { font-size: 11px; color: #cbd5e1; }

    .result-status {
        font-size: 10px;
        padding: 1px 7px;
        border-radius: 20px;
        font-weight: 500;
        color: #fff;
    }

    .result-custom {
        font-size: 10px;
        padding: 1px 7px;
        border-radius: 20px;
        background: #ede9fe;
        color: #7c3aed;
        font-weight: 500;
    }

    #empty {
        padding: 32px 16px;
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
    }

    #loading {
        padding: 24px 16px;
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
    }

    /* Detail panel */
    #detail {
        padding: 14px 16px;
        border-top: 1px solid #f1f5f9;
        display: none;
    }

    #detail.visible { display: block; }

    .detail-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
    }

    .detail-word {
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
    }

    .detail-pos { font-size: 12px; color: #94a3b8; font-style: italic; }
    .detail-rank { font-size: 12px; color: #cbd5e1; margin-left: auto; }

    .detail-meaning { font-size: 14px; color: #334155; margin-bottom: 4px; }
    .detail-extra { font-size: 12px; color: #94a3b8; margin-bottom: 10px; }

    .detail-statuses {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 10px;
    }

    .status-btn {
        display: inline-flex;
        align-items: center;
        padding: 4px 11px;
        border-radius: 20px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        font-size: 12px;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        transition: all 0.15s;
    }

    .status-btn:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
    .status-btn.active { color: #fff; border-color: transparent; }

    .importance-row { display: flex; gap: 2px; margin-bottom: 10px; }

    .imp-star {
        flex: 1;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 2px 0;
        color: #cbd5e1;
        transition: color 0.12s;
        font-family: inherit;
    }

    .imp-star.filled { color: #fbbf24; }
    .imp-star:hover { color: #f59e0b; }

    .meta-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-bottom: 4px;
    }

    .detail-link {
        font-size: 12px;
        color: #6366f1;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .detail-link:hover { color: #4f46e5; }

    #footer-hint {
        padding: 8px 16px;
        border-top: 1px solid #f1f5f9;
        font-size: 11px;
        color: #cbd5e1;
        text-align: center;
    }

    #detail.form-mode {
        overflow-y: auto;
        max-height: 310px;
    }

    .form-fields { display: flex; flex-direction: column; gap: 6px; }

    .form-input {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 13px;
        outline: none;
        font-family: inherit;
        color: #0f172a;
        background: #fff;
        box-sizing: border-box;
    }

    .form-input:focus { border-color: #6366f1; }

    select.form-input { cursor: pointer; }

    .form-row { display: flex; gap: 6px; }
    .form-row .form-input { flex: 1; min-width: 0; }

    .form-section {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .form-section-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-bottom: 2px;
    }

    .form-check {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #475569;
        cursor: pointer;
    }

    .add-btn {
        padding: 7px 18px;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s;
        flex-shrink: 0;
    }

    .add-btn:hover { background: #4f46e5; }
    .add-btn:disabled { opacity: 0.6; cursor: default; }

    .google-ai-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 500;
        color: #4285f4;
        text-decoration: none;
        padding: 3px 10px;
        border: 1px solid #dbeafe;
        border-radius: 20px;
        background: #eff6ff;
        white-space: nowrap;
        transition: all 0.15s;
    }

    .google-ai-link:hover { background: #dbeafe; border-color: #93c5fd; }

    .detail-tts-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1px solid #e2e8f0;
        background: none;
        cursor: pointer;
        font-size: 13px;
        margin-left: auto;
        flex-shrink: 0;
        transition: background 0.15s;
    }

    .detail-tts-btn:hover { background: #f1f5f9; }
`;

let searchHost = null;
let searchShadow = null;
let searchDebounce = null;
let searchCsrf = null;
let searchHasAccess = false;
let searchIsAdmin = false;
let searchHasAi = false;
let searchResultsData = [];
let searchSelIdx = -1;

function toggleSearch() {
    if (searchHost) {
        hideSearch();

        return;
    }

    showSearch();
}

function showSearch() {
    hidePopup();
    searchHost = document.createElement('div');
    searchHost.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;pointer-events:auto;';
    // Teljes képernyőn csak a fullscreen elem leszármazottai látszanak, ezért a
    // kereső-modalt is oda tesszük (position:fixed így a viewportra igazodik).
    (document.fullscreenElement ?? document.body).appendChild(searchHost);

    searchShadow = searchHost.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = SEARCH_CSS;
    searchShadow.appendChild(style);

    searchShadow.innerHTML += `
        <div id="modal">
            <div id="search-wrap">
                <svg id="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input id="search-input" type="text" placeholder="Keress egy szót…" autocomplete="off" spellcheck="false" />
                <span id="shortcut-hint">${navigator.platform.includes('Mac') ? 'Option' : 'Alt'}+W</span>
            </div>
            <div id="results"><div id="empty" style="display:none">Nincs találat.</div></div>
            <div id="detail"></div>
            <div id="footer-hint">↑↓ = választás &nbsp;·&nbsp; Enter = részletek &nbsp;·&nbsp; Esc = bezár</div>
        </div>
    `;

    const input = searchShadow.getElementById('search-input');
    input.focus();

    // Az oldal saját billentyű-kezelői (egybetűs gyorsbillentyűk, letiltott
    // karakterek) elnyelhetik a gépelést — a kereső eseményeit nem engedjük
    // felbukkanni az oldalhoz, így minden karakter beírható.
    ['keydown', 'keyup', 'keypress', 'input'].forEach((type) => {
        input.addEventListener(type, (e) => e.stopPropagation());
    });

    input.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        const q = input.value.trim();

        if (!q) {
            renderSearchResults([]);

            return;
        }

        showSearchLoading();
        searchDebounce = setTimeout(() => {
            sendMsg({ type: 'SEARCH_WORD', q }, (resp) => {
                if (!searchShadow) {
                    return;
                }

                searchCsrf = resp?.csrf ?? null;
                searchHasAccess = resp?.has_active_access ?? false;
                searchIsAdmin = resp?.is_admin ?? false;
                searchHasAi = resp?.has_ai_access ?? false;
                renderSearchResults(resp?.results ?? [], resp?.error);
            });
        }, 250);
    });

    // Billentyű-navigáció: ↑↓ a találatok között, Enter = részletek
    input.addEventListener('keydown', (e) => {
        if (!searchShadow) {
            return;
        }

        const items = Array.from(
            searchShadow.querySelectorAll('.result-item[data-index]'),
        );

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();

            if (!items.length) {
                return;
            }

            searchSelIdx =
                e.key === 'ArrowDown'
                    ? Math.min(searchSelIdx + 1, items.length - 1)
                    : Math.max(searchSelIdx - 1, 0);
            items.forEach((el, i) =>
                el.classList.toggle('selected', i === searchSelIdx),
            );
            items[searchSelIdx]?.scrollIntoView({ block: 'nearest' });

            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();

            if (searchSelIdx >= 0 && searchResultsData[searchSelIdx]) {
                showSearchDetail(searchResultsData[searchSelIdx]);
            } else if (searchResultsData.length > 0) {
                searchSelIdx = 0;
                items[0]?.classList.add('selected');
                showSearchDetail(searchResultsData[0]);
            } else {
                searchShadow.getElementById('add-notfound')?.click();
            }
        }
    });

    searchHost.addEventListener('mousedown', (e) => {
        const modal = searchShadow.getElementById('modal');

        if (!e.composedPath().includes(modal)) {
            hideSearch();
        }
    });
}

function hideSearch() {
    if (searchHost) {
        searchHost.remove();
        searchHost = null;
        searchShadow = null;
        searchResultsData = [];
        searchSelIdx = -1;
        clearTimeout(searchDebounce);
    }
}

/**
 * Megnyitja a keresőt egy adott szóra és egyből a hozzáadás-űrlapot mutatja
 * (ha a szó nincs a szótárban) — így a feliratból/bárhonnan fel lehet venni
 * saját szót az app külön megnyitása nélkül.
 */
function openAddWordForm(word) {
    showSearch();

    const input = searchShadow?.getElementById('search-input');

    if (input) {
        input.value = word;
    }

    showSearchLoading();
    sendMsg({ type: 'SEARCH_WORD', q: word }, (resp) => {
        if (!searchShadow) {
            return;
        }

        searchCsrf = resp?.csrf ?? null;
        searchHasAccess = resp?.has_active_access ?? false;
        searchIsAdmin = resp?.is_admin ?? false;
        searchHasAi = resp?.has_ai_access ?? false;

        const results = resp?.results ?? [];
        const exact = results.find(
            (r) => r.word?.toLowerCase() === word.toLowerCase(),
        );

        renderSearchResults(results, resp?.error);

        if (exact) {
            showSearchDetail(exact);
        } else {
            showSearchDetail({ word, _notFound: true });
        }
    });
}

function showSearchLoading() {
    if (!searchShadow) {
        return;
    }

    searchShadow.getElementById('results').innerHTML =
        '<div id="loading">Keresés…</div>';
    const detail = searchShadow.getElementById('detail');
    detail.classList.remove('visible');
    detail.innerHTML = '';
}

function renderSearchResults(results, error) {
    if (!searchShadow) {
        return;
    }

    searchResultsData = results ?? [];
    searchSelIdx = -1;
    const container = searchShadow.getElementById('results');
    const detail = searchShadow.getElementById('detail');
    detail.classList.remove('visible');
    detail.innerHTML = '';

    if (error === 'unauthenticated' || error === 'network') {
        container.innerHTML = `<div id="empty">${error === 'network' ? 'Nincs kapcsolat a TopWords-szel.' : 'Jelentkezz be a TopWords-be a kereséshez.'}</div>`;

        return;
    }

    if (!results.length) {
        const q =
            searchShadow.getElementById('search-input')?.value.trim() ?? '';

        if (q) {
            container.innerHTML = `
                <div class="result-item" id="add-notfound">
                    <div class="result-main">
                        <div class="result-word">${esc(q)}</div>
                        <div class="result-meaning" style="color:#94a3b8">Nincs az adatbázisban – hozzáadás saját szóként</div>
                    </div>
                    <div class="result-meta">
                        <span style="font-size:10px;padding:1px 7px;border-radius:20px;background:#dcfce7;color:#16a34a;font-weight:500">+ saját</span>
                    </div>
                </div>
            `;
            container
                .querySelector('#add-notfound')
                .addEventListener('click', () => {
                    showSearchDetail({ word: q, _notFound: true });
                });
        } else {
            container.innerHTML = '<div id="empty">Nincs találat.</div>';
        }

        return;
    }

    container.innerHTML = results
        .map((r, i) => {
            const statusColor = r.status ? STATUS_COLORS[r.status] : null;
            const statusLabel = r.status ? STATUS_LABELS[r.status] : null;

            return `
            <div class="result-item" data-index="${i}">
                <div class="result-main">
                    <div class="result-word">${esc(r.word)}</div>
                    <div class="result-meaning">${esc(r.meaning_hu ?? '')}</div>
                </div>
                <div class="result-meta">
                    ${r.rank ? `<span class="result-rank">#${r.rank}</span>` : ''}
                    ${r.is_custom ? `<span class="result-custom">saját</span>` : ''}
                    ${statusLabel ? `<span class="result-status" style="background:${statusColor}">${statusLabel}</span>` : ''}
                </div>
            </div>
        `;
        })
        .join('');

    container.querySelectorAll('.result-item').forEach((el) => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index);
            showSearchDetail(results[idx]);
        });
    });
}

function statusBtnsHtml(active) {
    return Object.entries(STATUS_LABELS)
        .map(([key, label]) => {
            const isActive = active === key;
            const color = STATUS_COLORS[key];
            const activeStyle = isActive
                ? `background:${color};border-color:${color};color:#fff`
                : '';

            return `<button class="status-btn${isActive ? ' active' : ''}" data-status="${key}" style="${activeStyle}">${label}</button>`;
        })
        .join('');
}

function starsHtml(value) {
    const v = value ?? 0;

    return [1, 2, 3, 4, 5]
        .map(
            (n) =>
                `<button type="button" class="imp-star${n <= v ? ' filled' : ''}" data-star="${n}" title="${n} csillag">★</button>`,
        )
        .join('');
}

function paintStars(container, value) {
    const v = value ?? 0;
    container.querySelectorAll('.imp-star').forEach((star) => {
        star.classList.toggle('filled', parseInt(star.dataset.star) <= v);
    });
}

// ── Flashcard készítés a popupból ───────────────────────────────────────────
// A paklikat egyszer kérjük le és cache-eljük. Ugyanazokat a mezőket menti, mint
// a webes szerkesztő; az AI a meglévő gemini-flashcard végpontot hívja, így a
// kártya azonosan kerül az adatbázisba.

let fcDecksCache = null;

function showFcFeedback(el, text, color) {
    if (!el) {
        return;
    }

    el.textContent = text;
    el.style.color = color;
    el.style.display = 'block';
}

// Az AI-flashcard HTML-jét a backend már escape-eli, de defense-in-depth jelleggel
// kliens oldalon is megtisztítjuk, mielőtt DOM-ba kerül: eltávolítjuk a veszélyes
// elemeket, az on* eseménykezelőket és a javascript:/data: URL-eket. DocumentFragmentet
// ad vissza, amit replaceChildren-nel rakunk be (sosem nyers innerHTML-lel).
function sanitizeAiHtml(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html ?? '');

    tpl.content
        .querySelectorAll(
            'script, style, iframe, object, embed, link, meta, base, form, svg, math',
        )
        .forEach((el) => el.remove());

    tpl.content.querySelectorAll('*').forEach((el) => {
        [...el.attributes].forEach((attr) => {
            const name = attr.name.toLowerCase();

            if (name.startsWith('on')) {
                el.removeAttribute(attr.name);
            } else if (
                [
                    'href',
                    'src',
                    'srcset',
                    'xlink:href',
                    'formaction',
                    'action',
                    'background',
                    'poster',
                ].includes(name) &&
                /^\s*(javascript|data|vbscript):/i.test(attr.value)
            ) {
                el.removeAttribute(attr.name);
            } else if (
                name === 'style' &&
                /expression\s*\(|javascript:/i.test(attr.value)
            ) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return tpl.content;
}

function flashcardFormHtml(data, info) {
    const decks = info?.decks ?? [];
    const hasAi = info?.has_ai_access;

    if (!decks.length) {
        return `
            <div class="fc-empty">Még nincs flashcard-paklid.</div>
            <a href="${APP_URL}/flashcards" target="_blank" class="fc-empty-link">Hozz létre egyet a TopWords-ben →</a>
        `;
    }

    const deckOptions = decks
        .map((d) => `<option value="${d.id}">${esc(d.name)}</option>`)
        .join('');

    return `
        <div class="fc-label">Pakli</div>
        <select data-fc-deck class="fc-input fc-select">${deckOptions}</select>

        <div data-fc-fields class="fc-grid">
            <div>
                <div class="fc-label">Előlap</div>
                <textarea data-fc-front class="fc-input fc-area">${esc(data.word ?? '')}</textarea>
            </div>
            <div>
                <div class="fc-label">Hátlap</div>
                <textarea data-fc-back class="fc-input fc-area">${esc(data.meaning_hu ?? '')}</textarea>
            </div>
        </div>

        <div data-fc-preview class="fc-preview-wrap" style="display:none">
            <div class="fc-grid">
                <div>
                    <div class="fc-label">Előlap (AI)</div>
                    <div data-fc-front-preview class="fc-preview-box"></div>
                </div>
                <div>
                    <div class="fc-label">Hátlap (AI)</div>
                    <div data-fc-back-preview class="fc-preview-box"></div>
                </div>
            </div>
            <button data-fc-manual class="fc-manual">↩ Kézi szerkesztés</button>
        </div>

        <div class="fc-row">
            <div style="flex:1">
                <div class="fc-label">Irány</div>
                <select data-fc-direction class="fc-input fc-select">
                    <option value="both">oda-vissza</option>
                    <option value="front_to_back">elő → hát</option>
                    <option value="back_to_front">hát → elő</option>
                </select>
            </div>
            <div>
                <div class="fc-label">Szín</div>
                <input data-fc-color type="color" value="#6366f1" class="fc-color" />
            </div>
        </div>

        <div class="fc-actions">
            <button data-fc-save class="fc-save">Mentés</button>
            ${hasAi ? `<button data-fc-ai class="fc-ai">✨ AI flashcard</button>` : ''}
            <div data-fc-feedback class="fc-feedback" style="display:none"></div>
        </div>
    `;
}

function wireFlashcardForm(root, data, csrf, onBack) {
    root.querySelector('[data-fc-back]')?.addEventListener('click', onBack);

    const saveBtn = root.querySelector('[data-fc-save]');

    if (!saveBtn) {
        return;
    }

    const fields = root.querySelector('[data-fc-fields]');
    const preview = root.querySelector('[data-fc-preview]');
    const feedback = root.querySelector('[data-fc-feedback]');

    // AI mód: a gemini-flashcard kész HTML-t ad; ezt renderelt előnézetként
    // mutatjuk, és mentéskor ezt küldjük (nincs WYSIWYG, de a DB-be ugyanaz kerül).
    let aiFront = null;
    let aiBack = null;

    root.querySelector('[data-fc-ai]')?.addEventListener('click', () => {
        const aiBtn = root.querySelector('[data-fc-ai]');
        aiBtn.disabled = true;
        aiBtn.textContent = '⏳';

        sendMsg({ type: 'GEMINI_FLASHCARD', word: data.word }, (resp) => {
            aiBtn.disabled = false;
            aiBtn.textContent = '✨ AI';

            if (resp?.error === 'ai_limit') {
                showFcFeedback(
                    feedback,
                    resp.message ?? 'Elérted a havi AI-felhasználási kereted.',
                    '#f97316',
                );

                return;
            }

            if (!resp || resp.error || (!resp.front && !resp.back)) {
                showFcFeedback(
                    feedback,
                    'Az AI nem tudott kártyát készíteni.',
                    '#ef4444',
                );

                return;
            }

            aiFront = resp.front ?? '';
            aiBack = resp.back ?? '';
            root
                .querySelector('[data-fc-front-preview]')
                .replaceChildren(sanitizeAiHtml(aiFront));
            root
                .querySelector('[data-fc-back-preview]')
                .replaceChildren(sanitizeAiHtml(aiBack));
            fields.style.display = 'none';
            preview.style.display = 'block';
            feedback.style.display = 'none';
        });
    });

    root.querySelector('[data-fc-manual]')?.addEventListener('click', () => {
        aiFront = null;
        aiBack = null;
        preview.style.display = 'none';
        fields.style.display = 'block';
    });

    saveBtn.addEventListener('click', () => {
        const usingAi = aiFront !== null;
        const front = usingAi
            ? aiFront
            : root.querySelector('[data-fc-front]').value.trim();
        const back = usingAi
            ? aiBack
            : root.querySelector('[data-fc-back]').value.trim();

        if (!front || !back) {
            showFcFeedback(feedback, 'Az elő- és hátlap kötelező.', '#f97316');

            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = '…';

        const card = {
            deck_id: parseInt(root.querySelector('[data-fc-deck]').value),
            front,
            back,
            direction: root.querySelector('[data-fc-direction]').value,
            color: root.querySelector('[data-fc-color]').value,
        };

        // word_id csak globális szóhoz — saját szónál/kifejezésnél nincs words-rekord.
        if (!data.is_custom && data.id) {
            card.word_id = data.id;
        }

        sendMsg({ type: 'CREATE_FLASHCARD', card, csrf }, (resp) => {
            if (resp?.ok) {
                saveBtn.style.display = 'none';
                showFcFeedback(feedback, 'Kártya mentve! ✓', '#22c55e');
                // Rövid visszajelzés után bezárjuk a modált.
                setTimeout(() => onBack?.(), 900);
            } else if (resp?.error === 'limit') {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Mentés';
                showFcFeedback(
                    feedback,
                    'Ingyenes limit: paklinként max 20 kártya.',
                    '#f97316',
                );
            } else if (resp?.error === 'deck_not_found') {
                fcDecksCache = null; // cache elavult — újratöltjük legközelebb
                saveBtn.disabled = false;
                saveBtn.textContent = 'Mentés';
                showFcFeedback(feedback, 'A pakli nem található.', '#ef4444');
            } else {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Mentés';
                showFcFeedback(
                    feedback,
                    'Nem sikerült menteni — próbáld újra.',
                    '#ef4444',
                );
            }
        });
    });
}

const FC_MODAL_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
    }

    .fc-backdrop {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 48px 16px;
        background: rgba(15, 23, 42, 0.5);
        backdrop-filter: blur(2px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .fc-card {
        width: min(560px, 94vw);
        max-height: 86vh;
        overflow-y: auto;
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
        padding: 18px 20px 20px;
        color: #1e293b;
    }

    .fc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }

    .fc-title { font-size: 16px; font-weight: 700; color: #0f172a; }
    .fc-title small { font-weight: 500; color: #94a3b8; margin-left: 6px; }

    .fc-close {
        width: 30px; height: 30px;
        border: none; background: none; cursor: pointer;
        font-size: 22px; line-height: 1; color: #94a3b8; border-radius: 50%;
        flex-shrink: 0;
    }
    .fc-close:hover { background: #f1f5f9; color: #475569; }

    .fc-label {
        font-size: 11px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.05em; color: #94a3b8; margin: 12px 0 4px;
    }

    .fc-input {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        padding: 8px 11px;
        font-size: 14px;
        font-family: inherit;
        color: #0f172a;
        background: #fff;
        outline: none;
    }
    .fc-input:focus { border-color: #6366f1; }
    .fc-select { cursor: pointer; }
    .fc-area { resize: vertical; min-height: 64px; line-height: 1.45; }

    .fc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 520px) { .fc-grid { grid-template-columns: 1fr; } }

    .fc-preview-box {
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        padding: 10px 12px;
        background: #f8fafc;
        max-height: 320px;
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.5;
        color: #0f172a;
    }
    .fc-preview-box p { margin: 0 0 6px; }
    .fc-preview-box :last-child { margin-bottom: 0; }

    .fc-manual {
        margin-top: 8px;
        font-size: 12px; color: #6366f1;
        background: none; border: none; cursor: pointer;
        font-family: inherit; text-decoration: underline;
    }

    .fc-row { display: flex; gap: 14px; }

    .fc-color {
        width: 48px; height: 38px;
        border: 1px solid #e2e8f0; border-radius: 9px;
        background: #fff; cursor: pointer; padding: 2px;
    }

    .fc-actions { display: flex; align-items: center; gap: 10px; margin-top: 16px; flex-wrap: wrap; }

    .fc-save {
        padding: 9px 22px; background: #6366f1; color: #fff;
        border: none; border-radius: 9px; font-size: 14px; font-weight: 600;
        cursor: pointer; font-family: inherit; transition: background 0.15s;
    }
    .fc-save:hover { background: #4f46e5; }
    .fc-save:disabled { opacity: 0.6; cursor: default; }

    .fc-ai {
        padding: 9px 14px; background: #faf5ff; color: #7c3aed;
        border: 1px solid #ede9fe; border-radius: 9px; font-size: 13px; font-weight: 500;
        cursor: pointer; font-family: inherit;
    }
    .fc-ai:hover { background: #f3e8ff; }
    .fc-ai:disabled { opacity: 0.6; cursor: default; }

    .fc-feedback { font-size: 13px; font-weight: 500; }

    .fc-empty { font-size: 14px; color: #475569; margin-bottom: 8px; }
    .fc-empty-link { font-size: 13px; color: #6366f1; text-decoration: underline; text-underline-offset: 2px; }

    .fc-loading { font-size: 14px; color: #94a3b8; padding: 16px 0; text-align: center; }
`;

let fcModalHost = null;

function fcModalEscHandler(e) {
    if (e.key === 'Escape') {
        closeFlashcardModal();
    }
}

function closeFlashcardModal() {
    document.removeEventListener('keydown', fcModalEscHandler, true);
    fcModalHost?.remove();
    fcModalHost = null;
}

/**
 * Saját, széles modális ablakot nyit a flashcard készítéséhez — így az AI által
 * generált hosszú tartalom is olvashatóan elfér (a kis lookup-popup túl szűk).
 */
function openFlashcardModal(data, csrf) {
    closeFlashcardModal();

    fcModalHost = document.createElement('div');
    const shadow = fcModalHost.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = FC_MODAL_CSS;
    shadow.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.className = 'fc-backdrop';

    const card = document.createElement('div');
    card.className = 'fc-card';
    card.innerHTML = `
        <div class="fc-head">
            <span class="fc-title">📇 Új flashcard <small>${esc(data.word ?? '')}</small></span>
            <button class="fc-close" title="Bezárás">×</button>
        </div>
        <div class="fc-body"><div class="fc-loading">Paklik betöltése…</div></div>
    `;
    backdrop.appendChild(card);
    shadow.appendChild(backdrop);
    document.body.appendChild(fcModalHost);
    document.addEventListener('keydown', fcModalEscHandler, true);

    card.querySelector('.fc-close').addEventListener('click', closeFlashcardModal);

    // Csak a háttérre (kártyán kívülre) kattintás zár — a kártyán belüli nem.
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeFlashcardModal();
        }
    });

    const body = card.querySelector('.fc-body');

    const render = (info) => {
        body.innerHTML = flashcardFormHtml(data, info);
        wireFlashcardForm(body, data, csrf, closeFlashcardModal);
    };

    if (fcDecksCache) {
        render(fcDecksCache);

        return;
    }

    sendMsg({ type: 'GET_DECKS' }, (resp) => {
        if (!fcModalHost) {
            return;
        }

        if (!resp || resp.error) {
            body.innerHTML =
                '<div class="fc-empty">Nem sikerült betölteni a paklikat.</div>';

            return;
        }

        fcDecksCache = resp;
        render(resp);
    });
}

function showSearchDetail(data) {
    if (!searchShadow) {
        return;
    }

    const detail = searchShadow.getElementById('detail');

    let statusSection = '';
    let importanceSection = '';

    if (searchHasAccess) {
        statusSection = `<div class="detail-statuses">${statusBtnsHtml(data.status)}</div>`;
        importanceSection = `<div class="meta-label">Fontosság</div><div class="importance-row" id="detail-importance">${starsHtml(data.importance)}</div>`;
    }

    // Ha nincs a DB-ben (nem found), mutass teljes "Hozzáadás" formot
    if (data._notFound) {
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(data.word + ' angol szó: jelentése magyarul, szinonimák, példamondat angolul és magyarul, szófaj, igeragozás ha ige')}&udm=50`;
        detail.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <span style="font-size:14px;font-weight:700;color:#0f172a">${esc(data.word)}</span>
                <div style="display:flex;gap:6px;align-items:center">
                    ${searchIsAdmin || searchHasAi ? `<button id="gemini-fill-btn" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;color:#7c3aed;border:1px solid #ede9fe;border-radius:20px;background:#faf5ff;padding:3px 10px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all 0.15s">✨ AI kitöltés</button>` : ''}
                    <a class="google-ai-link" href="${googleUrl}" target="_blank">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        Google AI
                    </a>
                </div>
            </div>
            <div class="form-fields">
                <select class="form-input" id="add-pos">
                    <option value="">Szófaj (opcionális)</option>
                    <option value="verb">ige</option>
                    <option value="noun">főnév</option>
                    <option value="adj">melléknév</option>
                    <option value="adv">határozószó</option>
                    <option value="prep">elöljáró</option>
                    <option value="conj">kötőszó</option>
                    <option value="det">névelő</option>
                    <option value="pron">névmás</option>
                    <option value="num">számnév</option>
                    <option value="interj">indulatszó</option>
                </select>
                <input class="form-input" id="add-meaning" type="text" placeholder="Magyar jelentés" />
                <input class="form-input" id="add-extra" type="text" placeholder="További jelentések" />
                <input class="form-input" id="add-synonyms" type="text" placeholder="Szinonimák (pl. consent, accept)" />
                <input class="form-input" id="add-example-en" type="text" placeholder="Példamondat (angol)" />
                <input class="form-input" id="add-example-hu" type="text" placeholder="Példamondat (magyar)" />

                <div id="verb-fields" class="form-section" style="display:none">
                    <div class="form-section-label">Igealakok</div>
                    <div class="form-row">
                        <input class="form-input" id="add-form-base" type="text" placeholder="Alap (to ...)" />
                        <input class="form-input" id="add-verb-past" type="text" placeholder="Múlt idő" />
                    </div>
                    <div class="form-row">
                        <input class="form-input" id="add-verb-pp" type="text" placeholder="Bef. igenév" />
                        <input class="form-input" id="add-verb-prog" type="text" placeholder="Folyamatos (-ing)" />
                    </div>
                    <input class="form-input" id="add-verb-3rd" type="text" placeholder="E/3 jelen" />
                    <label class="form-check">
                        <input type="checkbox" id="add-irregular" /> Rendhagyó ige
                    </label>
                </div>

                <div id="noun-fields" class="form-section" style="display:none">
                    <div class="form-section-label">Főnév</div>
                    <input class="form-input" id="add-noun-plural" type="text" placeholder="Többes szám" />
                </div>

                <div id="adj-fields" class="form-section" style="display:none">
                    <div class="form-section-label">Fokozás</div>
                    <div class="form-row">
                        <input class="form-input" id="add-adj-comp" type="text" placeholder="Középfok" />
                        <input class="form-input" id="add-adj-super" type="text" placeholder="Felsőfok" />
                    </div>
                </div>
            </div>
            <div style="margin-top:10px">
                <div class="meta-label">Státusz</div>
                <div class="detail-statuses" id="add-statuses">${statusBtnsHtml('known')}</div>
                <div class="meta-label">Fontosság</div>
                <div class="importance-row" id="add-importance">${starsHtml(null)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:12px">
                <button id="add-btn" class="add-btn">Hozzáadás</button>
                <div id="add-feedback" style="font-size:12px;color:#22c55e;display:none"></div>
            </div>
        `;
        detail.classList.add('visible', 'form-mode');

        const posSelect = detail.querySelector('#add-pos');
        posSelect.addEventListener('change', () => {
            const pos = posSelect.value;
            detail.querySelector('#verb-fields').style.display =
                pos === 'verb' ? 'flex' : 'none';
            detail.querySelector('#noun-fields').style.display =
                pos === 'noun' ? 'flex' : 'none';
            detail.querySelector('#adj-fields').style.display =
                pos === 'adj' ? 'flex' : 'none';
        });

        // Felvitelkor választható státusz (alapból „Tudom") és fontosság.
        let addStatus = 'known';
        let addImportance = null;

        const addStatusRow = detail.querySelector('#add-statuses');
        addStatusRow.querySelectorAll('.status-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.status;
                const isSame = addStatus === key;

                addStatusRow.querySelectorAll('.status-btn').forEach((b) => {
                    b.classList.remove('active');
                    b.style.background = '';
                    b.style.borderColor = '';
                    b.style.color = '';
                });

                if (!isSame) {
                    btn.classList.add('active');
                    const color = STATUS_COLORS[key];
                    btn.style.background = color;
                    btn.style.borderColor = color;
                    btn.style.color = '#fff';
                }

                addStatus = isSame ? null : key;
            });
        });

        const addImpRow = detail.querySelector('#add-importance');
        addImpRow.querySelectorAll('.imp-star').forEach((star) => {
            star.addEventListener('click', () => {
                const n = parseInt(star.dataset.star);
                addImportance = addImportance === n ? null : n;
                paintStars(addImpRow, addImportance);
            });
        });

        const geminiBtn = detail.querySelector('#gemini-fill-btn');

        if (geminiBtn) {
            geminiBtn.addEventListener('click', () => {
                geminiBtn.disabled = true;
                geminiBtn.textContent = '⏳ Töltés…';

                sendMsg({ type: 'GEMINI_LOOKUP', word: data.word }, (resp) => {
                    geminiBtn.disabled = false;
                    geminiBtn.innerHTML = '✨ AI kitöltés';

                    if (resp?.error === 'ai_limit') {
                        const fb = detail.querySelector('#add-feedback');

                        if (fb) {
                            fb.textContent =
                                resp.message ??
                                'Elérted a havi AI-felhasználási kereted.';
                            fb.style.color = '#f97316';
                            fb.style.display = 'block';
                        }

                        return;
                    }

                    if (!resp || resp.error) {
                        return;
                    }

                    const pos = resp.part_of_speech ?? '';

                    if (pos) {
                        posSelect.value = pos;
                        posSelect.dispatchEvent(new Event('change'));
                    }

                    if (resp.meaning_hu) {
                        detail.querySelector('#add-meaning').value =
                            resp.meaning_hu;
                    }

                    if (resp.extra_meanings) {
                        detail.querySelector('#add-extra').value =
                            resp.extra_meanings;
                    }

                    if (resp.synonyms) {
                        detail.querySelector('#add-synonyms').value =
                            resp.synonyms;
                    }

                    if (resp.example_en) {
                        detail.querySelector('#add-example-en').value =
                            resp.example_en;
                    }

                    if (resp.example_hu) {
                        detail.querySelector('#add-example-hu').value =
                            resp.example_hu;
                    }

                    if (pos === 'verb') {
                        if (resp.verb_past) {
                            detail.querySelector('#add-verb-past').value =
                                resp.verb_past;
                        }

                        if (resp.verb_past_participle) {
                            detail.querySelector('#add-verb-pp').value =
                                resp.verb_past_participle;
                        }

                        if (resp.verb_present_participle) {
                            detail.querySelector('#add-verb-prog').value =
                                resp.verb_present_participle;
                        }

                        if (resp.verb_third_person) {
                            detail.querySelector('#add-verb-3rd').value =
                                resp.verb_third_person;
                        }

                        if (resp.is_irregular) {
                            detail.querySelector('#add-irregular').checked =
                                true;
                        }
                    }

                    if (pos === 'noun' && resp.noun_plural) {
                        detail.querySelector('#add-noun-plural').value =
                            resp.noun_plural;
                    }

                    if (pos === 'adj') {
                        if (resp.adj_comparative) {
                            detail.querySelector('#add-adj-comp').value =
                                resp.adj_comparative;
                        }

                        if (resp.adj_superlative) {
                            detail.querySelector('#add-adj-super').value =
                                resp.adj_superlative;
                        }
                    }
                });
            });
        }

        detail.querySelector('#add-btn').addEventListener('click', () => {
            const pos = posSelect.value;
            const btn = detail.querySelector('#add-btn');
            btn.disabled = true;
            btn.textContent = '…';

            const payload = {
                type: 'ADD_WORD',
                csrf: searchCsrf,
                word: data.word,
                meaning_hu:
                    detail.querySelector('#add-meaning').value.trim() || null,
                extra_meanings:
                    detail.querySelector('#add-extra').value.trim() || null,
                synonyms:
                    detail.querySelector('#add-synonyms').value.trim() || null,
                part_of_speech: pos || null,
                example_en:
                    detail.querySelector('#add-example-en').value.trim() ||
                    null,
                example_hu:
                    detail.querySelector('#add-example-hu').value.trim() ||
                    null,
                status: addStatus,
                importance: addImportance,
            };

            if (pos === 'verb') {
                payload.form_base =
                    detail.querySelector('#add-form-base').value.trim() || null;
                payload.verb_past =
                    detail.querySelector('#add-verb-past').value.trim() || null;
                payload.verb_past_participle =
                    detail.querySelector('#add-verb-pp').value.trim() || null;
                payload.verb_present_participle =
                    detail.querySelector('#add-verb-prog').value.trim() || null;
                payload.verb_third_person =
                    detail.querySelector('#add-verb-3rd').value.trim() || null;
                payload.is_irregular =
                    detail.querySelector('#add-irregular').checked;
            }

            if (pos === 'noun') {
                payload.noun_plural =
                    detail.querySelector('#add-noun-plural').value.trim() ||
                    null;
            }

            if (pos === 'adj') {
                payload.adj_comparative =
                    detail.querySelector('#add-adj-comp').value.trim() || null;
                payload.adj_superlative =
                    detail.querySelector('#add-adj-super').value.trim() || null;
            }

            sendMsg(payload, (resp) => {
                const fb = detail.querySelector('#add-feedback');

                if (resp?.ok) {
                    btn.style.display = 'none';
                    fb.textContent = `„${data.word}" hozzáadva!`;
                    fb.style.color = '#22c55e';
                    fb.style.display = 'block';
                    refreshVocabHighlights();
                } else if (resp?.error === 'duplicate') {
                    btn.disabled = false;
                    btn.textContent = 'Hozzáadás';
                    fb.textContent = 'Már szerepel a saját szavaid között.';
                    fb.style.color = '#f97316';
                    fb.style.display = 'block';
                } else if (resp?.error === 'limit') {
                    btn.disabled = false;
                    btn.textContent = 'Hozzáadás';
                    fb.textContent = 'Elérted az ingyenes limitet (10 szó).';
                    fb.style.color = '#f97316';
                    fb.style.display = 'block';
                } else {
                    btn.disabled = false;
                    btn.textContent = 'Hozzáadás';
                    fb.textContent = 'Nem sikerült menteni — próbáld újra.';
                    fb.style.color = '#ef4444';
                    fb.style.display = 'block';
                }
            });
        });

        return;
    }

    detail.innerHTML = `
        <div class="detail-header">
            <span class="detail-word">${esc(data.word)}</span>
            ${data.part_of_speech ? `<span class="detail-pos">${esc(data.part_of_speech)}</span>` : ''}
            ${data.rank ? `<span class="detail-rank">#${data.rank}</span>` : ''}
            ${data.is_custom ? `<span style="font-size:10px;padding:1px 7px;border-radius:20px;background:#ede9fe;color:#7c3aed;font-weight:500">saját</span>` : ''}
        </div>
        <div class="detail-meaning">${esc(data.meaning_hu ?? '')}</div>
        ${data.extra_meanings ? `<div class="detail-extra">${esc(data.extra_meanings)}</div>` : ''}
        ${statusSection}
        ${importanceSection}
        <div style="display:flex;align-items:center;gap:4px">
            <a class="detail-link" href="${APP_URL}/words?search=${encodeURIComponent(data.word)}" target="_blank">Megnyitás a TopWords-ben →</a>
            <button class="detail-tts-btn" title="Kiejtés angolul">🔊</button>
            <button class="fc-btn" title="Flashcard készítése" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;border:1px solid #e2e8f0;background:none;cursor:pointer;font-size:12px;flex-shrink:0;margin-left:6px">📇</button>
        </div>
    `;
    detail.classList.add('visible');
    detail.classList.remove('form-mode');

    detail
        .querySelector('.detail-tts-btn')
        ?.addEventListener('click', () => speakWord(data.word));

    detail.querySelector('.fc-btn')?.addEventListener('click', () => {
        openFlashcardModal(data, searchCsrf);
    });

    if (searchHasAccess) {
        detail.querySelectorAll('.status-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const newStatus = btn.dataset.status;
                const isSame = btn.classList.contains('active');
                const prev = data;

                detail.querySelectorAll('.status-btn').forEach((b) => {
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

                data = { ...data, status: isSame ? null : newStatus };

                sendMsg(
                    {
                        type: 'UPDATE_STATUS',
                        id: data.id,
                        is_custom: data.is_custom,
                        status: isSame ? null : newStatus,
                        csrf: searchCsrf,
                    },
                    (resp) => {
                        if (resp?.ok) {
                            refreshVocabHighlights();

                            return;
                        }

                        if (!searchShadow) {
                            return;
                        }

                        // Sikertelen mentés → előző állapot visszaállítása
                        data = prev;
                        showSearchDetail(prev);
                    },
                );
            });
        });

        const impRow = detail.querySelector('#detail-importance');

        impRow?.querySelectorAll('.imp-star').forEach((star) => {
            star.addEventListener('click', () => {
                const n = parseInt(star.dataset.star);
                const prevImportance = data.importance ?? null;
                const next = prevImportance === n ? null : n;

                paintStars(impRow, next);
                data = { ...data, importance: next };

                sendMsg(
                    {
                        type: 'UPDATE_IMPORTANCE',
                        id: data.id,
                        is_custom: data.is_custom,
                        importance: next,
                        csrf: searchCsrf,
                    },
                    (resp) => {
                        if (!resp?.ok) {
                            // Sikertelen mentés → előző érték visszaállítása
                            data = { ...data, importance: prevImportance };
                            paintStars(impRow, prevImportance);
                        }
                    },
                );
            });
        });
    }
}

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
        if (hlEnabled) {
            highlightEnabled = true;

            if (document.readyState === 'complete') {
                loadAndApplyHighlights();
            } else {
                window.addEventListener(
                    'load',
                    () => loadAndApplyHighlights(),
                    { once: true },
                );
            }
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

// ── Közös szó/kifejezés tokenizálás ─────────────────────────────────────────
// Ugyanaz a logika, mint a webes szövegelemzőben (buildRenderTokens): a szöveget
// szó/elválasztó darabokra bontja, és a leghosszabb ismert kifejezést illeszti
// elsőként (max 3 szó, közöttük csak whitespace), így a kifejezés egy egységként
// jelölhető. A kifejezéseket a státusztérkép kulcsában lévő szóköz árulja el.

const MAX_PHRASE_WORDS = 3;
const HL_WORD_SPLIT = /([a-zA-Z]+(?:['’][a-zA-Z]+)*)/;
const phraseFlagCache = new WeakMap();

function hlKey(word) {
    return word.toLowerCase().replace(/[‘’′]/g, "'");
}

/** Igaz, ha a térkép tartalmaz legalább egy több szavas kifejezést. Map-enként cache-elt. */
function mapHasPhrases(map) {
    if (!map) {
        return false;
    }

    if (phraseFlagCache.has(map)) {
        return phraseFlagCache.get(map);
    }

    const value = [...map.keys()].some((key) => key.includes(' '));
    phraseFlagCache.set(map, value);

    return value;
}

function lookupWordStatus(map, key) {
    // Birtokos eset visszaesés: "john's" → "john".
    return map.get(key) ?? map.get(key.split("'")[0]);
}

/**
 * Tokenekre bontja a szöveget: { kind: 'sep' | 'word' | 'phrase', text, status }.
 * A státusszal rendelkező 'word'/'phrase' tokeneket kell kiemelni.
 */
function buildHlTokens(text, map, hasPhrases) {
    const parts = text.split(HL_WORD_SPLIT);
    const tokens = [];
    let i = 0;

    while (i < parts.length) {
        // Az elválasztók a páros indexeken vannak.
        if (i % 2 === 0) {
            if (parts[i] !== '') {
                tokens.push({ kind: 'sep', text: parts[i] });
            }

            i += 1;

            continue;
        }

        let matched = false;

        if (hasPhrases) {
            for (let n = MAX_PHRASE_WORDS; n >= 2; n -= 1) {
                const lastWordIdx = i + (n - 1) * 2;

                if (lastWordIdx >= parts.length) {
                    continue;
                }

                const words = [];
                let adjacent = true;

                for (let k = 0; k < n; k += 1) {
                    words.push(parts[i + k * 2]);

                    // A kifejezés szavai között csak whitespace állhat.
                    if (k < n - 1 && !/^\s+$/.test(parts[i + k * 2 + 1] ?? '')) {
                        adjacent = false;

                        break;
                    }
                }

                if (!adjacent) {
                    continue;
                }

                const status = map.get(words.map(hlKey).join(' '));

                if (status) {
                    tokens.push({
                        kind: 'phrase',
                        text: parts.slice(i, lastWordIdx + 1).join(''),
                        status,
                    });
                    i = lastWordIdx + 1;
                    matched = true;

                    break;
                }
            }
        }

        if (matched) {
            continue;
        }

        tokens.push({
            kind: 'word',
            text: parts[i],
            status: lookupWordStatus(map, hlKey(parts[i])),
        });
        i += 1;
    }

    return tokens;
}

/** Kiemelő span az élő oldalhoz. Kifejezés: szaggatott aláhúzás + halvány háttér. */
function makeHlSpan(text, status, isPhrase) {
    const color = STATUS_COLORS[status];
    const span = document.createElement('span');
    span.dataset.twHl = hlKey(text);
    span.dataset.twStatus = status;
    span.style.setProperty('display', 'inline', 'important');
    span.style.setProperty('position', 'static', 'important');
    span.style.setProperty('float', 'none', 'important');
    span.style.setProperty('text-decoration-line', 'underline', 'important');
    span.style.setProperty('text-decoration-color', color, 'important');
    span.style.setProperty('text-decoration-thickness', '2px', 'important');
    span.style.setProperty('cursor', 'pointer', 'important');

    if (isPhrase) {
        span.dataset.twPhrase = '1';
        span.style.setProperty('text-decoration-style', 'dashed', 'important');
        span.style.setProperty('background-color', `${color}1f`, 'important');
        span.style.setProperty('border-radius', '3px', 'important');
        span.style.setProperty('padding', '0 2px', 'important');
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
            return makeHlSpan(token.text, token.status, token.kind === 'phrase');
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function speakWord(word) {
    if (!window.speechSynthesis) {
        return;
    }

    window.speechSynthesis.cancel();
    const utt = new window.SpeechSynthesisUtterance(word);
    utt.lang = 'en-US';
    utt.rate = 0.9;
    window.speechSynthesis.speak(utt);
}

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

// Escape-el szöveg- ÉS attribútum-kontextushoz is (idézőjelekkel együtt), hogy
// idézett HTML-attribútumba helyezve se lehessen kitörni belőle.
function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Igaz, amíg a bővítmény kontextusa él. Újratöltés/frissítés után a régi content
// script tovább fut, ekkor a chrome.* hívások „Extension context invalidated"
// hibát dobnak — a hosszú életű observerek/interval ezzel ellenőriznek és leállnak.
function extAlive() {
    try {
        return !!chrome.runtime?.id;
    } catch {
        return false;
    }
}

// Guard-olt chrome.storage.local elérés, hogy egy halott kontextusban se dobjon.
function storageGet(defaults, callback) {
    if (!extAlive()) {
        callback?.(defaults);

        return;
    }

    try {
        chrome.storage.local.get(defaults, (values) => {
            if (chrome.runtime.lastError) {
                callback?.(defaults);

                return;
            }

            callback?.(values);
        });
    } catch {
        callback?.(defaults);
    }
}

function storageSet(values) {
    if (!extAlive()) {
        return;
    }

    try {
        chrome.storage.local.set(values);
    } catch {
        // A kontextus időközben érvénytelenné vált — nincs teendő.
    }
}

function sendMsg(msg, callback) {
    try {
        chrome.runtime.sendMessage(msg, (response) => {
            if (chrome.runtime.lastError) {
                callback?.({ error: 'network' });

                return;
            }

            callback?.(response);
        });
    } catch {
        callback?.({ error: 'network' });
    }
}

// ── YouTube Subtitle Integration ──────────────────────────────────────────────
//
// A TopWords felirat-sáv a natív YouTube felirat DOM-jából olvas, de önállóan
// kapcsolható: bekapcsoláskor magától aktiválja a natív feliratot (CC), és
// CSS-sel elrejti az eredeti megjelenítését, így csak a mi sávunk látszik.

let ytEnabled = false; // chrome.storage.local: ytLyricsEnabled (alapból kikapcsolva)
let ytWeEnabledCC = false;
let ytStatusMap = null;
let ytObserver = null;
let ytBarHost = null;

// Transcript-oldalsáv (külön kapcsolható: ytTranscriptEnabled)
let ytPanelEnabled = false;
let ytPanelHost = null;
let ytPanelSegments = [];
let ytPanelActiveIdx = -1;
let ytPanelVideo = null;
let ytPanelTimeHandler = null;
let ytPanelLastUserScroll = 0;
let ytControlsObserver = null;
let ytLastCaptionText = '';

const YT_HIDE_STYLE_ID = 'tw-yt-hide-native-captions';

function isYouTubePage() {
    return (
        location.hostname === 'www.youtube.com' &&
        location.pathname === '/watch'
    );
}

// ── Natív felirat kezelése ──

function hideNativeCaptions() {
    if (document.getElementById(YT_HIDE_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = YT_HIDE_STYLE_ID;
    // opacity + visibility: a DOM frissül tovább, csak nem látszik
    style.textContent =
        '#movie_player .caption-window { opacity: 0 !important; pointer-events: none !important; }';
    document.head.appendChild(style);
}

function showNativeCaptions() {
    document.getElementById(YT_HIDE_STYLE_ID)?.remove();
}

function ytCaptionButton() {
    return document.querySelector('.ytp-subtitles-button');
}

function ensureNativeCaptionsOn() {
    const btn = ytCaptionButton();

    if (!btn || btn.getAttribute('aria-disabled') === 'true') {
        return;
    }

    if (btn.getAttribute('aria-pressed') === 'false') {
        btn.click();
        ytWeEnabledCC = true;
    }
}

function restoreNativeCaptionState() {
    if (!ytWeEnabledCC) {
        return;
    }

    ytWeEnabledCC = false;
    const btn = ytCaptionButton();

    if (btn && btn.getAttribute('aria-pressed') === 'true') {
        btn.click();
    }
}

// ── TW kapcsoló a lejátszó vezérlősorában ──

function injectYtToggle() {
    const controls = document.querySelector('.ytp-right-controls');

    if (!controls || controls.querySelector('.tw-yt-toggle')) {
        return;
    }

    const btn = document.createElement('button');
    btn.className = 'ytp-button tw-yt-toggle';
    // A natív CC ikon stílusát követi: telt, lekerekített badge sötét
    // felirattal; bekapcsolva piros aláhúzás (mint a YouTube CC gombján).
    // display:block az svg-n, különben a baseline-ra ülve lejjebb csúszik.
    btn.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 36 36" style="display:block;pointer-events:none">
            <rect x="1" y="5" width="22" height="14" rx="3" fill="#fff"/>
            <text x="12" y="15.5" text-anchor="middle" font-family="Roboto, Arial, sans-serif" font-size="9" font-weight="800" fill="#0f0f0f">TW</text>
            <rect class="tw-underline" x="5" y="22" width="14" height="2.5" rx="1.25" fill="#f00"/>
        </svg>
    `;
    btn.addEventListener('click', toggleYtLyrics);

    // A natív felirat (CC) gomb mellé tesszük, oda illik leginkább.
    // A saját szülőjén keresztül illesztjük be, mert az új YouTube UI-ban
    // a CC gomb nem közvetlen gyereke a .ytp-right-controls-nak.
    const ccBtn = controls.querySelector('.ytp-subtitles-button');

    if (ccBtn?.parentElement) {
        ccBtn.parentElement.insertBefore(btn, ccBtn);
    } else {
        controls.prepend(btn);
    }

    updateYtToggleState();
}

function updateYtToggleState() {
    const btn = document.querySelector('.tw-yt-toggle');

    if (!btn) {
        return;
    }

    const underline = btn.querySelector('.tw-underline');

    if (underline) {
        underline.style.display = ytEnabled ? '' : 'none';
    }

    btn.title = ytEnabled
        ? 'TopWords felirat kikapcsolása'
        : 'TopWords felirat bekapcsolása';
}

function toggleYtLyrics() {
    ytEnabled = !ytEnabled;
    storageSet({ ytLyricsEnabled: ytEnabled });

    if (ytEnabled) {
        enableYtLyrics();
    } else {
        disableYtLyrics();
    }

    updateYtToggleState();
}

// ── Videó vezérlés ──

function pauseVideoIfPlaying() {
    // Közvetlenül a video elemet állítjuk meg — a play gombnak nincs
    // megbízható állapot-attribútuma.
    const video = document.querySelector('#movie_player video');

    if (video && !video.paused) {
        video.pause();
    }
}

// ── Felirat-sáv ──

function ensureYtBar() {
    if (ytBarHost?.isConnected) {
        return;
    }

    ytBarHost?.remove();
    ytBarHost = null;

    const player = document.querySelector('#movie_player');

    if (!player) {
        return;
    }

    ytBarHost = document.createElement('div');
    ytBarHost.id = 'tw-yt-bar-host';
    Object.assign(ytBarHost.style, {
        position: 'absolute',
        bottom: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483646',
        pointerEvents: 'none',
        width: 'max-content',
        maxWidth: '90%',
    });

    const shadow = ytBarHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            #bar {
                display: none;
                background: rgba(8,8,8,0.85);
                backdrop-filter: blur(4px);
                border-radius: 6px;
                padding: 8px 14px;
                font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
                font-size: 20px;
                line-height: 1.5;
                color: #fff;
                text-align: center;
                word-break: break-word;
                pointer-events: auto;
                transition: opacity 0.15s;
            }
            .tw-word {
                cursor: pointer;
                border-radius: 3px;
                padding: 0 1px;
                transition: opacity 0.1s;
            }
            .tw-word:hover { opacity: 0.8; }
        </style>
        <div id="bar"></div>
    `;

    shadow.getElementById('bar').addEventListener('click', (e) => {
        handleYtWordClick(e.target.closest('.tw-word'));
    });

    player.appendChild(ytBarHost);
}

/**
 * Felirat-szöveg → HTML, ahol a szó-tokenek `.tw-word` span-ek, a megjelölt
 * szavak (és ragozott alakjaik) a státuszuk színével. A sáv és az oldalsáv is ezt használja.
 */
function ytWordsToHtml(text) {
    const tokens = buildHlTokens(
        text,
        ytStatusMap ?? new Map(),
        mapHasPhrases(ytStatusMap),
    );

    let html = '';

    tokens.forEach((token) => {
        // Az elválasztók sima szövegként mennek (nem kattinthatók).
        if (token.kind === 'sep') {
            html += esc(token.text);

            return;
        }

        // Minden szó ÉS kifejezés kattintható `.tw-word` span — a szín csak akkor
        // kerül rá, ha van státusza, hogy a státusz nélküli szavakat is ki lehessen
        // keresni kattintással (mint korábban).
        const attr = esc(token.text);
        const color = token.status ? STATUS_COLORS[token.status] : null;

        if (token.kind === 'phrase') {
            // Kifejezés: szín + halvány háttér-pill, hogy egységként látsszon.
            const style = color
                ? `style="color:${color};text-shadow:0 0 8px ${color}66;background:${color}26;border-radius:4px;padding:0 3px"`
                : '';
            html += `<span class="tw-word tw-phrase" data-yt-word="${attr}" ${style}>${esc(token.text)}</span>`;
        } else {
            const style = color
                ? `style="color:${color};text-shadow:0 0 8px ${color}66"`
                : '';
            html += `<span class="tw-word" data-yt-word="${attr}" ${style}>${esc(token.text)}</span>`;
        }
    });

    return html;
}

/** Egy felirat-szóra kattintás: videó megállítása, kiejtés, popup. */
function handleYtWordClick(span) {
    if (!span) {
        return;
    }

    const word = span.dataset.ytWord?.replace(/^'|'$/g, '') ?? '';

    if (!word) {
        return;
    }

    pauseVideoIfPlaying();
    speakWord(word);
    showPopup(word, span.getBoundingClientRect(), true);
}

function renderYtBar(text) {
    const bar = ytBarHost?.shadowRoot?.getElementById('bar');

    if (!bar) {
        return;
    }

    if (!text.trim()) {
        bar.innerHTML = '';
        bar.style.display = 'none';

        return;
    }

    ytLastCaptionText = text;
    bar.innerHTML = ytWordsToHtml(text);
    bar.style.display = 'block';
}

function startYtObserver() {
    ytObserver?.disconnect();

    let lastText = '';

    ytObserver = new MutationObserver(() => {
        if (!extAlive()) {
            destroyYtSubtitles();

            return;
        }

        // A lejátszó újrarenderelésekor a sáv és a gomb is eltűnhet —
        // olcsó guard-okkal visszatesszük.
        ensureYtBar();
        injectYtToggle();

        const segments = document.querySelectorAll('.ytp-caption-segment');
        const text = Array.from(segments)
            .map((s) => s.textContent)
            .join(' ')
            .trim();

        if (text === lastText) {
            return;
        }

        lastText = text;
        renderYtBar(text);
    });

    const player =
        document.querySelector('#movie_player') ?? document.documentElement;
    ytObserver.observe(player, {
        childList: true,
        subtree: true,
        characterData: true,
    });
}

// ── Be/ki kapcsolás ──

/**
 * A szó→státusz térképet egyszer kéri le és cache-eli; a sáv és az oldalsáv is ezt hívja.
 * A callback megkapja az esetleges hibát ('network' | 'unauthenticated' | null).
 */
function ensureYtStatusMap(callback) {
    if (ytStatusMap) {
        callback(null);

        return;
    }

    sendMsg({ type: 'GET_STATUSES' }, (resp) => {
        if (resp && !resp.error && resp.statuses) {
            ytStatusMap = new Map(
                Object.entries(resp.statuses).map(([w, s]) => [
                    w.toLowerCase(),
                    s,
                ]),
            );
            callback(null);

            return;
        }

        callback(resp?.error ?? 'network');
    });
}

/** Rövid értesítés a feliratsávban (pl. nincs bejelentkezés / kapcsolat). */
function showYtBarNotice(text) {
    const bar = ytBarHost?.shadowRoot?.getElementById('bar');

    if (!bar) {
        return;
    }

    bar.textContent = text;
    bar.style.display = 'block';

    setTimeout(() => {
        if (bar.textContent === text) {
            bar.style.display = 'none';
            bar.textContent = '';
        }
    }, 6000);
}

/**
 * Egy szó státuszának/felvitelének mentése után frissíti a státusztérképet, és
 * azonnal újrarajzolja az aktív felületeket (feliratsáv, átirat-oldalsáv, oldali
 * kiemelés), hogy a változás külön frissítés nélkül látszódjon.
 */
function refreshVocabHighlights() {
    sendMsg({ type: 'GET_STATUSES' }, (resp) => {
        if (!resp || resp.error || !resp.statuses) {
            return;
        }

        const map = new Map(
            Object.entries(resp.statuses).map(([w, s]) => [w.toLowerCase(), s]),
        );

        if (ytStatusMap) {
            ytStatusMap = map;

            if (ytLastCaptionText) {
                renderYtBar(ytLastCaptionText);
            }

            if (ytPanelSegments.length) {
                renderYtPanelSegments();
            }
        }

        if (nfxEnabled && nfxLastCaptionText) {
            ytStatusMap = map;
            renderNfxBar(nfxLastCaptionText);
        }

        if (hlWordMap) {
            hlWordMap = map;
            removeHighlights();
            applyHighlights();
        }
    });
}

function enableYtLyrics() {
    ensureYtBar();
    ensureNativeCaptionsOn();
    ensureYtStatusMap((error) => {
        if (error) {
            // Bejelentkezés/kapcsolat hiányában nem rejtjük el a natív feliratot —
            // a felhasználó látja az okát, és megmaradnak a normál feliratai.
            showYtBarNotice(
                error === 'network'
                    ? 'Nincs kapcsolat a TopWords-szel.'
                    : 'Jelentkezz be a TopWords-be a szókiemeléshez.',
            );

            return;
        }

        hideNativeCaptions();
        startYtObserver();
    });
}

function disableYtLyrics() {
    ytObserver?.disconnect();
    ytObserver = null;
    ytBarHost?.remove();
    ytBarHost = null;
    showNativeCaptions();
    restoreNativeCaptionState();
}

// ── Transcript-oldalsáv ─────────────────────────────────────────────────────

function currentYtVideoId() {
    return new URLSearchParams(location.search).get('v');
}

function formatYtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');

    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// A lejátszó alsó vezérlősora kb. ennyi magas — ennyit hagyunk neki a panel alján.
const YT_CONTROLS_GAP = 60;

/**
 * A panel pozíciója módfüggő:
 * - Teljes képernyő: a panel a viewport jobb oldalán, a kontrolloknak helyet hagyva.
 * - Színházi mód: a lejátszó teljes szélességű, az alsó kontrollok a kép alján
 *   (a viewport közepe táján) vannak — ezért a panelt a lejátszó dobozához
 *   igazítjuk, és a kontrollok fölött zárjuk le, hogy ne lógjon beléjük.
 * - Normál mód: a jobb oldali oszlopban, teljes magasságban (a kontrollok a bal
 *   oldali lejátszóban vannak, nem fed át).
 */
function positionYtPanel() {
    if (!ytPanelHost) {
        return;
    }

    const style = ytPanelHost.style;

    if (document.fullscreenElement) {
        // Teljes képernyőn csak a fullscreen elem leszármazottai látszanak —
        // ezért a panelt oda tesszük át (body-ban nem jelenne meg).
        if (ytPanelHost.parentElement !== document.fullscreenElement) {
            document.fullscreenElement.appendChild(ytPanelHost);
        }

        style.top = '12px';
        style.bottom = `${YT_CONTROLS_GAP + 20}px`;

        return;
    }

    // Nem teljes képernyő: a panel a body-ban él.
    if (ytPanelHost.parentElement !== document.body) {
        document.body.appendChild(ytPanelHost);
    }

    const theater = !!document.querySelector('ytd-watch-flexy[theater]');
    const player = document.querySelector('#movie_player');

    if (theater && player) {
        const rect = player.getBoundingClientRect();
        style.top = `${Math.max(12, rect.top + 8)}px`;
        style.bottom = `${Math.max(12, window.innerHeight - rect.bottom + YT_CONTROLS_GAP)}px`;

        return;
    }

    style.top = '64px';
    style.bottom = '12px';
}

function attachYtPanelLayoutListeners() {
    window.addEventListener('scroll', positionYtPanel, true);
    window.addEventListener('resize', positionYtPanel);
    document.addEventListener('fullscreenchange', positionYtPanel);
}

function detachYtPanelLayoutListeners() {
    window.removeEventListener('scroll', positionYtPanel, true);
    window.removeEventListener('resize', positionYtPanel);
    document.removeEventListener('fullscreenchange', positionYtPanel);
}

function ensureYtPanel() {
    if (ytPanelHost?.isConnected) {
        return;
    }

    ytPanelHost?.remove();
    ytPanelHost = document.createElement('div');
    ytPanelHost.id = 'tw-yt-panel-host';
    Object.assign(ytPanelHost.style, {
        position: 'fixed',
        top: '64px',
        right: '12px',
        bottom: '12px',
        width: '360px',
        maxWidth: '40vw',
        zIndex: '2147483645',
    });
    positionYtPanel();

    const shadow = ytPanelHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            #panel {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: rgba(15,15,15,0.96);
                color: #f1f1f1;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 12px;
                font-family: Roboto, Arial, sans-serif;
                overflow: hidden;
                box-shadow: 0 8px 30px rgba(0,0,0,0.5);
            }
            #head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 10px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            #title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            #close { background: none; border: none; color: #aaa; font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; }
            #close:hover { color: #fff; }
            #body { flex: 1; overflow-y: auto; padding: 6px; scrollbar-width: thin; }
            .msg { padding: 16px; color: #aaa; font-size: 13px; text-align: center; line-height: 1.5; }
            .msg a { color: #3ea6ff; }
            .seg { display: flex; gap: 8px; padding: 6px 8px; border-radius: 8px; cursor: pointer; font-size: 14px; line-height: 1.45; }
            .seg:hover { background: rgba(255,255,255,0.07); }
            .seg.active { background: rgba(62,166,255,0.16); }
            .ts { flex: 0 0 auto; min-width: 40px; padding-top: 2px; color: #3ea6ff; font-size: 12px; font-variant-numeric: tabular-nums; }
            .txt { flex: 1; }
            .tw-word { cursor: pointer; border-radius: 3px; }
            .tw-word:hover { opacity: 0.8; text-decoration: underline; }
        </style>
        <div id="panel">
            <div id="head">
                <span id="title">Átirat</span>
                <button id="close" title="Bezárás">×</button>
            </div>
            <div id="body"><div class="msg">Betöltés…</div></div>
        </div>
    `;

    shadow.getElementById('close').addEventListener('click', toggleYtPanel);

    const body = shadow.getElementById('body');
    body.addEventListener('click', (e) => {
        const wordSpan = e.target.closest('.tw-word');

        if (wordSpan) {
            handleYtWordClick(wordSpan);

            return;
        }

        const row = e.target.closest('.seg');

        if (row) {
            seekYtTo(Number(row.dataset.t));
        }
    });
    body.addEventListener('scroll', () => {
        ytPanelLastUserScroll = Date.now();
    });

    document.body.appendChild(ytPanelHost);
    attachYtPanelLayoutListeners();
}

function seekYtTo(t) {
    const video = document.querySelector('#movie_player video');

    if (video && Number.isFinite(t)) {
        video.currentTime = t;
        video.play?.();
    }
}

function setYtPanelMessage(html) {
    const body = ytPanelHost?.shadowRoot?.getElementById('body');

    if (body) {
        body.innerHTML = `<div class="msg">${html}</div>`;
    }
}

function renderYtPanelSegments() {
    const body = ytPanelHost?.shadowRoot?.getElementById('body');

    if (!body) {
        return;
    }

    if (!ytPanelSegments.length) {
        setYtPanelMessage('Ehhez a videóhoz nincs elérhető átirat.');

        return;
    }

    body.innerHTML = ytPanelSegments
        .map(
            (seg, i) =>
                `<div class="seg" data-idx="${i}" data-t="${seg.t}">` +
                `<span class="ts">${formatYtTime(seg.t)}</span>` +
                `<span class="txt">${ytWordsToHtml(seg.x)}</span>` +
                `</div>`,
        )
        .join('');
    ytPanelActiveIdx = -1;
}

function attachYtPanelTimeTracking() {
    detachYtPanelTimeTracking();
    ytPanelVideo = document.querySelector('#movie_player video');

    if (!ytPanelVideo) {
        return;
    }

    ytPanelTimeHandler = () =>
        updateYtPanelActiveSegment(ytPanelVideo.currentTime);
    ytPanelVideo.addEventListener('timeupdate', ytPanelTimeHandler);
}

function detachYtPanelTimeTracking() {
    if (ytPanelVideo && ytPanelTimeHandler) {
        ytPanelVideo.removeEventListener('timeupdate', ytPanelTimeHandler);
    }

    ytPanelVideo = null;
    ytPanelTimeHandler = null;
}

function updateYtPanelActiveSegment(time) {
    if (!ytPanelSegments.length) {
        return;
    }

    let idx = ytPanelActiveIdx;

    // Csak akkor keressük újra, ha a jelenlegi index már nem stimmel (tekerés is OK).
    const stale =
        idx < 0 ||
        idx >= ytPanelSegments.length ||
        ytPanelSegments[idx].t > time ||
        (idx + 1 < ytPanelSegments.length &&
            ytPanelSegments[idx + 1].t <= time);

    if (stale) {
        idx = 0;

        for (let i = 0; i < ytPanelSegments.length; i++) {
            if (ytPanelSegments[i].t <= time) {
                idx = i;
            } else {
                break;
            }
        }
    }

    if (idx === ytPanelActiveIdx) {
        return;
    }

    ytPanelActiveIdx = idx;
    const shadow = ytPanelHost?.shadowRoot;

    if (!shadow) {
        return;
    }

    shadow
        .querySelectorAll('.seg.active')
        .forEach((el) => el.classList.remove('active'));
    const row = shadow.querySelector(`.seg[data-idx="${idx}"]`);

    if (!row) {
        return;
    }

    row.classList.add('active');

    // Auto-görgetés, kivéve ha a felhasználó nemrég maga görgetett.
    if (Date.now() - ytPanelLastUserScroll > 4000) {
        const body = shadow.getElementById('body');
        body.scrollTop =
            row.offsetTop - body.clientHeight / 2 + row.clientHeight / 2;
    }
}

function enableYtPanel() {
    ensureYtPanel();

    const videoId = currentYtVideoId();

    if (!videoId) {
        setYtPanelMessage('Nincs videó.');

        return;
    }

    setYtPanelMessage('Betöltés…');

    ensureYtStatusMap(() => {
        sendMsg({ type: 'GET_YT_TRANSCRIPT', videoId }, (resp) => {
            if (!ytPanelEnabled || !ytPanelHost) {
                return;
            }

            if (!resp || resp.error === 'network') {
                setYtPanelMessage('Nincs kapcsolat a TopWords-szel.');

                return;
            }

            if (resp.error === 'unauthenticated') {
                setYtPanelMessage(
                    `Jelentkezz be a <a href="${APP_URL}" target="_blank">TopWords</a>-be.`,
                );

                return;
            }

            if (resp.error === 'premium') {
                setYtPanelMessage(
                    `Az átirat prémium funkció. <a href="${APP_URL}/pricing" target="_blank">Frissíts prémiumra →</a>`,
                );

                return;
            }

            if (resp.error || !Array.isArray(resp.segments)) {
                setYtPanelMessage('Ehhez a videóhoz nem érhető el átirat.');

                return;
            }

            ytPanelSegments = resp.segments;
            const titleEl = ytPanelHost.shadowRoot?.getElementById('title');

            if (titleEl && resp.title) {
                titleEl.textContent = resp.title;
            }

            renderYtPanelSegments();
            attachYtPanelTimeTracking();
        });
    });
}

function disableYtPanel() {
    detachYtPanelTimeTracking();
    detachYtPanelLayoutListeners();
    ytPanelHost?.remove();
    ytPanelHost = null;
    ytPanelSegments = [];
    ytPanelActiveIdx = -1;
}

function toggleYtPanel() {
    ytPanelEnabled = !ytPanelEnabled;
    storageSet({ ytTranscriptEnabled: ytPanelEnabled });

    if (ytPanelEnabled) {
        enableYtPanel();
    } else {
        disableYtPanel();
    }

    updateYtPanelToggleState();
}

function injectYtPanelToggle() {
    const controls = document.querySelector('.ytp-right-controls');

    if (!controls || controls.querySelector('.tw-yt-panel-toggle')) {
        return;
    }

    const btn = document.createElement('button');
    btn.className = 'ytp-button tw-yt-panel-toggle';
    // A TW gomb ikonjának footprintjét követi (x≈1..23, y≈5..24), hogy egy vonalban legyen.
    btn.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 36 36" style="display:block;pointer-events:none">
            <rect x="2" y="5.5" width="21" height="2.4" rx="1.2" fill="#fff"/>
            <rect x="2" y="10.8" width="21" height="2.4" rx="1.2" fill="#fff"/>
            <rect x="2" y="16.1" width="14" height="2.4" rx="1.2" fill="#fff"/>
            <rect class="tw-panel-underline" x="5" y="20.5" width="14" height="2.5" rx="1.25" fill="#f00"/>
        </svg>
    `;
    btn.addEventListener('click', toggleYtPanel);

    const ccBtn = controls.querySelector('.ytp-subtitles-button');

    if (ccBtn?.parentElement) {
        ccBtn.parentElement.insertBefore(btn, ccBtn);
    } else {
        controls.prepend(btn);
    }

    updateYtPanelToggleState();
}

function updateYtPanelToggleState() {
    const btn = document.querySelector('.tw-yt-panel-toggle');

    if (!btn) {
        return;
    }

    const underline = btn.querySelector('.tw-panel-underline');

    if (underline) {
        underline.style.display = ytPanelEnabled ? '' : 'none';
    }

    btn.title = ytPanelEnabled
        ? 'TopWords átirat kikapcsolása'
        : 'TopWords átirat bekapcsolása';
}

// A lejátszó vezérlősora gyakran újrarenderelődik — egy könnyű, frame-enként
// összevont observerrel tartjuk életben mindkét TW gombot.
function startYtControlsObserver() {
    ytControlsObserver?.disconnect();

    let pending = false;
    ytControlsObserver = new MutationObserver(() => {
        if (!extAlive()) {
            ytControlsObserver?.disconnect();
            ytControlsObserver = null;

            return;
        }

        if (pending) {
            return;
        }

        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            injectYtToggle();
            injectYtPanelToggle();
            positionYtPanel();
        });
    });

    const player =
        document.querySelector('#movie_player') ?? document.documentElement;
    ytControlsObserver.observe(player, { childList: true, subtree: true });
}

function destroyYtSubtitles() {
    ytObserver?.disconnect();
    ytObserver = null;
    ytControlsObserver?.disconnect();
    ytControlsObserver = null;
    ytBarHost?.remove();
    ytBarHost = null;
    disableYtPanel();
    ytStatusMap = null;
    // Navigációnál nem kattintunk a CC gombra (már másik videóra mutatna),
    // csak a flag-et és a rejtő CSS-t takarítjuk.
    ytWeEnabledCC = false;
    showNativeCaptions();
}

function initYtSubtitles(attempt = 0) {
    if (!isYouTubePage()) {
        return;
    }

    if (!document.querySelector('#movie_player')) {
        if (attempt < 8) {
            setTimeout(() => initYtSubtitles(attempt + 1), 1000);
        }

        return;
    }

    storageGet(
        { ytLyricsEnabled: false, ytTranscriptEnabled: false },
        ({ ytLyricsEnabled, ytTranscriptEnabled }) => {
            if (!isYouTubePage()) {
                return;
            }

            ytEnabled = ytLyricsEnabled;
            ytPanelEnabled = ytTranscriptEnabled;
            injectYtToggle();
            injectYtPanelToggle();
            startYtControlsObserver();

            if (ytEnabled) {
                enableYtLyrics();
            }

            if (ytPanelEnabled) {
                enableYtPanel();
            }
        },
    );
}

function handleYtNavigation() {
    destroyYtSubtitles();

    if (isYouTubePage()) {
        setTimeout(initYtSubtitles, 1000);
    }
}

if (location.hostname === 'www.youtube.com') {
    window.addEventListener('yt-navigate-finish', handleYtNavigation);
    window.addEventListener('popstate', handleYtNavigation);

    if (isYouTubePage()) {
        if (document.readyState === 'complete') {
            initYtSubtitles();
        } else {
            window.addEventListener('load', () => initYtSubtitles(), {
                once: true,
            });
        }
    }
}

// ── Netflix Subtitle Integration ──────────────────────────────────────────────
//
// A YouTube felirat-sáv párja Netflixre: a natív felirat (.player-timedtext) a
// DOM-ba renderelődik, ezt olvassuk, elrejtjük, és helyette saját kattintható
// sávot rajzolunk a lejátszóra. A szótér-/popup-/kiejtés-gépezet közös a
// YouTube-bal (ytStatusMap, ensureYtStatusMap, ytWordsToHtml, showPopup).
//
// A teljes átirat-oldalsáv (YouTube-on /extension/youtube-transcript) itt nincs:
// a Netflixnek nincs egyszerűen elérhető átirat-forrása.

let nfxEnabled = false; // chrome.storage.local: nfxLyricsEnabled (alapból ki)
let nfxObserver = null;
let nfxBarHost = null;
let nfxToggleHost = null;
let nfxLastCaptionText = '';
let nfxNavInterval = null;
let nfxNoticeShown = false;

const NFX_HIDE_STYLE_ID = 'tw-nfx-hide-native-captions';

function isNetflixWatchPage() {
    return (
        location.hostname === 'www.netflix.com' &&
        location.pathname.startsWith('/watch')
    );
}

/** A lejátszó konténere — ez megy teljes képernyőre is, ezért ebbe tesszük a sávot/gombot. */
function nfxPlayerContainer() {
    return (
        document.querySelector('.watch-video') ??
        document.querySelector('[data-uia="watch-video"]') ??
        document.querySelector('.player-timedtext')?.parentElement ??
        null
    );
}

function nfxVideo() {
    return (
        document.querySelector('.watch-video video') ??
        document.querySelector('video')
    );
}

// ── Natív felirat elrejtése ──

function hideNfxNativeCaptions() {
    if (document.getElementById(NFX_HIDE_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = NFX_HIDE_STYLE_ID;
    // opacity: a DOM tovább frissül (innen olvasunk), csak nem látszik.
    style.textContent =
        '.player-timedtext { opacity: 0 !important; pointer-events: none !important; }';
    document.head.appendChild(style);
}

function showNfxNativeCaptions() {
    document.getElementById(NFX_HIDE_STYLE_ID)?.remove();
}

// ── Felirat-sáv ──

function ensureNfxBar() {
    if (nfxBarHost?.isConnected) {
        return;
    }

    nfxBarHost?.remove();
    nfxBarHost = null;

    const player = nfxPlayerContainer();

    if (!player) {
        return;
    }

    nfxBarHost = document.createElement('div');
    nfxBarHost.id = 'tw-nfx-bar-host';
    Object.assign(nfxBarHost.style, {
        position: 'absolute',
        bottom: '18%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483646',
        pointerEvents: 'none',
        width: 'max-content',
        maxWidth: '80%',
    });

    const shadow = nfxBarHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            #bar {
                display: none;
                background: rgba(8,8,8,0.85);
                backdrop-filter: blur(4px);
                border-radius: 6px;
                padding: 10px 18px;
                font-family: 'Netflix Sans', Roboto, Arial, sans-serif;
                font-size: 26px;
                line-height: 1.5;
                color: #fff;
                text-align: center;
                word-break: break-word;
                pointer-events: auto;
            }
            .tw-word {
                cursor: pointer;
                border-radius: 3px;
                padding: 0 1px;
                transition: opacity 0.1s;
            }
            .tw-word:hover { opacity: 0.8; }
        </style>
        <div id="bar"></div>
    `;

    shadow.getElementById('bar').addEventListener('click', (e) => {
        handleNfxWordClick(e.target.closest('.tw-word'));
    });

    player.appendChild(nfxBarHost);
}

/** Felirat-szóra kattintás: videó megáll, kiejtés, jelentés-popup. */
function handleNfxWordClick(span) {
    if (!span) {
        return;
    }

    const word = span.dataset.ytWord?.replace(/^'|'$/g, '') ?? '';

    if (!word) {
        return;
    }

    const video = nfxVideo();

    if (video && !video.paused) {
        video.pause();
    }

    speakWord(word);
    showPopup(word, span.getBoundingClientRect(), true);
}

function renderNfxBar(text) {
    const bar = nfxBarHost?.shadowRoot?.getElementById('bar');

    if (!bar) {
        return;
    }

    if (!text.trim()) {
        bar.innerHTML = '';
        bar.style.display = 'none';

        return;
    }

    nfxLastCaptionText = text;
    // A szó-tokenizálást/színezést a YouTube-bal közös segéddel végezzük.
    bar.innerHTML = ytWordsToHtml(text);
    bar.style.display = 'block';
}

function showNfxBarNotice(text) {
    const bar = nfxBarHost?.shadowRoot?.getElementById('bar');

    if (!bar) {
        return;
    }

    bar.textContent = text;
    bar.style.display = 'block';

    setTimeout(() => {
        if (bar.textContent === text) {
            bar.style.display = 'none';
            bar.textContent = '';
        }
    }, 6000);
}

function readNfxCaptionText() {
    const container = document.querySelector('.player-timedtext');

    return container ? container.innerText.trim() : '';
}

function startNfxObserver() {
    nfxObserver?.disconnect();

    let lastText = '';
    nfxNoticeShown = false;

    nfxObserver = new MutationObserver(() => {
        if (!extAlive()) {
            destroyNfxSubtitles();

            return;
        }

        // A lejátszó újrarenderelésekor a sáv eltűnhet — olcsó guarddal visszatesszük.
        ensureNfxBar();

        const text = readNfxCaptionText();

        if (text === lastText) {
            return;
        }

        lastText = text;
        renderNfxBar(text);
    });

    const player = nfxPlayerContainer() ?? document.documentElement;
    nfxObserver.observe(player, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    // Ha pár másodperc után sincs felirat-szöveg, a felhasználónak be kell
    // kapcsolnia a Netflix feliratot — ezt nem tudjuk megbízhatóan automatizálni.
    setTimeout(() => {
        if (nfxEnabled && !readNfxCaptionText() && !nfxNoticeShown) {
            nfxNoticeShown = true;
            showNfxBarNotice('Kapcsold be a feliratot a Netflixen (CC).');
        }
    }, 4000);
}

// ── Lebegő be/ki kapcsoló a lejátszón ──

function ensureNfxToggle() {
    if (nfxToggleHost?.isConnected) {
        updateNfxToggleState();

        return;
    }

    nfxToggleHost?.remove();
    nfxToggleHost = null;

    const player = nfxPlayerContainer();

    if (!player) {
        return;
    }

    nfxToggleHost = document.createElement('div');
    nfxToggleHost.id = 'tw-nfx-toggle-host';
    Object.assign(nfxToggleHost.style, {
        position: 'absolute',
        bottom: '150px',
        right: '60px',
        zIndex: '2147483646',
    });

    const shadow = nfxToggleHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            #btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 68px;
                height: 46px;
                border: none;
                border-radius: 8px;
                background: rgba(0,0,0,0.55);
                cursor: pointer;
                padding: 0;
                opacity: 0.85;
                transition: opacity 0.15s, background 0.15s;
            }
            #btn:hover { opacity: 1; background: rgba(0,0,0,0.75); }
        </style>
        <button id="btn" title="TopWords felirat">
            <svg width="50" height="32" viewBox="0 0 36 24" style="display:block">
                <rect x="1" y="3" width="26" height="16" rx="3" fill="#fff"/>
                <text x="14" y="15" text-anchor="middle" font-family="Roboto, Arial, sans-serif" font-size="10" font-weight="800" fill="#0f0f0f">TW</text>
                <rect class="tw-underline" x="6" y="21" width="16" height="2.5" rx="1.25" fill="#e50914"/>
            </svg>
        </button>
    `;

    shadow.getElementById('btn').addEventListener('click', toggleNfxLyrics);

    player.appendChild(nfxToggleHost);
    updateNfxToggleState();
}

function updateNfxToggleState() {
    const shadow = nfxToggleHost?.shadowRoot;

    if (!shadow) {
        return;
    }

    const underline = shadow.querySelector('.tw-underline');

    if (underline) {
        underline.style.display = nfxEnabled ? '' : 'none';
    }

    const btn = shadow.getElementById('btn');

    if (btn) {
        btn.title = nfxEnabled
            ? 'TopWords felirat kikapcsolása'
            : 'TopWords felirat bekapcsolása';
    }
}

// ── Be/ki kapcsolás ──

function toggleNfxLyrics() {
    nfxEnabled = !nfxEnabled;
    storageSet({ nfxLyricsEnabled: nfxEnabled });

    if (nfxEnabled) {
        enableNfxLyrics();
    } else {
        disableNfxLyrics();
    }

    updateNfxToggleState();
}

function enableNfxLyrics() {
    ensureNfxBar();
    ensureYtStatusMap((error) => {
        if (error) {
            showNfxBarNotice(
                error === 'network'
                    ? 'Nincs kapcsolat a TopWords-szel.'
                    : 'Jelentkezz be a TopWords-be a szókiemeléshez.',
            );

            return;
        }

        hideNfxNativeCaptions();
        startNfxObserver();
    });
}

function disableNfxLyrics() {
    nfxObserver?.disconnect();
    nfxObserver = null;
    nfxBarHost?.remove();
    nfxBarHost = null;
    nfxLastCaptionText = '';
    showNfxNativeCaptions();
}

// A lejátszó vezérlősora/DOM-ja gyakran újrarenderelődik — egy könnyű,
// frame-enként összevont observerrel tartjuk életben a kapcsolót és a sávot.
let nfxControlsObserver = null;

function startNfxControlsObserver() {
    nfxControlsObserver?.disconnect();

    let pending = false;
    nfxControlsObserver = new MutationObserver(() => {
        if (!extAlive()) {
            nfxControlsObserver?.disconnect();
            nfxControlsObserver = null;

            return;
        }

        if (pending) {
            return;
        }

        pending = true;
        requestAnimationFrame(() => {
            pending = false;

            if (!isNetflixWatchPage()) {
                return;
            }

            ensureNfxToggle();

            if (nfxEnabled) {
                ensureNfxBar();
            }
        });
    });

    nfxControlsObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

function destroyNfxSubtitles() {
    nfxObserver?.disconnect();
    nfxObserver = null;
    nfxControlsObserver?.disconnect();
    nfxControlsObserver = null;
    nfxBarHost?.remove();
    nfxBarHost = null;
    nfxToggleHost?.remove();
    nfxToggleHost = null;
    nfxLastCaptionText = '';
    showNfxNativeCaptions();
}

function initNfxSubtitles(attempt = 0) {
    if (!isNetflixWatchPage()) {
        return;
    }

    if (!nfxPlayerContainer()) {
        if (attempt < 10) {
            setTimeout(() => initNfxSubtitles(attempt + 1), 1000);
        }

        return;
    }

    storageGet(
        { nfxLyricsEnabled: false },
        ({ nfxLyricsEnabled }) => {
            if (!isNetflixWatchPage()) {
                return;
            }

            nfxEnabled = nfxLyricsEnabled;
            ensureNfxToggle();
            startNfxControlsObserver();

            if (nfxEnabled) {
                enableNfxLyrics();
            }
        },
    );
}

// A Netflix SPA: nincs dedikált navigációs esemény, ezért az URL-t figyeljük.
function startNfxNavWatch() {
    if (nfxNavInterval) {
        return;
    }

    let lastPath = location.pathname + location.search;
    nfxNavInterval = setInterval(() => {
        if (!extAlive()) {
            clearInterval(nfxNavInterval);
            nfxNavInterval = null;

            return;
        }

        const path = location.pathname + location.search;

        if (path === lastPath) {
            return;
        }

        lastPath = path;
        destroyNfxSubtitles();

        if (isNetflixWatchPage()) {
            setTimeout(() => initNfxSubtitles(), 1200);
        }
    }, 1000);
}

if (location.hostname === 'www.netflix.com') {
    startNfxNavWatch();

    if (isNetflixWatchPage()) {
        if (document.readyState === 'complete') {
            initNfxSubtitles();
        } else {
            window.addEventListener('load', () => initNfxSubtitles(), {
                once: true,
            });
        }
    }
}
