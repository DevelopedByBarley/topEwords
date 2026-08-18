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
let nfxTitleObserver = null;
let nfxNoticeShown = false;
// Sikerült-e valaha felirat-szöveget olvasni ezen a menetben (youtube.js:
// ytCaptionTextSeen párja). Ez a bizonyíték dönti el, kell-e értesítés.
let nfxCaptionTextSeen = false;
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
    // Ugyanaz a gesztus-készlet, mint a YouTube-feliraton (sima klikk = popup,
    // dupla-klikk = „Tudom", hosszú-nyomás = „Később"); a gyors-státusz a közös
    // quickStatusOnCaptionWord-öt hívja (youtube.js), a Shift-kijelölést a
    // click-ág engedi át a handleNfxWordClick-nek.
    attachCaptionWordGestures(bar, {
        wordSpanFromEvent: (e) => e.target?.closest?.('.tw-word') ?? null,
        onWordClick: (span, e) => handleNfxWordClick(span, e.shiftKey),
        onQuickStatus: quickStatusOnCaptionWord,
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

/**
 * A felirat-szöveg kiolvasása.
 *
 * Szándékosan NEM `innerText`: az a megjelenített szöveget adja vissza, ezért
 * kikényszeríti a layout újraszámolását (forced reflow) — observer-callbackben,
 * frame-enként ez drága. A `textContent` viszont nem tesz sortörést a sorok
 * közé, ezért a többsoros feliratnál összeragadnának a szavak; így soronként
 * (`.player-timedtext-text-container`) járjuk be, és magunk fűzzük össze.
 * Ugyanaz a minta, mint a YouTube-ágban (youtube.js: .ytp-caption-segment).
 */
function readNfxCaptionText() {
    const container = document.querySelector('.player-timedtext');

    if (!container) {
        return '';
    }

    const lines = container.querySelectorAll(
        '.player-timedtext-text-container',
    );

    if (!lines.length) {
        // Ismeretlen/megváltozott felirat-DOM — a teljes szöveg a végső háló.
        return container.textContent.trim();
    }

    return Array.from(lines)
        .map((line) => line.textContent.trim())
        .filter(Boolean)
        .join(' ')
        .trim();
}

function startNfxObserver() {
    nfxObserver?.disconnect();

    let lastText = '';
    nfxNoticeShown = false;
    nfxCaptionTextSeen = false;

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

        // Az első kiolvasott szöveg a bizonyíték, hogy a felirat BE VAN
        // kapcsolva és a DOM olvasható — innentől nincs helye értesítésnek.
        if (text) {
            nfxCaptionTextSeen = true;
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

    // Értesítés CSAK akkor, ha a teljes ablak alatt EGYSZER sem sikerült
    // felirat-szöveget olvasni.
    //
    // A korábbi változat 4 mp után egyetlen pillanatképet nézett: ha épp nem
    // hangzott el semmi (főcím, zene, csönd a videó elején), tévesen kiírta a
    // „kapcsold be a feliratot" üzenetet, majd az első valódi feliratnál a sáv
    // magától elindult — vagyis az üzenet szemlátomást hazudott. A bizonyíték-
    // alapú flaggel (nfxCaptionTextSeen) ez nem fordulhat elő: a néma szakasz
    // csak késlelteti a döntést, nem hamisítja meg.
    //
    // 15 mp: ennyi idő alatt egy tipikus főcím/intro már túl van, tehát ha
    // eddig sincs szöveg, az tényleg kikapcsolt (vagy olvashatatlan) felirat.
    const noticeToken = nfxNavToken;
    let elapsed = 0;
    const noticeTimer = setInterval(() => {
        elapsed += 1000;

        const stale =
            !extAlive() ||
            noticeToken !== nfxNavToken ||
            !nfxEnabled ||
            !isNetflixWatchPage();

        if (stale || nfxCaptionTextSeen || nfxNoticeShown || elapsed >= 15000) {
            clearInterval(noticeTimer);

            if (!stale && !nfxCaptionTextSeen && !nfxNoticeShown) {
                nfxNoticeShown = true;
                showNfxBarNotice('Kapcsold be a feliratot a Netflixen (CC).');
            }
        }
    }, 1000);
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
            <!-- A badge a rajzmező közepén (x 5..31, y 4..20), az aláhúzás alatta lóg. -->
            <svg width="50" height="32" viewBox="0 0 36 24" style="display:block">
                <rect x="5" y="4" width="26" height="16" rx="3" fill="#fff"/>
                <text x="18" y="15.5" text-anchor="middle" font-family="Roboto, Arial, sans-serif" font-size="10" font-weight="800" fill="#0f0f0f">TW</text>
                <rect class="tw-underline" x="10" y="21" width="16" height="2.5" rx="1.25" fill="#e50914"/>
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
    nfxCaptionTextSeen = false;
    nfxNoticeShown = false;
    showNfxNativeCaptions();
}

// A lejátszó vezérlősora/DOM-ja gyakran újrarenderelődik — egy könnyű,
// frame-enként összevont observerrel tartjuk életben a kapcsolót és a sávot.
let nfxControlsObserver = null;
// Melyik node-ot figyeli épp az observer; a lejátszó megjelenésekor átcsatolunk.
let nfxControlsObserverTarget = null;

/**
 * A vezérlő-observer hatóköre.
 *
 * SZÁNDÉKOSAN NEM a `document.body` + `subtree: true`: a Netflix lejátszó DOM-ja
 * lejátszás közben folyamatosan mutálódik, így a callback frame-enként lefutna
 * (mérve: EXTENSION_AUDIT_2026-08-11.md, CL-1). A lejátszó-konténerre szűkítve
 * ugyanazt a munkát végzi, nagyságrendekkel kevesebb értesítésből — ez a
 * YouTube-ág bevált mintája (youtube.js: #movie_player).
 *
 * Amíg a lejátszó nincs a DOM-ban, a `body` KÖZVETLEN gyerekeit figyeljük
 * (`subtree: false`) — ez olcsó, és elég ahhoz, hogy a lejátszó megjelenését
 * észrevegyük.
 */
function nfxControlsObserverScope() {
    const player = nfxPlayerContainer();

    return player
        ? { target: player, options: { childList: true, subtree: true } }
        : { target: document.body, options: { childList: true } };
}

function startNfxControlsObserver() {
    nfxControlsObserver?.disconnect();

    let pending = false;
    nfxControlsObserver = new MutationObserver(() => {
        if (!extAlive()) {
            nfxControlsObserver?.disconnect();
            nfxControlsObserver = null;
            nfxControlsObserverTarget = null;

            return;
        }

        if (pending) {
            return;
        }

        pending = true;
        requestAnimationFrame(() => {
            pending = false;

            // A navigáció-észlelést a title-observer és a poll viszi
            // (startNfxNavWatch); itt csak arra ügyelünk, hogy egy közben
            // lebontott menet után ne hangoljunk össze semmit.
            if (!extAlive() || !isNetflixWatchPage()) {
                return;
            }

            // Ha közben megjelent a lejátszó, átcsatolunk rá a body-ról —
            // innentől a szűk hatókör érvényes.
            if (nfxPlayerContainer() !== nfxControlsObserverTarget) {
                startNfxControlsObserver();
            }

            reconcileNfxLyrics();
        });
    });

    const { target, options } = nfxControlsObserverScope();
    nfxControlsObserverTarget = nfxPlayerContainer();
    nfxControlsObserver.observe(target, options);
}

function destroyNfxSubtitles() {
    nfxObserver?.disconnect();
    nfxObserver = null;
    nfxControlsObserver?.disconnect();
    nfxControlsObserver = null;
    nfxControlsObserverTarget = null;
    nfxBarHost?.remove();
    nfxBarHost = null;
    nfxToggleHost?.remove();
    nfxToggleHost = null;
    nfxLastCaptionText = '';
    nfxCaptionTextSeen = false;
    nfxNoticeShown = false;
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

// A Netflix SPA-nak nincs dedikált navigációs eseménye (a YouTube
// `yt-navigate-finish`-ének nincs itt párja), a History API becsomagolása pedig
// NEM járható út: a content script izolált világban fut, ezért a
// `history.pushState` felülírása csak a SAJÁT világunk objektumát cseréli le — az
// oldal a maga érintetlen példányát hívja, a wrapper sosem sülne el. Csak olyan
// jelre támaszkodhatunk, ami a közös DOM-on át is megérkezik:
//   • popstate — vissza/előre gomb (valódi DOM-esemény, világhatáron átjön),
//   • a <title> cseréje — a Netflix minden navigációnál átírja a lap címét, és
//     ez EGYETLEN node figyelését igényli, szemben a korábbi body-szintű
//     subtree-observerrel (lásd startNfxTitleWatch).
// A 2 mp-es poll a végső háló arra az esetre, ha a cím nem változna (pl. két
// epizód azonos címmel), illetve a /watch oldalról kilépésre.
let nfxLastPath = location.pathname + location.search;

/**
 * Újrainicializálja a felületet, ha közben elnavigáltak.
 *
 * @returns {boolean} true, ha volt útvonal-váltás (a hívónak ilyenkor már nincs
 * teendője: a régi menet le van bontva, az új init elindult).
 */
function handleNfxNavChange() {
    const path = location.pathname + location.search;

    if (path === nfxLastPath) {
        return false;
    }

    nfxLastPath = path;
    // Érvénytelenítjük a folyamatban lévő init-meneteket, majd takarítunk.
    nfxNavToken++;
    destroyNfxSubtitles();

    if (isNetflixWatchPage()) {
        // Az init maga várja ki a lejátszót (poll), nem kell fix késleltetés.
        initNfxSubtitles();
    }

    return true;
}

/**
 * Navigáció-észlelés a lap címéből.
 *
 * A `<title>` szövegcseréje a Netflix minden útvonal-váltásánál megtörténik, és
 * egyetlen node figyelésébe kerül — ezért vette át ezt a szerepet a korábbi
 * body-szintű subtree-observertől (CL-1). A `<title>` elemet a Netflix ki is
 * cserélheti, ezért a `<head>`-et figyeljük `subtree: true`-val: a head
 * mutáció-forgalma elhanyagolható a body-éhoz képest.
 */
function startNfxTitleWatch() {
    if (nfxTitleObserver || !document.head) {
        return;
    }

    nfxTitleObserver = new MutationObserver(() => {
        if (!extAlive()) {
            nfxTitleObserver?.disconnect();
            nfxTitleObserver = null;

            return;
        }

        handleNfxNavChange();
    });

    nfxTitleObserver.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
    });
}

function startNfxNavWatch() {
    if (nfxNavInterval) {
        return;
    }

    // Vissza/előre gomb. A pushState-tel indított navigációt nem ez fogja meg,
    // hanem a title-observer (lásd fent).
    window.addEventListener('popstate', handleNfxNavChange);

    startNfxTitleWatch();

    // Végső háló: ritka (2 mp) poll azokra a váltásokra, amiket sem a popstate,
    // sem a title-observer nem lát — pl. ha két epizód címe azonos, illetve a
    // /watch oldalról kilépés. Kikapcs esetén magától leáll.
    nfxNavInterval = setInterval(() => {
        if (!extAlive()) {
            clearInterval(nfxNavInterval);
            nfxNavInterval = null;
            nfxTitleObserver?.disconnect();
            nfxTitleObserver = null;

            return;
        }

        handleNfxNavChange();
    }, 2000);
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
