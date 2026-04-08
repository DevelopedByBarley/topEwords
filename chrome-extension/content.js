const APP_URL = 'http://localhost:8000';

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

// ── Selection detection ───────────────────────────────────────────────────────

document.addEventListener('mouseup', (e) => {
    if (host && host.contains(e.target)) return;

    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (!text) { hidePopup(); return; }

        // Single words only, strip punctuation
        const word = text.replace(/[^a-zA-Z'-]/g, '').trim();
        if (!word || word.length < 2 || text.split(/\s+/).length > 1) return;

        if (word === currentWord && host) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showPopup(word, rect);
    }, 10);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePopup();
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

    chrome.runtime.sendMessage({ type: 'LOOKUP_WORD', word }, (response) => {
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

    if (!data || data.error === 'unauthenticated') {
        body.innerHTML = `<span class="msg">Jelentkezz be a TopEwords-be a szókereséshez.</span>`;
        return;
    }

    if (!data.found) {
        body.innerHTML = `
            <span class="msg">„${esc(data.word)}" nincs az adatbázisban.</span>
            <div class="footer" style="margin-top:8px">
                <a class="link" href="${APP_URL}/words?search=${encodeURIComponent(data.word)}" target="_blank">
                    Saját szóként hozzáadom →
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

    const statusBtns = Object.entries(STATUS_LABELS).map(([key, label]) => {
        const isActive = status === key;
        const color = STATUS_COLORS[key];
        const activeStyle = isActive ? `background:${color};border-color:${color};color:#fff` : '';
        return `<button class="status-btn${isActive ? ' active' : ''}" data-status="${key}" style="${activeStyle}">${label}</button>`;
    }).join('');

    body.innerHTML = `
        <span class="meaning">${esc(meaning_hu)}</span>
        ${extra_meanings ? `<span class="extra">${esc(extra_meanings)}</span>` : ''}
        <div class="statuses">${statusBtns}</div>
        <div class="footer">
            <a class="link" href="${APP_URL}/words?search=${encodeURIComponent(word)}" target="_blank">Megnyitás →</a>
        </div>
    `;

    body.querySelectorAll('.status-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleStatusClick(btn, data));
    });
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

    chrome.runtime.sendMessage({
        type: 'UPDATE_STATUS',
        id: data.id,
        is_custom: data.is_custom,
        status: isSame ? null : newStatus,
        csrf: data.csrf,
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
