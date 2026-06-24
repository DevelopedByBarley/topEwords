// TopWords content script — közös konstansok és segédfüggvények.
// Ez töltődik be elsőként; minden más fájl ezekre épül (esc, sendMsg, storage…).

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
