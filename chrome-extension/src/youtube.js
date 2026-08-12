// YouTube felirat-sáv + átirat-oldalsáv + közös szótér-frissítés.

// ── YouTube Subtitle Integration ──────────────────────────────────────────────
//
// A TopWords felirat-sáv a natív YouTube felirat DOM-jából olvas, de önállóan
// kapcsolható: bekapcsoláskor magától aktiválja a natív feliratot (CC), és
// CSS-sel elrejti az eredeti megjelenítését, így csak a mi sávunk látszik.

let ytEnabled = false; // chrome.storage.local: ytLyricsEnabled (alapból kikapcsolva)
let ytWeEnabledCC = false;
// Frissítéskor a YouTube visszaállíthatja a CC-t "bekapcsolt" állapotba, de a
// felirat-track ilyenkor gyakran nem renderel, amíg egy valódi ki→be kapcsolás meg
// nem rángatja. Ezt menetenként egyszer kényszerítjük ki (lásd ensureNativeCaptionsOn).
let ytCcKicked = false;
// A kick épp lekapcsolta a user SAJÁT CC-jét, és a visszakapcsoló tick még nem
// futott le. Amíg igaz, a CC a useré: a visszakapcsolás nem veheti át a
// tulajdonjogát (ytWeEnabledCC), kikapcsolásnál/navigációnál pedig vissza kell
// állítani neki.
let ytCcKickPending = false;
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
// Bizonyíték, hogy az observer tud felirat-szöveget olvasni a natív DOM-ból
// (.ytp-caption-segment). A natív feliratot csak ezután rejtjük el — ha a
// YouTube átnevezi az osztályokat, a natív felirat látható marad, nem lesz
// néma, teljes felirat-kiesés.
let ytCaptionTextSeen = false;
let ytNoCaptionNoticeShown = false;

// A navigáció/újrainicializálás versenyhelyzetei ellen: minden navigáció növeli,
// az aszinkron init-callbackek ezzel ellenőrzik, hogy még az ő menetük aktuális-e.
let ytNavToken = 0;
// A státusz-lekérés közben érkező további igénylők callbackjei (egyetlen lekérés).
let ytStatusWaiters = [];
// Hiba utáni backoff: a gyakori reconcile-tickek ne bombázzák a hátteret.
let ytStatusErrorAt = 0;
const YT_STATUS_RETRY_MS = 15000;

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

/**
 * Bekapcsolja a natív feliratot (CC), ha még nem áll készen a gomb, kudarcot jelez.
 * @returns {boolean} true, ha a CC be van (vagy most lett) kapcsolva; false, ha a
 * gomb még nem elérhető — ilyenkor a következő reconcile-tick újrapróbálja.
 */
function ensureNativeCaptionsOn() {
    const btn = ytCaptionButton();

    if (!btn || btn.getAttribute('aria-disabled') === 'true') {
        return false;
    }

    if (btn.getAttribute('aria-pressed') === 'false') {
        btn.click();

        if (ytCcKickPending) {
            // A kick utáni visszakapcsolás: a CC eredetileg a useré volt, nem
            // jelöljük sajátunknak — a TW-sáv kikapcsolásakor bekapcsolva marad.
            ytCcKickPending = false;
        } else {
            ytWeEnabledCC = true;
        }

        return true;
    }

    // A CC már be van kapcsolva, de nem mi kapcsoltuk: ez tipikusan a frissítés
    // utáni állapot, amikor a YouTube visszaállította a gombot, de a felirat-track
    // nem renderel. Menetenként egyszer kirángatjuk: kikapcsoljuk, majd egy
    // ütemezett reconcile-tick visszakapcsolja és elindítja a renderelést.
    if (!ytWeEnabledCC && !ytCcKicked) {
        ytCcKicked = true;
        ytCcKickPending = true;
        btn.click();
        setTimeout(() => {
            if (ytEnabled && extAlive() && isYouTubePage()) {
                reconcileYtLyrics();
            }
        }, 150);

        return false;
    }

    return true;
}

