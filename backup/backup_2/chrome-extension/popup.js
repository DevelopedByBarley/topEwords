const APP_URL = 'https://topwords.eu';

chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' });

// ── Mac/Win gyorsbillentyű felirat ───────────────────────────────────────────

document.getElementById('shortcut-key').textContent =
    navigator.platform.includes('Mac') ? 'Option' : 'Alt';

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

// ── Kiemelés kapcsoló ────────────────────────────────────────────────────────

const highlightBtn = document.getElementById('highlight-btn');

function updateHighlightBtn(enabled) {
    highlightBtn.classList.toggle('active', enabled);
    highlightBtn.setAttribute('aria-checked', String(enabled));
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) {
        return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'GET_HL_STATE' }, (resp) => {
        if (chrome.runtime.lastError) {
            return;
        }

        updateHighlightBtn(resp?.enabled ?? false);
    });
});

highlightBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) {
            return;
        }

        chrome.tabs.sendMessage(
            tab.id,
            { type: 'TOGGLE_HIGHLIGHT' },
            (resp) => {
                if (chrome.runtime.lastError) {
                    return;
                }

                updateHighlightBtn(resp?.enabled ?? false);
            },
        );
    });
});

// ── Oldal statisztikák ───────────────────────────────────────────────────────

const statsBtn = document.getElementById('stats-btn');
const statsResult = document.getElementById('stats-result');

const STATUS_COLORS = {
    learning: '#3b82f6',
    saved: '#f97316',
    known: '#22c55e',
    pronunciation: '#8b5cf6',
};
const STATUS_LABELS = {
    known: 'Tudom',
    learning: 'Tanulom',
    saved: 'Mentett',
    pronunciation: 'Kiejtés',
};

statsBtn.addEventListener('click', () => {
    statsBtn.disabled = true;
    statsBtn.textContent = 'Számolás…';

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) {
            resetStatsBtn();

            return;
        }

        chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_STATS' }, (resp) => {
            if (chrome.runtime.lastError) {
                renderStats(null, 'no-content');

                return;
            }

            renderStats(resp?.stats, resp?.error);
        });
    });
});

function resetStatsBtn() {
    statsBtn.disabled = false;
    statsBtn.textContent = '📊 Oldal statisztikái';
}

function renderStats(stats, error) {
    statsBtn.style.display = 'none';
    statsResult.style.display = 'block';

    if (error === 'unauthenticated') {
        statsResult.innerHTML =
            '<div class="stats-msg">Jelentkezz be a TopWords-be a statisztikákhoz.</div>';

        return;
    }

    if (error === 'no-content') {
        statsResult.innerHTML =
            '<div class="stats-msg">Ezen az oldalon nem elérhető (frissítsd az oldalt, vagy böngészőbeli belső oldal).</div>';

        return;
    }

    if (!stats) {
        statsResult.innerHTML =
            '<div class="stats-msg">Nem sikerült betölteni.</div>';

        return;
    }

    const withStatus =
        (stats.known ?? 0) +
        (stats.learning ?? 0) +
        (stats.saved ?? 0) +
        (stats.pronunciation ?? 0);
    const pct =
        stats.total > 0 ? Math.round((withStatus / stats.total) * 100) : 0;

    const barSegments = Object.keys(STATUS_LABELS)
        .map((key) => {
            const count = stats[key] ?? 0;

            if (!count || !stats.total) {
                return '';
            }

            const width = ((count / stats.total) * 100).toFixed(1);

            return `<span style="width:${width}%;background:${STATUS_COLORS[key]}"></span>`;
        })
        .join('');

    const rows = Object.entries(STATUS_LABELS)
        .map(([key, label]) => {
            const count = stats[key] ?? 0;

            if (!count) {
                return '';
            }

            return `<div class="stat-line">
            <span class="stat-dot" style="background:${STATUS_COLORS[key]}"></span>
            <span class="stat-name">${label}</span>
            <span class="stat-count">${count}</span>
        </div>`;
        })
        .join('');

    statsResult.innerHTML = `
        <div class="stats-header">${stats.total} egyedi angol szó az oldalon</div>
        <div class="stats-bar">${barSegments}</div>
        ${rows || '<div class="stats-msg">Még egyik szónak sincs státusza.</div>'}
        <div class="stats-total">Státusszal jelölve: ${withStatus} szó (${pct}%)</div>
    `;
}
