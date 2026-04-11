const APP_URL = 'https://topwords.eu';

chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' });

document.getElementById('open-ta-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        const url = tab?.url
            ? `${APP_URL}/text-analysis?url=${encodeURIComponent(tab.url)}`
            : `${APP_URL}/text-analysis`;
        chrome.tabs.create({ url });
    });
});

// ── Highlight toggle ──────────────────────────────────────────────────────────

const highlightBtn = document.getElementById('highlight-btn');

function updateHighlightBtn(enabled) {
    highlightBtn.textContent = enabled ? 'BE' : 'KI';
    highlightBtn.classList.toggle('active', enabled);
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) { return; }
    chrome.tabs.sendMessage(tab.id, { type: 'GET_HL_STATE' }, (resp) => {
        if (chrome.runtime.lastError) { return; }
        updateHighlightBtn(resp?.enabled ?? false);
    });
});

highlightBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) { return; }
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_HIGHLIGHT' }, (resp) => {
            if (chrome.runtime.lastError) { return; }
            updateHighlightBtn(resp?.enabled ?? false);
        });
    });
});

// ── Page stats ────────────────────────────────────────────────────────────────

const statsBtn = document.getElementById('stats-btn');
const statsResult = document.getElementById('stats-result');

const STATUS_COLORS = { learning: '#3b82f6', saved: '#f97316', known: '#22c55e', pronunciation: '#8b5cf6' };
const STATUS_LABELS = { known: 'Tudom', learning: 'Tanuló', saved: 'Mentett', pronunciation: 'Kiejtés' };

statsBtn.addEventListener('click', () => {
    statsBtn.disabled = true;
    statsBtn.textContent = '…';

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) { resetStatsBtn(); return; }
        chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_STATS' }, (resp) => {
            if (chrome.runtime.lastError) { resetStatsBtn(); return; }
            renderStats(resp?.stats, resp?.error);
        });
    });
});

function resetStatsBtn() {
    statsBtn.disabled = false;
    statsBtn.textContent = 'Oldal statisztikái';
}

function renderStats(stats, error) {
    statsBtn.style.display = 'none';

    if (error === 'unauthenticated') {
        statsResult.innerHTML = '<div class="stats-msg">Jelentkezz be a TopEwords-be.</div>';
        statsResult.style.display = 'block';
        return;
    }

    if (!stats) {
        statsResult.innerHTML = '<div class="stats-msg">Nem sikerült betölteni.</div>';
        statsResult.style.display = 'block';
        return;
    }

    const withStatus = (stats.known ?? 0) + (stats.learning ?? 0) + (stats.saved ?? 0) + (stats.pronunciation ?? 0);
    const pct = stats.total > 0 ? Math.round(withStatus / stats.total * 100) : 0;

    const rows = Object.entries(STATUS_LABELS).map(([key, label]) => {
        const count = stats[key] ?? 0;
        if (!count) { return ''; }
        return `<div class="stat-line">
            <span class="stat-dot" style="background:${STATUS_COLORS[key]}"></span>
            <span class="stat-name">${label}</span>
            <span class="stat-count">${count}</span>
        </div>`;
    }).join('');

    statsResult.innerHTML = `
        <div class="stats-header">${stats.total} egyedi szó az oldalon</div>
        ${rows || '<div class="stats-msg">Még nincs szó státuszban.</div>'}
        <div class="stats-total">Összesen: ${withStatus} szó (${pct}%)</div>
    `;
    statsResult.style.display = 'block';
}