function restoreNativeCaptionState() {
    const btn = ytCaptionButton();

    // A kick lekapcsolta a user saját CC-jét, de a visszakapcsoló tick már nem
    // fut le (közben kikapcsolták a TW-sávot) — az ő beállítását állítjuk vissza.
    if (ytCcKickPending) {
        ytCcKickPending = false;

        if (btn && btn.getAttribute('aria-pressed') === 'false') {
            btn.click();
        }

        return;
    }

    if (!ytWeEnabledCC) {
        return;
    }

    ytWeEnabledCC = false;

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
    reconcileYtLyrics();
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
        bottom: '76px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483646',
        pointerEvents: 'none',
        width: 'max-content',
        maxWidth: '90%',
    });

    const shadow = ytBarHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>${YT_BAR_CSS}</style>
        <div id="bar"></div>
    `;

    const bar = shadow.getElementById('bar');
    // A sima klikk (popup), a dupla-klikk („Tudom") és a hosszú-nyomás („Később")
    // gesztusait a közös felirat-kezelő köti be; a Shift-kijelölést a click-ág
    // engedi át a handleYtWordClick-nek.
    attachCaptionWordGestures(bar, {
        wordSpanFromEvent: (e) => e.target?.closest?.('.tw-word') ?? null,
        onWordClick: (span, e) => handleYtWordClick(span, e.shiftKey),
        onQuickStatus: quickStatusOnCaptionWord,
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

/**
 * Gyors státusz-állítás egy felirat-szóra (dupla-klikk = „Tudom", hosszú-nyomás =
 * „Később"). A háttér egy körben lookupol és állít (toggle-szemantika), majd
 * frissítjük a felirat-kiemeléseket. A gesztus NEM állítja meg a videót és nem
 * ejt ki (a nézést nem szakítja meg); ismeretlen szónál a szokásos popup nyílik,
 * hogy fel lehessen venni. Közös a YouTube- és Netflix-felirattal.
 *
 * @param {string} word
 * @param {string} status
 * @param {HTMLElement} span
 */
function quickStatusOnCaptionWord(word, status, span) {
    sendMsg({ type: 'QUICK_STATUS', word, status }, (resp) => {
        if (resp?.ok) {
            refreshVocabHighlights();

            return;
        }

        // Ismeretlen / nem menthető szó: nyíljon a szokásos popup, hogy a
        // felhasználó felvehesse — a gesztus ne „némuljon el".
        showPopup(word, span.getBoundingClientRect(), true);
    });
}

/** Egy felirat-szóra kattintás: videó megállítása, kiejtés, popup. */
function handleYtWordClick(span, shiftKey = false) {
    if (!span) {
        return;
    }

    // Shift: csak a kijelölést építjük; a videót megállítjuk, hogy a felirat ne
    // váltson kijelölés közben. A popup a Shift elengedésekor nyílik meg.
    if (shiftKey) {
        pauseVideoIfPlaying();
        twSelHandleShiftClick(span);

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
        ytLastCaptionText = '';
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

        // Csak az AKTUÁLIS felirat-ablakot olvassuk. A YouTube időnként több
        // .caption-window-t is a DOM-ban hagy (a régiek nem tűnnek el azonnal,
        // főleg mert mi opacity:0-val rejtjük, nem display:none-nal) — ha mindet
        // összefűznénk, a régi szöveg "beragadna" és az újak elé kerülnének.
        // A legutóbb beszúrt ablak a friss felirat.
        const windows = document.querySelectorAll(
            '#movie_player .caption-window',
        );
        const activeWindow = windows[windows.length - 1];
        const segments = activeWindow
            ? activeWindow.querySelectorAll('.ytp-caption-segment')
            : [];
        const text = Array.from(segments)
            .map((s) => s.textContent)
            .join(' ')
            .trim();

        if (text === lastText) {
            return;
        }

        // Az első sikeresen kiolvasott felirat-szöveg a bizonyíték, hogy a
        // felirat-DOM olvasható — a natív feliratot csak innentől rejtjük el.
        if (text && !ytCaptionTextSeen) {
            ytCaptionTextSeen = true;
            hideNativeCaptions();
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

    // Ha pár másodperc után sem sikerült felirat-szöveget olvasni (pl. a
    // YouTube átnevezte a felirat-osztályokat), egyszeri értesítéssel
    // jelezzük, miért üres a TW-sáv — a natív felirat ilyenkor látható marad.
    setTimeout(() => {
        if (
            ytEnabled &&
            extAlive() &&
            isYouTubePage() &&
            ytObserver &&
            !ytCaptionTextSeen &&
            !ytNoCaptionNoticeShown
        ) {
            ytNoCaptionNoticeShown = true;
            showYtBarNotice(
                'Nem sikerült felirat-szöveget beolvasni — a YouTube saját felirata látható marad.',
            );
        }
    }, 5000);
}

// ── Be/ki kapcsolás ──

/**
 * A szó→státusz térképet egyszer kéri le és cache-eli; a sáv és az oldalsáv is ezt hívja.
 * A callback megkapja az esetleges hibát ('network' | 'unauthenticated' | 'rate_limit' |
 * 'server' | 'cooldown' | null).
 */
function ensureYtStatusMap(callback) {
    if (ytStatusMap) {
        callback(null);

        return;
    }

    // Friss hiba után visszafogjuk az újrapróbát, hogy a gyakori reconcile-tickek
    // ne ismételjék folyamatosan a sikertelen lekérést. A 'cooldown' nem jelez új
    // hibát a hívónak (értesítést sem mutatunk rá újra).
    if (ytStatusErrorAt && Date.now() - ytStatusErrorAt < YT_STATUS_RETRY_MS) {
        callback('cooldown');

        return;
    }

    // Sorba állunk: ha már fut egy lekérés, csak hozzáfűzzük a callbacket, hogy a
    // gyakori reconcile-tickek ne indítsanak párhuzamos GET_STATUSES-eket.
    ytStatusWaiters.push(callback);

    if (ytStatusWaiters.length > 1) {
        return;
    }

    sendMsg({ type: 'GET_STATUSES' }, (resp) => {
        const waiters = ytStatusWaiters;
        ytStatusWaiters = [];

        if (resp && !resp.error && resp.statuses) {
            ytStatusErrorAt = 0;
            ytStatusMap = new Map(
                Object.entries(resp.statuses).map(([w, s]) => [
                    w.toLowerCase(),
                    s,
                ]),
            );
            waiters.forEach((cb) => cb(null));

            return;
        }

        ytStatusErrorAt = Date.now();
        const error = resp?.error ?? 'network';
        waiters.forEach((cb) => cb(error));
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

// A közös szókincs-frissítés (shared.js: refreshVocabHighlights) hookja: friss
// státusztérkép érkezésekor újrarajzolja a felirat-sávot és az átirat-panelt.
// A Netflix-sáv a sajátját a netflix.js-ben regisztrálja (közös ytStatusMap-pel).
registerVocabRefreshHook({
    isActive: () => !!ytStatusMap,
    apply(map) {
        ytStatusMap = map;

        if (ytLastCaptionText) {
            renderYtBar(ytLastCaptionText);
        }

        if (ytPanelSegments.length) {
            renderYtPanelSegments();
        }
    },
});

/**
 * A feliratsáv kívánt állapotát (ytEnabled) idempotensen összehangolja a tényleges
 * DOM-mal. Minden trigger ezt hívja (toggle, init, navigáció, vezérlő-observer-tick,
 * storage-változás), így minden lépés guard-olt és tetszőlegesen újrafuttatható —
 * ez old meg a CC-bekapcsolás időzítését (újrapróbálkozik) és a beragadt állapotokat.
 */
function reconcileYtLyrics() {
    if (!extAlive() || !isYouTubePage()) {
        return;
    }

    injectYtToggle();
    updateYtToggleState();

    if (!ytEnabled) {
        // Kívánt: kikapcsolva — minden maradványt visszatakarítunk, ha van.
        if (
            ytBarHost ||
            ytObserver ||
            ytWeEnabledCC ||
            ytCcKickPending ||
            document.getElementById(YT_HIDE_STYLE_ID)
        ) {
            disableYtLyrics();
        }

        return;
    }

    // Kívánt: bekapcsolva.
    ensureYtBar();

    if (!ensureNativeCaptionsOn()) {
        // A CC gomb még nem áll készen — a következő observer-tick újrapróbálja.
        return;
    }

    ensureYtStatusMap((error) => {
        // Mire a válasz megjön, lehet, hogy közben kikapcsolták vagy elnavigáltak.
        if (!ytEnabled || !extAlive() || !isYouTubePage()) {
            return;
        }

        if (error) {
            // Backoff alatt nem mutatunk újra értesítést (már láthatta az okát).
            if (error === 'cooldown') {
                return;
            }

            // Bejelentkezés/kapcsolat hiányában nem rejtjük el a natív feliratot —
            // a felhasználó látja az okát, és megmaradnak a normál feliratai.
            showYtBarNotice(
                error === 'unauthenticated'
                    ? 'Jelentkezz be a TopWords-be a szókiemeléshez.'
                    : extErrorMessage(
                          error,
                          'Nem sikerült betölteni a szavaidat — próbáld újra később.',
                      ),
            );

            return;
        }

        if (!ytObserver) {
            startYtObserver();
        }

        // A natív feliratot csak akkor rejtjük, ha az observer már
        // bizonyítottan olvasott felirat-szöveget (M2: felirat-blackout
        // védelem DOM-változás ellen). Az első elrejtést az observer végzi;
        // ez az ág a lejátszó-újrarenderelés utáni visszaállítást fedi.
        if (ytCaptionTextSeen) {
            hideNativeCaptions();
        }
    });
}

function disableYtLyrics() {
    ytObserver?.disconnect();
    ytObserver = null;
    ytBarHost?.remove();
    ytBarHost = null;
    ytCcKicked = false;
    ytCaptionTextSeen = false;
    ytNoCaptionNoticeShown = false;
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
        <style>${YT_PANEL_CSS}</style>
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
    // Ugyanaz a gesztus-készlet, mint a felirat-sávon (sima klikk = popup, dupla =
    // „Tudom", hosszú-nyomás = „Később"). Ha nem szó-spanra esett a klikk, az
    // onWordClick null-spannal fut, és ilyenkor a sor-seeket kezeljük.
    attachCaptionWordGestures(body, {
        wordSpanFromEvent: (e) => e.target?.closest?.('.tw-word') ?? null,
        onWordClick: (span, e) => {
            if (span) {
                handleYtWordClick(span, e.shiftKey);

                return;
            }

            const row = e.target?.closest?.('.seg');

            if (row) {
                seekYtTo(Number(row.dataset.t));
            }
        },
        onQuickStatus: quickStatusOnCaptionWord,
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

/**
 * A panel üzenetét SZÖVEGKÉNT írja ki (textContent), így a hívó által átadott
 * érték soha nem értelmeződik markupként (XSS-2). Korábban nyers `${html}`-t
 * interpolált, ami a hívók fegyelmezettségén múlott; a linket igénylő egyetlen
 * eset a setYtPanelMessageWithLink()-et használja.
 */
function setYtPanelMessage(text) {
    const body = ytPanelHost?.shadowRoot?.getElementById('body');

    if (!body) {
        return;
    }

    const msg = document.createElement('div');

    msg.className = 'msg';
    msg.textContent = text;
    body.replaceChildren(msg);
}

/**
 * Üzenet egyetlen beágyazott linkkel. A href és a linkszöveg külön paraméter, és
 * DOM-API-val (nem string-interpolációval) kerül a panelbe, így markup-injektálás
 * szerkezetileg kizárt.
 */
function setYtPanelMessageWithLink(before, href, linkText, after) {
    const body = ytPanelHost?.shadowRoot?.getElementById('body');

    if (!body) {
        return;
    }

    const msg = document.createElement('div');

    msg.className = 'msg';
    msg.append(before);

    const link = document.createElement('a');

    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = linkText;
    msg.append(link, after);

    body.replaceChildren(msg);
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

    // A→B navigációnál A késve érkező átirata nem renderelődhet B paneljébe.
    const token = ytNavToken;

    ensureYtStatusMap(() => {
        if (token !== ytNavToken) {
            return;
        }

        sendMsg({ type: 'GET_YT_TRANSCRIPT', videoId }, (resp) => {
            if (token !== ytNavToken || !ytPanelEnabled || !ytPanelHost) {
                return;
            }

            // Kapcsolat-/kiszolgáló-jellegű hibák nem jelenthetik azt, hogy „nincs
            // átirat” — külön üzenetet kapnak, hogy a user tudja: érdemes újrapróbálni.
            if (
                !resp ||
                resp.error === 'network' ||
                resp.error === 'rate_limit' ||
                resp.error === 'server'
            ) {
                setYtPanelMessage(
                    extErrorMessage(
                        resp?.error ?? 'network',
                        'Nem sikerült betölteni az átiratot — próbáld újra.',
                    ),
                );

                return;
            }

            if (resp.error === 'unauthenticated') {
                setYtPanelMessageWithLink('Jelentkezz be a ', APP_URL, 'TopWords', '-be.');

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
            // A feliratsávot teljesen összehangoljuk (injektálás + állapot +
            // CC-újrapróbálkozás), a panel-gombnál a vizuális állapotot frissítjük.
            reconcileYtLyrics();
            injectYtPanelToggle();
            updateYtPanelToggleState();
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
    ytCcKicked = false;

    // Kivétel: ha a kick épp lekapcsolta a user saját CC-jét, visszakattintjuk —
    // a CC-beállítást a YouTube videók közt megőrzi, enélkül a user felirata
    // tartósan kikapcsolva maradna.
    if (ytCcKickPending) {
        ytCcKickPending = false;
        const btn = ytCaptionButton();

        if (btn && btn.getAttribute('aria-pressed') === 'false') {
            btn.click();
        }
    }

    // Az új videón újra bizonyítani kell, hogy a felirat-DOM olvasható.
    ytCaptionTextSeen = false;
    ytNoCaptionNoticeShown = false;
    showNativeCaptions();
}

function initYtSubtitles(attempt = 0) {
    if (!isYouTubePage()) {
        return;
    }

    const token = ytNavToken;

    if (!document.querySelector('#movie_player')) {
        if (attempt < 8) {
            setTimeout(() => {
                // Közben elnavigáltak — ez a menet már nem aktuális.
                if (token === ytNavToken) {
                    initYtSubtitles(attempt + 1);
                }
            }, 1000);
        }

        return;
    }

    storageGet(
        { ytLyricsEnabled: false, ytTranscriptEnabled: false },
        ({ ytLyricsEnabled, ytTranscriptEnabled }) => {
            if (token !== ytNavToken || !isYouTubePage()) {
                return;
            }

            ytEnabled = ytLyricsEnabled;
            ytPanelEnabled = ytTranscriptEnabled;
            injectYtPanelToggle();
            startYtControlsObserver();
            reconcileYtLyrics();

            if (ytPanelEnabled) {
                enableYtPanel();
            }
        },
    );
}

function handleYtNavigation() {
    // Érvénytelenítjük a folyamatban lévő init-meneteket, majd takarítunk.
    ytNavToken++;
    destroyYtSubtitles();

    if (isYouTubePage()) {
        // Az init maga várja ki a lejátszót (poll), nem kell fix késleltetés.
        initYtSubtitles();
    }
}

if (location.hostname === 'www.youtube.com') {
    window.addEventListener('yt-navigate-finish', handleYtNavigation);
    window.addEventListener('popstate', handleYtNavigation);

    // Popupból/másik fülről átállított kapcsolóra is reagálunk, hogy a gomb
    // sose csússzon szét a tárolt állapottól.
    try {
        chrome.storage?.onChanged?.addListener((changes, area) => {
            if (area !== 'local' || !extAlive() || !isYouTubePage()) {
                return;
            }

            if (changes.ytLyricsEnabled) {
                ytEnabled = !!changes.ytLyricsEnabled.newValue;
                reconcileYtLyrics();
            }

            if (changes.ytTranscriptEnabled) {
                const next = !!changes.ytTranscriptEnabled.newValue;

                if (next !== ytPanelEnabled) {
                    ytPanelEnabled = next;

                    if (ytPanelEnabled) {
                        enableYtPanel();
                    } else {
                        disableYtPanel();
                    }

                    updateYtPanelToggleState();
                }
            }
        });
    } catch {
        // A storage API nem elérhető ebben a kontextusban — nincs teendő.
    }

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
