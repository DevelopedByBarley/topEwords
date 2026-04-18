const APP_URL = 'https://topwords.eu';

const STATUS_LABELS = {
    learning: 'Tanulom',
    saved: 'Mentett',
    known: 'Tudom',
    pronunciation: 'Kiejtés',
};

const STATUS_COLORS = {
    learning: '#3b82f6',
    saved: '#f97316',
    known: '#22c55e',
    pronunciation: '#8b5cf6',
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

    .footer {
        display: flex;
        align-items: center;
        padding-top: 8px;
        border-top: 1px solid #f1f5f9;
    }

    a.link {
        font-size: 12px;
        color: #6366f1;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    a.link:hover { color: #4f46e5; }

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
    if (host && host.contains(e.target)) return;
    clearTimeout(holdTimer);

    if (e.detail === 2) {
        // Dupla klikk + nyomva tartás → popup
        holdTimer = setTimeout(() => {
            const selection = window.getSelection();
            const text = selection?.toString().trim();
            if (!text) return;
            const word = text.replace(/[^a-zA-Z'-]/g, '').trim();
            if (!word || word.length < 2 || text.split(/\s+/).length > 1) return;
            if (word === currentWord && host) return;
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            showPopup(word, rect);
        }, 300);
    }
});

document.addEventListener('mouseup', () => {
    clearTimeout(holdTimer);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hidePopup(); hideSearch(); }
    if (e.altKey && e.code === 'KeyW') { e.preventDefault(); toggleSearch(); }

    // 1–4 státusz billentyűk nyitott popup-nál
    if (shadow && currentData?.found && currentData?.has_active_access) {
        const statusByKey = { '1': 'learning', '2': 'saved', '3': 'known', '4': 'pronunciation' };
        const status = statusByKey[e.key];
        if (status) {
            const btn = shadow.querySelector(`.status-btn[data-status="${status}"]`);
            if (btn) { e.preventDefault(); handleStatusClick(btn, currentData); }
        }
    }
});

// ── Popup ─────────────────────────────────────────────────────────────────────

function showPopup(word, rect) {
    hidePopup();
    currentWord = word;

    // Shadow DOM host
    host = document.createElement('div');
    host.style.cssText = `
        position: absolute;
        z-index: 2147483647;
        pointer-events: auto;
    `;
    positionHost(host, rect);
    document.body.appendChild(host);

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
        if (!shadow) return;
        currentData = response;
        renderBody(response);
    });
}

function positionHost(el, rect) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportW = window.innerWidth;

    let left = rect.left + scrollX;
    let top = rect.bottom + scrollY + 8;

    if (left + 275 > viewportW + scrollX) {
        left = Math.max(0, viewportW + scrollX - 275);
    }

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
    if (host && !host.contains(e.target)) hidePopup();
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderBody(data) {
    if (!shadow) return;
    const body = shadow.querySelector('.body');

    if (!data || data.error === 'unauthenticated' || data.error === 'network') {
        body.innerHTML = `<span class="msg">${data?.error === 'network' ? 'Nincs kapcsolat a TopEwords-szel.' : 'Jelentkezz be a TopEwords-be a szókereséshez.'}</span>`;
        return;
    }

    if (!data.found) {
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(data.word + ' angol szó: jelentése magyarul, szinonimák, példamondat angolul és magyarul, szófaj, igeragozás ha ige')}&udm=50`;
        body.innerHTML = `
            <span class="msg">„${esc(data.word)}" nincs az adatbázisban.</span>
            <div class="footer" style="margin-top:8px;gap:8px;flex-wrap:wrap">
                <a class="link" href="${APP_URL}/words?add=${encodeURIComponent(data.word)}" target="_blank">
                    Saját szóként hozzáadom →
                </a>
                <a class="link" href="${googleUrl}" target="_blank" style="color:#4285f4">
                    🔍 Google AI
                </a>
            </div>
        `;
        return;
    }

    const { word, meaning_hu, extra_meanings, part_of_speech, rank, status, is_custom } = data;

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
        const statusBtns = Object.entries(STATUS_LABELS).map(([key, label]) => {
            const isActive = status === key;
            const color = STATUS_COLORS[key];
            const activeStyle = isActive ? `background:${color};border-color:${color};color:#fff` : '';
            return `<button class="status-btn${isActive ? ' active' : ''}" data-status="${key}" style="${activeStyle}">${label}</button>`;
        }).join('');
        statusSection = `<div class="statuses">${statusBtns}</div>`;
    } else {
        statusSection = `<a class="link" href="${APP_URL}/pricing" target="_blank" style="display:block;margin-bottom:10px;">⭐ Prémiumra váltva státuszokat is menthetsz</a>`;
    }

    body.innerHTML = `
        <span class="meaning">${esc(meaning_hu)}</span>
        ${extra_meanings ? `<span class="extra">${esc(extra_meanings)}</span>` : ''}
        ${statusSection}
        <div class="footer">
            <a class="link" href="${APP_URL}/words?search=${encodeURIComponent(word)}" target="_blank">Megnyitás →</a>
            <button class="tts-btn" title="Kiejtés angolul">🔊</button>
        </div>
    `;

    if (data.has_active_access) {
        body.querySelectorAll('.status-btn').forEach((btn) => {
            btn.addEventListener('click', () => handleStatusClick(btn, data));
        });
    }

    body.querySelector('.tts-btn')?.addEventListener('click', () => speakWord(word));
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

    sendMsg({
        type: 'UPDATE_STATUS',
        id: data.id,
        is_custom: data.is_custom,
        status: isSame ? null : newStatus,
        csrf: data.csrf,
    });
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

