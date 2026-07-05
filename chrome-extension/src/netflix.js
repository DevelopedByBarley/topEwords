// Netflix felirat-sáv (a YouTube szótér-/popup-gépezetére építve).

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
// Navigáció/újrainicializálás versenyhelyzetei ellen (lásd youtube.js ytNavToken).
let nfxNavToken = 0;

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
        <style>${NFX_BAR_CSS}</style>
        <div id="bar"></div>
    `;

    const bar = shadow.getElementById('bar');
    // Shift+kattintásnál ne induljon natív szövegkijelölés.
    bar.addEventListener('mousedown', (e) => {
        if (e.shiftKey) {
            e.preventDefault();
        }
    });
    bar.addEventListener('click', (e) => {
        handleNfxWordClick(e.target.closest('.tw-word'), e.shiftKey);
    });

    player.appendChild(nfxBarHost);
}

/** Felirat-szóra kattintás: videó megáll, kiejtés, jelentés-popup. */
function handleNfxWordClick(span, shiftKey = false) {
    if (!span) {
        return;
    }

    const video = nfxVideo();

    // Shift: csak a kijelölést építjük; a videót megállítjuk, hogy a felirat ne
    // váltson kijelölés közben. A popup a Shift elengedésekor nyílik meg.
    if (shiftKey) {
        if (video && !video.paused) {
            video.pause();
        }

        twSelHandleShiftClick(span);

        return;
    }

    const word = span.dataset.ytWord?.replace(/^'|'$/g, '') ?? '';

    if (!word) {
        return;
    }

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
        nfxLastCaptionText = '';
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
        <style>${NFX_TOGGLE_CSS}</style>
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
    reconcileNfxLyrics();
}

/**
 * A feliratsáv kívánt állapotát (nfxEnabled) idempotensen összehangolja a tényleges
 * DOM-mal. Minden trigger ezt hívja (toggle, init, navigáció, vezérlő-observer-tick,
 * storage-változás), így minden lépés guard-olt és tetszőlegesen újrafuttatható.
 */
function reconcileNfxLyrics() {
    if (!extAlive() || !isNetflixWatchPage()) {
        return;
    }

    ensureNfxToggle();

    if (!nfxEnabled) {
        if (
            nfxBarHost ||
            nfxObserver ||
            document.getElementById(NFX_HIDE_STYLE_ID)
        ) {
            disableNfxLyrics();
        }

        return;
    }

    ensureNfxBar();
    ensureYtStatusMap((error) => {
        if (!nfxEnabled || !extAlive() || !isNetflixWatchPage()) {
            return;
        }

        if (error) {
            // Backoff alatt nem mutatunk újra értesítést (már láthatta az okát).
            if (error === 'cooldown') {
                return;
            }

            showNfxBarNotice(
                error === 'unauthenticated'
                    ? 'Jelentkezz be a TopWords-be a szókiemeléshez.'
                    : extErrorMessage(
                          error,
                          'Nem sikerült betölteni a szavaidat — próbáld újra később.',
                      ),
            );

            return;
        }

        hideNfxNativeCaptions();

        if (!nfxObserver) {
            startNfxObserver();
        }
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
            reconcileNfxLyrics();
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

    const token = nfxNavToken;

    if (!nfxPlayerContainer()) {
        if (attempt < 10) {
            setTimeout(() => {
                // Közben elnavigáltak — ez a menet már nem aktuális.
                if (token === nfxNavToken) {
                    initNfxSubtitles(attempt + 1);
                }
            }, 1000);
        }

        return;
    }

    storageGet({ nfxLyricsEnabled: false }, ({ nfxLyricsEnabled }) => {
        if (token !== nfxNavToken || !isNetflixWatchPage()) {
            return;
        }

        nfxEnabled = nfxLyricsEnabled;
        startNfxControlsObserver();
        reconcileNfxLyrics();
    });
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
        // Érvénytelenítjük a folyamatban lévő init-meneteket, majd takarítunk.
        nfxNavToken++;
        destroyNfxSubtitles();

        if (isNetflixWatchPage()) {
            // Az init maga várja ki a lejátszót (poll), nem kell fix késleltetés.
            initNfxSubtitles();
        }
    }, 1000);
}

if (location.hostname === 'www.netflix.com') {
    startNfxNavWatch();

    // Popupból/másik fülről átállított kapcsolóra is reagálunk, hogy a gomb
    // sose csússzon szét a tárolt állapottól.
    try {
        chrome.storage?.onChanged?.addListener((changes, area) => {
            if (
                area !== 'local' ||
                !extAlive() ||
                !isNetflixWatchPage() ||
                !changes.nfxLyricsEnabled
            ) {
                return;
            }

            nfxEnabled = !!changes.nfxLyricsEnabled.newValue;
            reconcileNfxLyrics();
        });
    } catch {
        // A storage API nem elérhető ebben a kontextusban — nincs teendő.
    }

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

// A közös szókincs-frissítés (shared.js: refreshVocabHighlights) hookja: friss
// státusztérkép érkezésekor újrarajzolja a Netflix felirat-sávot.
registerVocabRefreshHook({
    isActive: () => nfxEnabled && !!nfxLastCaptionText,
    apply(map) {
        ytStatusMap = map;
        renderNfxBar(nfxLastCaptionText);
    },
});
