// Cmd/Alt+W keresőmodal + saját-szó felviteli űrlap (showSearchDetail).

// ── Search modal ──────────────────────────────────────────────────────────────

let searchHost = null;
let searchShadow = null;
let searchDebounce = null;
let searchCsrf = null;
let searchHasAccess = false;
let searchIsAdmin = false;
let searchHasAi = false;
let searchResultsData = [];
let searchSelIdx = -1;

function toggleSearch() {
    if (searchHost) {
        hideSearch();

        return;
    }

    showSearch();
}

function showSearch() {
    hidePopup();
    searchHost = document.createElement('div');
    searchHost.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;pointer-events:auto;';
    // Teljes képernyőn csak a fullscreen elem leszármazottai látszanak, ezért a
    // kereső-modalt is oda tesszük (position:fixed így a viewportra igazodik).
    (document.fullscreenElement ?? document.body).appendChild(searchHost);

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
                <span id="shortcut-hint">${navigator.platform.includes('Mac') ? 'Option' : 'Alt'}+W</span>
            </div>
            <div id="results"><div id="empty" style="display:none">Nincs találat.</div></div>
            <div id="detail"></div>
            <div id="footer-hint">↑↓ = választás &nbsp;·&nbsp; Enter = részletek &nbsp;·&nbsp; Esc = bezár</div>
        </div>
    `;

    const input = searchShadow.getElementById('search-input');
    input.focus();

    // Az oldal saját billentyű-kezelői (egybetűs gyorsbillentyűk, letiltott
    // karakterek) elnyelhetik a gépelést — a kereső eseményeit nem engedjük
    // felbukkanni az oldalhoz, így minden karakter beírható.
    ['keydown', 'keyup', 'keypress', 'input'].forEach((type) => {
        input.addEventListener(type, (e) => e.stopPropagation());
    });

    input.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        const q = input.value.trim();

        if (!q) {
            renderSearchResults([]);

            return;
        }

        showSearchLoading();
        searchDebounce = setTimeout(() => {
            sendMsg({ type: 'SEARCH_WORD', q }, (resp) => {
                if (!searchShadow) {
                    return;
                }

                searchCsrf = resp?.csrf ?? null;
                searchHasAccess = resp?.has_active_access ?? false;
                searchIsAdmin = resp?.is_admin ?? false;
                searchHasAi = resp?.has_ai_access ?? false;
                renderSearchResults(resp?.results ?? [], resp?.error);
            });
        }, 250);
    });

    // Billentyű-navigáció: ↑↓ a találatok között, Enter = részletek
    input.addEventListener('keydown', (e) => {
        if (!searchShadow) {
            return;
        }

        const items = Array.from(
            searchShadow.querySelectorAll('.result-item[data-index]'),
        );

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();

            if (!items.length) {
                return;
            }

            searchSelIdx =
                e.key === 'ArrowDown'
                    ? Math.min(searchSelIdx + 1, items.length - 1)
                    : Math.max(searchSelIdx - 1, 0);
            items.forEach((el, i) =>
                el.classList.toggle('selected', i === searchSelIdx),
            );
            items[searchSelIdx]?.scrollIntoView({ block: 'nearest' });

            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();

            if (searchSelIdx >= 0 && searchResultsData[searchSelIdx]) {
                showSearchDetail(searchResultsData[searchSelIdx]);
            } else if (searchResultsData.length > 0) {
                searchSelIdx = 0;
                items[0]?.classList.add('selected');
                showSearchDetail(searchResultsData[0]);
            } else {
                searchShadow.getElementById('add-notfound')?.click();
            }
        }
    });

    searchHost.addEventListener('mousedown', (e) => {
        const modal = searchShadow.getElementById('modal');

        if (!e.composedPath().includes(modal)) {
            hideSearch();
        }
    });
}

function hideSearch() {
    if (searchHost) {
        searchHost.remove();
        searchHost = null;
        searchShadow = null;
        searchResultsData = [];
        searchSelIdx = -1;
        clearTimeout(searchDebounce);
    }
}

/**
 * Megnyitja a keresőt egy adott szóra és egyből a hozzáadás-űrlapot mutatja
 * (ha a szó nincs a szótárban) — így a feliratból/bárhonnan fel lehet venni
 * saját szót az app külön megnyitása nélkül.
 */
function openAddWordForm(word) {
    showSearch();

    const input = searchShadow?.getElementById('search-input');

    if (input) {
        input.value = word;
    }

    showSearchLoading();
    sendMsg({ type: 'SEARCH_WORD', q: word }, (resp) => {
        if (!searchShadow) {
            return;
        }

        searchCsrf = resp?.csrf ?? null;
        searchHasAccess = resp?.has_active_access ?? false;
        searchIsAdmin = resp?.is_admin ?? false;
        searchHasAi = resp?.has_ai_access ?? false;

        const results = resp?.results ?? [];
        const exact = results.find(
            (r) => r.word?.toLowerCase() === word.toLowerCase(),
        );

        renderSearchResults(results, resp?.error);

        if (exact) {
            showSearchDetail(exact);
        } else {
            showSearchDetail({ word, _notFound: true });
        }
    });
}

function showSearchLoading() {
    if (!searchShadow) {
        return;
    }

    searchShadow.getElementById('results').innerHTML =
        '<div id="loading">Keresés…</div>';
    const detail = searchShadow.getElementById('detail');
    detail.classList.remove('visible');
    detail.innerHTML = '';
}

function renderSearchResults(results, error) {
    if (!searchShadow) {
        return;
    }

    searchResultsData = results ?? [];
    searchSelIdx = -1;
    const container = searchShadow.getElementById('results');
    const detail = searchShadow.getElementById('detail');
    detail.classList.remove('visible');
    detail.innerHTML = '';

    if (error === 'unauthenticated' || error === 'network') {
        container.innerHTML = `<div id="empty">${error === 'network' ? 'Nincs kapcsolat a TopWords-szel.' : 'Jelentkezz be a TopWords-be a kereséshez.'}</div>`;

        return;
    }

    if (!results.length) {
        const q =
            searchShadow.getElementById('search-input')?.value.trim() ?? '';

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
            container
                .querySelector('#add-notfound')
                .addEventListener('click', () => {
                    showSearchDetail({ word: q, _notFound: true });
                });
        } else {
            container.innerHTML = '<div id="empty">Nincs találat.</div>';
        }

        return;
    }

    container.innerHTML = results
        .map((r, i) => {
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
        })
        .join('');

    container.querySelectorAll('.result-item').forEach((el) => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index);
            showSearchDetail(results[idx]);
        });
    });
}

function showSearchDetail(data) {
    if (!searchShadow) {
        return;
    }

    const detail = searchShadow.getElementById('detail');

    let statusSection = '';
    let importanceSection = '';

    if (searchHasAccess) {
        statusSection = `<div class="detail-statuses">${statusBtnsHtml(data.status)}</div>`;
        importanceSection = `<div class="meta-label">Fontosság</div><div class="importance-row" id="detail-importance">${starsHtml(data.importance)}</div>`;
    }

    // Ha nincs a DB-ben (nem found), mutass teljes "Hozzáadás" formot
    if (data._notFound) {
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(data.word + ' angol szó: jelentése magyarul, szinonimák, példamondat angolul és magyarul, szófaj, igeragozás ha ige')}&udm=50`;
        detail.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <span style="font-size:14px;font-weight:700;color:#0f172a">${esc(data.word)}</span>
                <div style="display:flex;gap:6px;align-items:center">
                    ${searchIsAdmin || searchHasAi ? `<button id="gemini-fill-btn" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;color:#7c3aed;border:1px solid #ede9fe;border-radius:20px;background:#faf5ff;padding:3px 10px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all 0.15s">✨ AI kitöltés</button>` : ''}
                    <a class="google-ai-link" href="${googleUrl}" target="_blank">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        Google AI
                    </a>
                </div>
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
            <div style="margin-top:10px">
                <div class="meta-label">Státusz</div>
                <div class="detail-statuses" id="add-statuses">${statusBtnsHtml('known')}</div>
                <div class="meta-label">Fontosság</div>
                <div class="importance-row" id="add-importance">${starsHtml(null)}</div>
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
            detail.querySelector('#verb-fields').style.display =
                pos === 'verb' ? 'flex' : 'none';
            detail.querySelector('#noun-fields').style.display =
                pos === 'noun' ? 'flex' : 'none';
            detail.querySelector('#adj-fields').style.display =
                pos === 'adj' ? 'flex' : 'none';
        });

        // Felvitelkor választható státusz (alapból „Tudom") és fontosság.
        let addStatus = 'known';
        let addImportance = null;

        const addStatusRow = detail.querySelector('#add-statuses');
        addStatusRow.querySelectorAll('.status-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.status;
                const isSame = addStatus === key;

                addStatusRow.querySelectorAll('.status-btn').forEach((b) => {
                    b.classList.remove('active');
                    b.style.background = '';
                    b.style.borderColor = '';
                    b.style.color = '';
                });

                if (!isSame) {
                    btn.classList.add('active');
                    const color = STATUS_COLORS[key];
                    btn.style.background = color;
                    btn.style.borderColor = color;
                    btn.style.color = '#fff';
                }

                addStatus = isSame ? null : key;
            });
        });

        const addImpRow = detail.querySelector('#add-importance');
        addImpRow.querySelectorAll('.imp-star').forEach((star) => {
            star.addEventListener('click', () => {
                const n = parseInt(star.dataset.star);
                addImportance = addImportance === n ? null : n;
                paintStars(addImpRow, addImportance);
            });
        });

        const geminiBtn = detail.querySelector('#gemini-fill-btn');

        if (geminiBtn) {
            geminiBtn.addEventListener('click', () => {
                geminiBtn.disabled = true;
                geminiBtn.textContent = '⏳ Töltés…';

                sendMsg({ type: 'GEMINI_LOOKUP', word: data.word }, (resp) => {
                    geminiBtn.disabled = false;
                    geminiBtn.innerHTML = '✨ AI kitöltés';

                    if (resp?.error === 'ai_limit') {
                        const fb = detail.querySelector('#add-feedback');

                        if (fb) {
                            fb.textContent =
                                resp.message ??
                                'Elérted a havi AI-felhasználási kereted.';
                            fb.style.color = '#f97316';
                            fb.style.display = 'block';
                        }

                        return;
                    }

                    if (!resp || resp.error) {
                        return;
                    }

                    const pos = resp.part_of_speech ?? '';

                    if (pos) {
                        posSelect.value = pos;
                        posSelect.dispatchEvent(new Event('change'));
                    }

                    if (resp.meaning_hu) {
                        detail.querySelector('#add-meaning').value =
                            resp.meaning_hu;
                    }

                    if (resp.extra_meanings) {
                        detail.querySelector('#add-extra').value =
                            resp.extra_meanings;
                    }

                    if (resp.synonyms) {
                        detail.querySelector('#add-synonyms').value =
                            resp.synonyms;
                    }

                    if (resp.example_en) {
                        detail.querySelector('#add-example-en').value =
                            resp.example_en;
                    }

                    if (resp.example_hu) {
                        detail.querySelector('#add-example-hu').value =
                            resp.example_hu;
                    }

                    if (pos === 'verb') {
                        if (resp.verb_past) {
                            detail.querySelector('#add-verb-past').value =
                                resp.verb_past;
                        }

                        if (resp.verb_past_participle) {
                            detail.querySelector('#add-verb-pp').value =
                                resp.verb_past_participle;
                        }

                        if (resp.verb_present_participle) {
                            detail.querySelector('#add-verb-prog').value =
                                resp.verb_present_participle;
                        }

                        if (resp.verb_third_person) {
                            detail.querySelector('#add-verb-3rd').value =
                                resp.verb_third_person;
                        }

                        if (resp.is_irregular) {
                            detail.querySelector('#add-irregular').checked =
                                true;
                        }
                    }

                    if (pos === 'noun' && resp.noun_plural) {
                        detail.querySelector('#add-noun-plural').value =
                            resp.noun_plural;
                    }

                    if (pos === 'adj') {
                        if (resp.adj_comparative) {
                            detail.querySelector('#add-adj-comp').value =
                                resp.adj_comparative;
                        }

                        if (resp.adj_superlative) {
                            detail.querySelector('#add-adj-super').value =
                                resp.adj_superlative;
                        }
                    }
                });
            });
        }

        detail.querySelector('#add-btn').addEventListener('click', () => {
            const pos = posSelect.value;
            const btn = detail.querySelector('#add-btn');
            const meaning = detail.querySelector('#add-meaning').value.trim();

            // A jelentés kötelező — üresen nem vihető fel szó.
            if (!meaning) {
                const fb = detail.querySelector('#add-feedback');
                fb.textContent = 'A magyar jelentés megadása kötelező.';
                fb.style.color = '#f97316';
                fb.style.display = 'block';
                detail.querySelector('#add-meaning').focus();

                return;
            }

            btn.disabled = true;
            btn.textContent = '…';

            const payload = {
                type: 'ADD_WORD',
                csrf: searchCsrf,
                word: data.word,
                meaning_hu: meaning,
                extra_meanings:
                    detail.querySelector('#add-extra').value.trim() || null,
                synonyms:
                    detail.querySelector('#add-synonyms').value.trim() || null,
                part_of_speech: pos || null,
                example_en:
                    detail.querySelector('#add-example-en').value.trim() ||
                    null,
                example_hu:
                    detail.querySelector('#add-example-hu').value.trim() ||
                    null,
                status: addStatus,
                importance: addImportance,
            };

            if (pos === 'verb') {
                payload.form_base =
                    detail.querySelector('#add-form-base').value.trim() || null;
                payload.verb_past =
                    detail.querySelector('#add-verb-past').value.trim() || null;
                payload.verb_past_participle =
                    detail.querySelector('#add-verb-pp').value.trim() || null;
                payload.verb_present_participle =
                    detail.querySelector('#add-verb-prog').value.trim() || null;
                payload.verb_third_person =
                    detail.querySelector('#add-verb-3rd').value.trim() || null;
                payload.is_irregular =
                    detail.querySelector('#add-irregular').checked;
            }

            if (pos === 'noun') {
                payload.noun_plural =
                    detail.querySelector('#add-noun-plural').value.trim() ||
                    null;
            }

            if (pos === 'adj') {
                payload.adj_comparative =
                    detail.querySelector('#add-adj-comp').value.trim() || null;
                payload.adj_superlative =
                    detail.querySelector('#add-adj-super').value.trim() || null;
            }

            sendMsg(payload, (resp) => {
                const fb = detail.querySelector('#add-feedback');

                if (resp?.ok) {
                    btn.style.display = 'none';
                    fb.textContent = `„${data.word}" hozzáadva!`;
                    fb.style.color = '#22c55e';
                    fb.style.display = 'block';
                    refreshVocabHighlights();
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
                    fb.textContent = 'Nem sikerült menteni — próbáld újra.';
                    fb.style.color = '#ef4444';
                    fb.style.display = 'block';
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
        ${importanceSection}
        <div style="display:flex;align-items:center;gap:4px">
            <a class="detail-link" href="${APP_URL}/words?search=${encodeURIComponent(data.word)}" target="_blank">Megnyitás a TopWords-ben →</a>
            <button class="detail-tts-btn" title="Kiejtés angolul">🔊</button>
            <button class="fc-btn" title="Flashcard készítése" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;border:1px solid #e2e8f0;background:none;cursor:pointer;font-size:12px;flex-shrink:0;margin-left:6px">📇</button>
        </div>
    `;
    detail.classList.add('visible');
    detail.classList.remove('form-mode');

    detail
        .querySelector('.detail-tts-btn')
        ?.addEventListener('click', () => speakWord(data.word));

    detail.querySelector('.fc-btn')?.addEventListener('click', () => {
        openFlashcardModal(data, searchCsrf);
    });

    if (searchHasAccess) {
        detail.querySelectorAll('.status-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const newStatus = btn.dataset.status;
                const isSame = btn.classList.contains('active');
                const prev = data;

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

                sendMsg(
                    {
                        type: 'UPDATE_STATUS',
                        id: data.id,
                        is_custom: data.is_custom,
                        status: isSame ? null : newStatus,
                        csrf: searchCsrf,
                    },
                    (resp) => {
                        if (resp?.ok) {
                            refreshVocabHighlights();

                            return;
                        }

                        if (!searchShadow) {
                            return;
                        }

                        // Sikertelen mentés → előző állapot visszaállítása
                        data = prev;
                        showSearchDetail(prev);
                    },
                );
            });
        });

        const impRow = detail.querySelector('#detail-importance');

        impRow?.querySelectorAll('.imp-star').forEach((star) => {
            star.addEventListener('click', () => {
                const n = parseInt(star.dataset.star);
                const prevImportance = data.importance ?? null;
                const next = prevImportance === n ? null : n;

                paintStars(impRow, next);
                data = { ...data, importance: next };

                sendMsg(
                    {
                        type: 'UPDATE_IMPORTANCE',
                        id: data.id,
                        is_custom: data.is_custom,
                        importance: next,
                        csrf: searchCsrf,
                    },
                    (resp) => {
                        if (!resp?.ok) {
                            // Sikertelen mentés → előző érték visszaállítása
                            data = { ...data, importance: prevImportance };
                            paintStars(impRow, prevImportance);
                        }
                    },
                );
            });
        });
    }
}