function toggleSearch() {
    if (searchHost) { hideSearch(); return; }
    showSearch();
}

function showSearch() {
    hidePopup();
    searchHost = document.createElement('div');
    searchHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:auto;';
    document.body.appendChild(searchHost);

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
                <span id="shortcut-hint">Alt+W</span>
            </div>
            <div id="results"><div id="empty" style="display:none">Nincs találat.</div></div>
            <div id="detail"></div>
            <div id="footer-hint">Enter · kattintás = részletek &nbsp;·&nbsp; Esc = bezár</div>
        </div>
    `;

    const input = searchShadow.getElementById('search-input');
    input.focus();

    input.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        const q = input.value.trim();
        if (!q) { renderSearchResults([]); return; }
        showSearchLoading();
        searchDebounce = setTimeout(() => {
            sendMsg({ type: 'SEARCH_WORD', q }, (resp) => {
                if (!searchShadow) return;
                searchCsrf = resp?.csrf ?? null;
                searchHasAccess = resp?.has_active_access ?? false;
                renderSearchResults(resp?.results ?? [], resp?.error);
            });
        }, 250);
    });

    searchHost.addEventListener('mousedown', (e) => {
        const modal = searchShadow.getElementById('modal');
        if (!e.composedPath().includes(modal)) hideSearch();
    });
}

function hideSearch() {
    if (searchHost) {
        searchHost.remove();
        searchHost = null;
        searchShadow = null;
        clearTimeout(searchDebounce);
    }
}

function showSearchLoading() {
    if (!searchShadow) return;
    searchShadow.getElementById('results').innerHTML = '<div id="loading">Keresés…</div>';
    const detail = searchShadow.getElementById('detail');
    detail.classList.remove('visible');
    detail.innerHTML = '';
}

function renderSearchResults(results, error) {
    if (!searchShadow) return;
    const container = searchShadow.getElementById('results');
    const detail = searchShadow.getElementById('detail');
    detail.classList.remove('visible');
    detail.innerHTML = '';

    if (error === 'unauthenticated' || error === 'network') {
        container.innerHTML = `<div id="empty">${error === 'network' ? 'Nincs kapcsolat a TopEwords-szel.' : 'Jelentkezz be a TopEwords-be a kereséshez.'}</div>`;
        return;
    }

    if (!results.length) {
        const q = searchShadow.getElementById('search-input')?.value.trim() ?? '';
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
            container.querySelector('#add-notfound').addEventListener('click', () => {
                showSearchDetail({ word: q, _notFound: true });
            });
        } else {
            container.innerHTML = '<div id="empty">Nincs találat.</div>';
        }
        return;
    }

    container.innerHTML = results.map((r, i) => {
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
    }).join('');

    container.querySelectorAll('.result-item').forEach((el) => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index);
            showSearchDetail(results[idx]);
        });
    });
}

function showSearchDetail(data) {
    if (!searchShadow) return;
    const detail = searchShadow.getElementById('detail');

    let statusSection = '';
    if (searchHasAccess) {
        const btns = Object.entries(STATUS_LABELS).map(([key, label]) => {
            const isActive = data.status === key;
            const color = STATUS_COLORS[key];
            const activeStyle = isActive ? `background:${color};border-color:${color};color:#fff` : '';
            return `<button class="status-btn${isActive ? ' active' : ''}" data-status="${key}" style="${activeStyle}">${label}</button>`;
        }).join('');
        statusSection = `<div class="detail-statuses">${btns}</div>`;
    }

    // Ha nincs a DB-ben (nem found), mutass teljes "Hozzáadás" formot
    if (data._notFound) {
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(data.word + ' angol szó: jelentése magyarul, szinonimák, példamondat angolul és magyarul, szófaj, igeragozás ha ige')}&udm=50`;
        detail.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <span style="font-size:14px;font-weight:700;color:#0f172a">${esc(data.word)}</span>
                <a class="google-ai-link" href="${googleUrl}" target="_blank">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    Google AI
                </a>
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
            <div style="display:flex;align-items:center;gap:8px;margin-top:12px">
                <button id="add-btn" class="add-btn">Hozzáadás</button>
                <div id="add-feedback" style="font-size:12px;color:#22c55e;display:none"></div>
            </div>
        `;
        detail.classList.add('visible', 'form-mode');

        const posSelect = detail.querySelector('#add-pos');
        posSelect.addEventListener('change', () => {
            const pos = posSelect.value;
            detail.querySelector('#verb-fields').style.display = pos === 'verb' ? 'flex' : 'none';
            detail.querySelector('#noun-fields').style.display = pos === 'noun' ? 'flex' : 'none';
            detail.querySelector('#adj-fields').style.display = pos === 'adj' ? 'flex' : 'none';
        });

        detail.querySelector('#add-btn').addEventListener('click', () => {
            const pos = posSelect.value;
            const btn = detail.querySelector('#add-btn');
            btn.disabled = true;
            btn.textContent = '…';

            const payload = {
                type: 'ADD_WORD',
                csrf: searchCsrf,
                word: data.word,
                meaning_hu: detail.querySelector('#add-meaning').value.trim() || null,
                extra_meanings: detail.querySelector('#add-extra').value.trim() || null,
                synonyms: detail.querySelector('#add-synonyms').value.trim() || null,
                part_of_speech: pos || null,
                example_en: detail.querySelector('#add-example-en').value.trim() || null,
                example_hu: detail.querySelector('#add-example-hu').value.trim() || null,
            };

            if (pos === 'verb') {
                payload.form_base = detail.querySelector('#add-form-base').value.trim() || null;
                payload.verb_past = detail.querySelector('#add-verb-past').value.trim() || null;
                payload.verb_past_participle = detail.querySelector('#add-verb-pp').value.trim() || null;
                payload.verb_present_participle = detail.querySelector('#add-verb-prog').value.trim() || null;
                payload.verb_third_person = detail.querySelector('#add-verb-3rd').value.trim() || null;
                payload.is_irregular = detail.querySelector('#add-irregular').checked;
            }
            if (pos === 'noun') {
                payload.noun_plural = detail.querySelector('#add-noun-plural').value.trim() || null;
            }
            if (pos === 'adj') {
                payload.adj_comparative = detail.querySelector('#add-adj-comp').value.trim() || null;
                payload.adj_superlative = detail.querySelector('#add-adj-super').value.trim() || null;
            }

            sendMsg(payload, (resp) => {
                const fb = detail.querySelector('#add-feedback');
                if (resp?.ok) {
                    btn.style.display = 'none';
                    fb.textContent = `„${esc(data.word)}" hozzáadva!`;
                    fb.style.color = '#22c55e';
                    fb.style.display = 'block';
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
        <div style="display:flex;align-items:center;gap:4px">
            <a class="detail-link" href="${APP_URL}/words?search=${encodeURIComponent(data.word)}" target="_blank">Megnyitás a TopEwords-ben →</a>
            <button class="detail-tts-btn" title="Kiejtés angolul">🔊</button>
        </div>
    `;
    detail.classList.add('visible');

    detail.querySelector('.detail-tts-btn')?.addEventListener('click', () => speakWord(data.word));

    if (searchHasAccess) {
        detail.querySelectorAll('.status-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const newStatus = btn.dataset.status;
                const isSame = btn.classList.contains('active');

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

                sendMsg({
                    type: 'UPDATE_STATUS',
                    id: data.id,
                    is_custom: data.is_custom,
                    status: isSame ? null : newStatus,
                    csrf: searchCsrf,
                });
            });
        });
    }
}

// ── Page Highlighting ─────────────────────────────────────────────────────────

let highlightEnabled = false;
let hlWordMap = null;

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'NOSCRIPT', 'CODE', 'PRE', 'BUTTON']);

function initHighlight() {
    chrome.storage.local.get('hlEnabled', ({ hlEnabled }) => {
        if (hlEnabled) {
            highlightEnabled = true;
            if (document.readyState === 'complete') {
                loadAndApplyHighlights();
            } else {
                window.addEventListener('load', () => loadAndApplyHighlights(), { once: true });
            }
        }
    });
}

function loadAndApplyHighlights(attempt = 0) {
    sendMsg({ type: 'GET_STATUSES' }, (resp) => {
        if (!resp || resp.error || !resp.statuses) {
            if (attempt < 3) {
                setTimeout(() => loadAndApplyHighlights(attempt + 1), 1500 * (attempt + 1));
            }
            return;
        }
        const entries = Object.entries(resp.statuses);
        if (!entries.length) { return; }
        hlWordMap = new Map(entries.map(([w, s]) => [w.toLowerCase(), s]));
        applyHighlights();
    });
}

function applyHighlights() {
    if (!hlWordMap?.size) { return; }
    removeHighlights();

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const el = node.parentElement;
                if (!el) { return NodeFilter.FILTER_REJECT; }
                if ('twHl' in el.dataset) { return NodeFilter.FILTER_REJECT; }
                if (el.isContentEditable) { return NodeFilter.FILTER_REJECT; }
                if (SKIP_TAGS.has(el.tagName)) { return NodeFilter.FILTER_REJECT; }
                if (el.closest('a, button, [role="button"], [role="link"], [role="combobox"], [role="search"], [role="listbox"], [role="option"], [role="navigation"], ytd-searchbox, ytd-masthead, #search-form')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    const nodes = [];
    while (walker.nextNode()) { nodes.push(walker.currentNode); }
    nodes.forEach(highlightTextNode);

    document.addEventListener('click', handleHlClick, { capture: true });
}

function highlightTextNode(node) {
    const parentEl = node.parentElement;
    if (parentEl) {
        const display = window.getComputedStyle(parentEl).display;
        if (display.includes('flex') || display.includes('grid')) { return; }
    }

    const text = node.textContent;
    const regex = /\b([a-zA-Z]{2,})\b/g;
    const parts = [];
    let lastIndex = 0;
    let hasMatch = false;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const status = hlWordMap.get(match[1].toLowerCase());
        if (!status) { continue; }

        hasMatch = true;
        if (match.index > lastIndex) {
            parts.push(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const span = document.createElement('span');
        span.dataset.twHl = match[1].toLowerCase();
        span.dataset.twStatus = status;
        span.style.setProperty('display', 'inline', 'important');
        span.style.setProperty('position', 'static', 'important');
        span.style.setProperty('float', 'none', 'important');
        span.style.setProperty('text-decoration-line', 'underline', 'important');
        span.style.setProperty('text-decoration-color', STATUS_COLORS[status], 'important');
        span.style.setProperty('text-decoration-thickness', '2px', 'important');
        span.style.setProperty('cursor', 'pointer', 'important');
        span.textContent = match[1];
        parts.push(span);
        lastIndex = match.index + match[1].length;
    }

    if (!hasMatch) { return; }
    if (lastIndex < text.length) {
        parts.push(document.createTextNode(text.slice(lastIndex)));
    }

    const parent = node.parentNode;
    if (!parent) { return; }

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
            parent.replaceChild(document.createTextNode(span.textContent), span);
            parents.add(parent);
        }
    });
    parents.forEach((p) => p.normalize());
}

function handleHlClick(e) {
    const span = e.target?.closest?.('[data-tw-hl]');
    if (!span) { return; }
    if (e.target?.closest?.('a, button, [role="button"], [role="link"]')) { return; }
    e.preventDefault();
    e.stopPropagation();
    const rect = span.getBoundingClientRect();
    showPopup(span.textContent, rect);
}

function toggleHighlight() {
    highlightEnabled = !highlightEnabled;
    chrome.storage.local.set({ hlEnabled: highlightEnabled });
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
                const map = new Map(Object.entries(resp.statuses).map(([w, s]) => [w.toLowerCase(), s]));
                sendResponse({ stats: getPageStats(map) });
            });
            return true;
        }
    }
});

initHighlight();

// ── Helpers ───────────────────────────────────────────────────────────────────

function speakWord(word) {
    if (!window.speechSynthesis) { return; }
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
                if (!el) { return NodeFilter.FILTER_REJECT; }
                if (SKIP_TAGS.has(el.tagName)) { return NodeFilter.FILTER_REJECT; }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    const regex = /\b([a-zA-Z]{2,})\b/g;
    while (walker.nextNode()) {
        const text = walker.currentNode.textContent;
        let match;
        while ((match = regex.exec(text)) !== null) {
            seen.add(match[1].toLowerCase());
        }
    }

    const counts = { learning: 0, saved: 0, known: 0, pronunciation: 0, total: seen.size };
    for (const word of seen) {
        const status = wordMap.get(word);
        if (status && status in counts) { counts[status]++; }
    }
    return counts;
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    } catch (_) {
        callback?.({ error: 'network' });
    }
}
