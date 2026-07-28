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

// Egységes AI-tájékoztató (AI-kitöltés a keresőben, AI-flashcard a modálban).
// Az AI-funkciók a topwords.eu szerverén keresztül külső szolgáltatót (Google
// Gemini) hívnak, a válasz pedig tévedhet — ezt a felhasználónak ott kell látnia,
// ahol a generált tartalom megjelenik, a részletes jogi szöveg pedig az ÁSZF-ben van.
const AI_DISCLAIMER_HTML =
    'A tartalmat külső AI-szolgáltató (Google Gemini) generálta. Az AI tévedhet — ' +
    'mentés előtt ellenőrizd. A TopWords a generált tartalom helyességéért ' +
    `felelősséget nem vállal. <a href="${APP_URL}/terms" target="_blank" rel="noopener noreferrer">ÁSZF</a>`;

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

// A háttér fetchJson-je a HTTP-hibákat tipizált kódokká alakítja (network /
// unauthenticated / csrf / rate_limit / server); itt kapnak egységes magyar
// üzenetet. A fallback a hívóhely kontextus-specifikus szövege az ismeretlen
// (vagy végpont-specifikus) hibakódokra.
function extErrorMessage(error, fallback) {
    const messages = {
        network: 'Nincs kapcsolat a TopWords-szel.',
        unauthenticated: 'Jelentkezz be a TopWords-be.',
        unverified: 'Erősítsd meg az e-mail-címed a TopWords-en a mentéshez.',
        csrf: 'A munkameneted lejárt — jelentkezz be újra a TopWords-be.',
        rate_limit: 'Túl sok kérés — várj egy kicsit, és próbáld újra.',
    };

    return messages[error] ?? fallback;
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

// Az AI-válaszok szerveroldalon cache-eltek, így egy cache-találat szinte
// azonnal visszatér — annyira gyorsan, hogy látszik, nem futott valódi modell.
// Ez a min. késleltetés ott tartja a töltő állapotot, hogy valódi AI-válasznak
// tűnjön. Egy igazi (nem cache-elt) generálás általában már eleve lassabb ennél,
// szóval csak a gyanúsan gyors cache-találatokat tolja ki. (Webes megfelelője:
// resources/js/lib/min-duration.ts)
function sendMsgMinDelay(msg, ms, callback) {
    const start = Date.now();

    sendMsg(msg, (response) => {
        const wait = Math.max(0, ms - (Date.now() - start));

        setTimeout(() => callback?.(response), wait);
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

// ── Felirat-szó gyorsgesztusai ────────────────────────────────────────────────
//
// A felirat-sávok (YouTube, Netflix) és az átirat-panel szavain a popup megnyitása
// nélkül is állítható státusz, ugyanazzal a gesztus-készlettel, mint a weboldal-
// kiemelésen (page-highlight.js) és a lejátszóban:
//   • dupla-klikk  → „Tudom" (known)
//   • hosszú-nyomás (500 ms) → „Később" (saved)
//   • sima (rövid) klikk → a szokásos szó-popup
//
// A sima klikk popupját késleltetve nyitjuk, hogy egy közvetlenül utána érkező
// dupla-klikk elnyomhassa (különben a popup felvillanna); a hosszú-nyomás a
// mousedown-timerrel dől el, és elnyeli a rákövetkező click-et. A tényleges
// státusz-állítást a háttér QUICK_STATUS ága végzi (lookup + toggle), majd a
// hívó a refreshVocabHighlights-tal újrarajzolja a feliratot.

const CAPTION_LONG_PRESS_MS = 500;
const CAPTION_CLICK_DELAY_MS = 260; // > a rendszer dblclick-ablaka, hogy a dbl megelőzze
const CAPTION_QUICK_STATUS = { dbl: 'known', long: 'saved' };

/**
 * Felirat-gesztusok bekötése egy gyökér-elemre (felirat-sáv vagy panel-body).
 * A hívó megadja, hogyan találja meg a kattintott szó-spanját (wordSpanFromEvent),
 * mit tegyen sima kattintásra (onWordClick — pl. popup + pause + TTS), és mit a
 * gyors-státusz sikeres/utáni frissítésnél (onQuickStatus).
 *
 * A Shift-kattintás (kijelölés-építés) NEM gyorsgesztus — azt a hívó onWordClick-je
 * kezeli, ide azt átengedjük.
 *
 * @param {HTMLElement} root
 * @param {{
 *   wordSpanFromEvent: (e: Event) => HTMLElement|null,
 *   onWordClick: (span: HTMLElement, e: MouseEvent) => void,
 *   onQuickStatus: (word: string, status: string, span: HTMLElement) => void,
 * }} handlers
 */
function attachCaptionWordGestures(root, { wordSpanFromEvent, onWordClick, onQuickStatus }) {
    let pendingClick = null; // { timer }
    let longPress = null; // { span, fired }

    const cancelPendingClick = () => {
        if (pendingClick) {
            clearTimeout(pendingClick.timer);
            pendingClick = null;
        }
    };

    const cancelLongPress = () => {
        if (longPress) {
            clearTimeout(longPress.timer);
            longPress = null;
        }
    };

    /** Gyors státusz-állítás a spanra + azonnali szín-villanás visszajelzésként. */
    const quickStatus = (span, status) => {
        const word = span.dataset.ytWord?.replace(/^'|'$/g, '') ?? span.textContent ?? '';

        if (!word) {
            return;
        }

        const color = STATUS_COLORS[status];

        if (color) {
            const prev = span.style.outline;
            span.style.outline = `2px solid ${color}`;
            setTimeout(() => {
                span.style.outline = prev;
            }, 400);
        }

        onQuickStatus(word, status, span);
    };

    root.addEventListener('mousedown', (e) => {
        // A sáv/panel `open` shadow DOM-ban van, így az oldal JS-e szintetikus
        // egéreseménnyel kéretlen státusz-írást válthatna ki a hosszú-nyomás
        // ágon — csak valódi felhasználói nyomásra indulunk (ugyanaz a guard,
        // mint lent a click-ágon és a page-highlight.js-ben).
        if (!e.isTrusted) {
            return;
        }

        // Shift+kattintásnál ne induljon natív szövegkijelölés (a hívó kijelölést épít).
        if (e.shiftKey) {
            e.preventDefault();

            return;
        }

        const span = wordSpanFromEvent(e);

        if (!span || e.button !== 0) {
            return;
        }

        cancelLongPress();
        const state = { span, fired: false };
        state.timer = setTimeout(() => {
            state.fired = true;
            // A késleltetett sima-klikk popup elmarad; a hosszú-nyomás státuszt állít.
            cancelPendingClick();
            quickStatus(span, CAPTION_QUICK_STATUS.long);
        }, CAPTION_LONG_PRESS_MS);
        longPress = state;
    });

    root.addEventListener('mouseup', () => {
        // A státusz-állítás a timerben / dblclick-ben történik; itt csak a le nem járt
        // hosszú-nyomás timert töröljük (rövid kattintás volt).
        cancelLongPress();
    });

    root.addEventListener('dblclick', (e) => {
        // Szintetikus dupla-klikk sem állíthat státuszt (lásd a mousedown-guardot).
        if (!e.isTrusted) {
            return;
        }

        const span = wordSpanFromEvent(e);

        if (!span) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        // A dupla-klikk „Tudom"-ot állít — a késleltetett sima-klikk popup elmarad.
        cancelPendingClick();
        quickStatus(span, CAPTION_QUICK_STATUS.dbl);
    });

    root.addEventListener('click', (e) => {
        // A sáv/panel `open` shadow DOM-ban van, így az oldal JS-e szintetikus
        // MouseEvent-tel kéretlen popupot tudna kiváltani — csak valódi kattintásra
        // reagálunk (ugyanaz a guard, mint a lookup-popup.js / page-highlight.js-ben).
        if (!e.isTrusted) {
            return;
        }

        const span = wordSpanFromEvent(e);

        if (!span) {
            // Nem szó-span (pl. panel-sorra kattintás a seek-hez): a hívó dolga.
            onWordClick(null, e);

            return;
        }

        // Shift (kijelölés-építés) azonnal a hívóhoz megy, nem gyorsgesztus.
        if (e.shiftKey) {
            onWordClick(span, e);

            return;
        }

        // Ha épp hosszú-nyomás zajlott le ezen a nyomáson, a click a gesztus
        // „elengedése" — ne nyisson popupot.
        if (longPress?.fired) {
            cancelLongPress();

            return;
        }

        // A popupot késleltetjük: ha rögtön dupla-klikk jön, azt fenn elnyomjuk.
        cancelPendingClick();
        pendingClick = {
            timer: setTimeout(() => {
                pendingClick = null;
                onWordClick(span, e);
            }, CAPTION_CLICK_DELAY_MS),
        };
    });
}

// ── Szókincs-frissítési hookok ────────────────────────────────────────────────
//
// A modulok (page-highlight, youtube, netflix) ide regisztrálják a saját
// újrarajzolójukat: { isActive: () => boolean, apply: (map) => void }. Így a
// refreshVocabHighlights nem függ attól, mely modulok töltődtek be az adott
// oldalon — a youtube.js/netflix.js csak a saját domainjén fut (lásd manifest).

const vocabRefreshHooks = [];

function registerVocabRefreshHook(hook) {
    vocabRefreshHooks.push(hook);
}

// Igaz, ha bármely modul épp szó-státuszokat jelenít meg (kiemelés, felirat-sáv) —
// csak ilyenkor érdemes a fülre visszatérve frissítést kérni.
function anyVocabUiActive() {
    return vocabRefreshHooks.some((hook) => hook.isActive());
}

/**
 * Egy szó státuszának/felvitelének mentése után frissíti a státusztérképet, és a
 * regisztrált hookokon át azonnal újrarajzolja az aktív felületeket (feliratsáv,
 * átirat-oldalsáv, oldali kiemelés), hogy a változás külön frissítés nélkül
 * látszódjon. Saját mentés után a cache úgyis érvénytelen (a háttér dobta), így nem
 * kell forceFresh; a fülre visszatéréskor viszont forceFresh=true kell, hogy a más
 * eszközön történt változás is azonnal bekerüljön (a friss cache-t megkerülve).
 */
function refreshVocabHighlights(forceFresh = false) {
    sendMsg({ type: 'GET_STATUSES', forceFresh }, (resp) => {
        if (!resp || resp.error || !resp.statuses) {
            return;
        }

        const map = new Map(
            Object.entries(resp.statuses).map(([w, s]) => [w.toLowerCase(), s]),
        );

        vocabRefreshHooks.forEach((hook) => {
            if (hook.isActive()) {
                hook.apply(map);
            }
        });
    });
}
