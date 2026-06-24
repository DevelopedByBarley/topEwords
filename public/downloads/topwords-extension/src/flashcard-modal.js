// Flashcard-készítő modal (popupból/keresőből).

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
            root.querySelector('[data-fc-front-preview]').replaceChildren(
                sanitizeAiHtml(aiFront),
            );
            root.querySelector('[data-fc-back-preview]').replaceChildren(
                sanitizeAiHtml(aiBack),
            );
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

    card.querySelector('.fc-close').addEventListener(
        'click',
        closeFlashcardModal,
    );

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
