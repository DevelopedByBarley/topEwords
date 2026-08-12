// TopWords content script — minden Shadow DOM-stílus egy helyen.
// Ez a shared.js után, a komponens-modulok előtt töltődik be (lásd manifest.json).
// A CSS itt JS-template-literálként él, mert a stílusok shadow rootba injektálódnak,
// ahová a manifest content_scripts.css nem jut el.

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

    .synonyms {
        display: block;
        font-size: 12px;
        color: #64748b;
        margin-bottom: 8px;
    }

    .example {
        display: block;
        font-size: 12px;
        font-style: italic;
        color: #64748b;
        margin-bottom: 10px;
        padding-left: 8px;
        border-left: 2px solid #e2e8f0;
    }

    .example-hu {
        color: #94a3b8;
    }

    .error-feedback {
        display: block;
        font-size: 12px;
        color: #ef4444;
        font-weight: 500;
        margin-bottom: 6px;
    }

    .statuses {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 10px;
    }

    .statuses.saving {
        opacity: 0.55;
        pointer-events: none;
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

    .importance-row { display: flex; gap: 2px; margin-bottom: 10px; }

    .imp-star {
        flex: 1;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 2px 0;
        color: #cbd5e1;
        transition: color 0.12s;
        font-family: inherit;
    }

    .imp-star.filled { color: #fbbf24; }
    .imp-star:hover { color: #f59e0b; }

    .meta-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-bottom: 4px;
    }

    .footer {
        display: flex;
        align-items: center;
        padding-top: 8px;
        border-top: 1px solid #f1f5f9;
    }

    a.link, button.link {
        font-size: 12px;
        color: #6366f1;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    button.link {
        border: none;
        background: none;
        padding: 0;
        font-family: inherit;
    }

    a.link:hover, button.link:hover { color: #4f46e5; }

    .upgrade-hint {
        display: block;
        margin: 8px 0 2px;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 500;
        color: #7c3aed;
        background: #faf5ff;
        border: 1px solid #ede9fe;
        border-radius: 8px;
        text-decoration: none;
        cursor: pointer;
    }

    .upgrade-hint:hover { background: #f3e8ff; border-color: #d8b4fe; }

    .tts-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1px solid #e2e8f0;
        background: none;
        cursor: pointer;
        font-size: 13px;
        margin-left: auto;
        flex-shrink: 0;
        transition: background 0.15s;
    }

    .tts-btn:hover { background: #f1f5f9; }

    .feedback {
        display: block;
        font-size: 12px;
        color: #22c55e;
        font-weight: 500;
        margin-bottom: 6px;
    }
`;

const SEARCH_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
    }

    #backdrop {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 80px;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(2px);
    }

    #modal {
        width: 480px;
        max-height: 520px;
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        color: #1e293b;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    #search-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
    }

    #search-icon {
        color: #94a3b8;
        flex-shrink: 0;
    }

    #search-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 16px;
        color: #0f172a;
        background: transparent;
    }

    #search-input::placeholder { color: #cbd5e1; }

    #shortcut-hint {
        font-size: 11px;
        color: #cbd5e1;
        flex-shrink: 0;
    }

    #results {
        overflow-y: auto;
        flex: 1;
    }

    .result-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        cursor: pointer;
        border-bottom: 1px solid #f8fafc;
        transition: background 0.1s;
    }

    .result-item:hover { background: #f8fafc; }
    .result-item.selected { background: #eef2ff; }
    .result-item:last-child { border-bottom: none; }

    .result-main { flex: 1; min-width: 0; }

    .result-word {
        font-weight: 600;
        font-size: 14px;
        color: #0f172a;
    }

    .result-meaning {
        font-size: 12px;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
    }

    .result-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        flex-shrink: 0;
    }

    .result-rank { font-size: 11px; color: #cbd5e1; }

    .result-status {
        font-size: 10px;
        padding: 1px 7px;
        border-radius: 20px;
        font-weight: 500;
        color: #fff;
    }

    .result-custom {
        font-size: 10px;
        padding: 1px 7px;
        border-radius: 20px;
        background: #ede9fe;
        color: #7c3aed;
        font-weight: 500;
    }

    #empty {
        padding: 32px 16px;
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
    }

    #loading {
        padding: 24px 16px;
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
    }

    /* Detail panel */
    #detail {
        padding: 14px 16px;
        border-top: 1px solid #f1f5f9;
        display: none;
    }

    #detail.visible { display: block; }

    .detail-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
    }

    .detail-word {
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
    }

    .detail-pos { font-size: 12px; color: #94a3b8; font-style: italic; }
    .detail-rank { font-size: 12px; color: #cbd5e1; margin-left: auto; }

    .detail-meaning { font-size: 14px; color: #334155; margin-bottom: 4px; }
    .detail-extra { font-size: 12px; color: #94a3b8; margin-bottom: 10px; }

    .detail-statuses {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 10px;
    }

    .detail-statuses.saving,
    .importance-row.saving {
        opacity: 0.55;
        pointer-events: none;
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

    .status-btn:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
    .status-btn.active { color: #fff; border-color: transparent; }

    .importance-row { display: flex; gap: 2px; margin-bottom: 10px; }

    .imp-star {
        flex: 1;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 2px 0;
        color: #cbd5e1;
        transition: color 0.12s;
        font-family: inherit;
    }

    .imp-star.filled { color: #fbbf24; }
    .imp-star:hover { color: #f59e0b; }

    .meta-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-bottom: 4px;
    }

    .detail-link {
        font-size: 12px;
        color: #6366f1;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .detail-link:hover { color: #4f46e5; }

    #footer-hint {
        padding: 8px 16px;
        border-top: 1px solid #f1f5f9;
        font-size: 11px;
        color: #cbd5e1;
        text-align: center;
    }

    #detail.form-mode {
        overflow-y: auto;
        max-height: 310px;
    }

    .form-fields { display: flex; flex-direction: column; gap: 6px; }

    .form-input {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 13px;
        outline: none;
        font-family: inherit;
        color: #0f172a;
        background: #fff;
        box-sizing: border-box;
    }

    .form-input:focus { border-color: #6366f1; }

    select.form-input { cursor: pointer; }

    .form-row { display: flex; gap: 6px; }
    .form-row .form-input { flex: 1; min-width: 0; }

    .form-section {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .form-section-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-bottom: 2px;
    }

    .form-check {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #475569;
        cursor: pointer;
    }

    .add-btn {
        padding: 7px 18px;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s;
        flex-shrink: 0;
    }

    .add-btn:hover { background: #4f46e5; }
    .add-btn:disabled { opacity: 0.6; cursor: default; }

    .google-ai-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 500;
        color: #4285f4;
        text-decoration: none;
        padding: 3px 10px;
        border: 1px solid #dbeafe;
        border-radius: 20px;
        background: #eff6ff;
        white-space: nowrap;
        transition: all 0.15s;
    }

    .google-ai-link:hover { background: #dbeafe; border-color: #93c5fd; }

    .upgrade-hint {
        display: block;
        margin: 8px 0;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 500;
        color: #7c3aed;
        background: #faf5ff;
        border: 1px solid #ede9fe;
        border-radius: 8px;
        text-decoration: none;
        cursor: pointer;
    }

    .upgrade-hint:hover { background: #f3e8ff; border-color: #d8b4fe; }

    /* AI-tájékoztató: az AI-kitöltés külső szolgáltatót hív, és tévedhet. */
    .ai-note {
        margin: 8px 0 0;
        padding: 7px 9px;
        font-size: 11px;
        line-height: 1.45;
        color: #6b7280;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
    }

    .ai-note a { color: #6366f1; text-decoration: underline; text-underline-offset: 2px; }

    .detail-tts-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1px solid #e2e8f0;
        background: none;
        cursor: pointer;
        font-size: 13px;
        margin-left: auto;
        flex-shrink: 0;
        transition: background 0.15s;
    }

    .detail-tts-btn:hover { background: #f1f5f9; }
`;

const FC_MODAL_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
    }

    .fc-backdrop {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 48px 16px;
        background: rgba(15, 23, 42, 0.5);
        backdrop-filter: blur(2px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .fc-card {
        width: min(560px, 94vw);
        max-height: 86vh;
        overflow-y: auto;
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
        padding: 18px 20px 20px;
        color: #1e293b;
    }

    .fc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }

    .fc-title { font-size: 16px; font-weight: 700; color: #0f172a; }
    .fc-title small { font-weight: 500; color: #94a3b8; margin-left: 6px; }

    .fc-close {
        width: 30px; height: 30px;
        border: none; background: none; cursor: pointer;
        font-size: 22px; line-height: 1; color: #94a3b8; border-radius: 50%;
        flex-shrink: 0;
    }
    .fc-close:hover { background: #f1f5f9; color: #475569; }

    .fc-label {
        font-size: 11px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.05em; color: #94a3b8; margin: 12px 0 4px;
    }

    .fc-input {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        padding: 8px 11px;
        font-size: 14px;
        font-family: inherit;
        color: #0f172a;
        background: #fff;
        outline: none;
    }
    .fc-input:focus { border-color: #6366f1; }
    .fc-select { cursor: pointer; }
    .fc-area { resize: vertical; min-height: 64px; line-height: 1.45; }

    .fc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 520px) { .fc-grid { grid-template-columns: 1fr; } }

    .fc-preview-box {
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        padding: 10px 12px;
        background: #f8fafc;
        max-height: 320px;
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.5;
        color: #0f172a;
    }
    .fc-preview-box p { margin: 0 0 6px; }
    .fc-preview-box :last-child { margin-bottom: 0; }

    .fc-manual {
        margin-top: 8px;
        font-size: 12px; color: #6366f1;
        background: none; border: none; cursor: pointer;
        font-family: inherit; text-decoration: underline;
    }

    .fc-row { display: flex; gap: 14px; }

    .fc-color {
        width: 48px; height: 38px;
        border: 1px solid #e2e8f0; border-radius: 9px;
        background: #fff; cursor: pointer; padding: 2px;
    }

    .fc-actions { display: flex; align-items: center; gap: 10px; margin-top: 16px; flex-wrap: wrap; }

    .fc-save {
        padding: 9px 22px; background: #6366f1; color: #fff;
        border: none; border-radius: 9px; font-size: 14px; font-weight: 600;
        cursor: pointer; font-family: inherit; transition: background 0.15s;
    }
    .fc-save:hover { background: #4f46e5; }
    .fc-save:disabled { opacity: 0.6; cursor: default; }

    .fc-ai {
        padding: 9px 14px; background: #faf5ff; color: #7c3aed;
        border: 1px solid #ede9fe; border-radius: 9px; font-size: 13px; font-weight: 500;
        cursor: pointer; font-family: inherit;
    }
    .fc-ai:hover { background: #f3e8ff; }
    .fc-ai:disabled { opacity: 0.6; cursor: default; }

    .fc-feedback { font-size: 13px; font-weight: 500; }

    /* AI-tájékoztató: az AI-kártya külső szolgáltatótól jön, és tévedhet. */
    .fc-ai-note {
        margin-top: 10px;
        padding: 8px 10px;
        font-size: 11px;
        line-height: 1.45;
        color: #6b7280;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
    }

    .fc-ai-note a { color: #6366f1; text-decoration: underline; text-underline-offset: 2px; }

    .fc-empty { font-size: 14px; color: #475569; margin-bottom: 8px; }
    .fc-empty-link { font-size: 13px; color: #6366f1; text-decoration: underline; text-underline-offset: 2px; }

    .fc-loading { font-size: 14px; color: #94a3b8; padding: 16px 0; text-align: center; }
`;

const YT_BAR_CSS = `
    #bar {
        display: none;
        background: rgba(8,8,8,0.85);
        backdrop-filter: blur(4px);
        border-radius: 6px;
        padding: 8px 14px;
        font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
        font-size: 20px;
        line-height: 1.5;
        color: #fff;
        text-align: center;
        word-break: break-word;
        pointer-events: auto;
        transition: opacity 0.15s;
    }
    .tw-word {
        cursor: pointer;
        border-radius: 3px;
        padding: 0 1px;
        transition: opacity 0.1s;
    }
    .tw-word:hover { opacity: 0.8; }
`;

const YT_PANEL_CSS = `
    #panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: rgba(15,15,15,0.96);
        color: #f1f1f1;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        font-family: Roboto, Arial, sans-serif;
        overflow: hidden;
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    }
    #head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #close { background: none; border: none; color: #aaa; font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; }
    #close:hover { color: #fff; }
    #body { flex: 1; overflow-y: auto; padding: 6px; scrollbar-width: thin; }
    .msg { padding: 16px; color: #aaa; font-size: 13px; text-align: center; line-height: 1.5; }
    .msg a { color: #3ea6ff; }
    .seg { display: flex; gap: 8px; padding: 6px 8px; border-radius: 8px; cursor: pointer; font-size: 14px; line-height: 1.45; }
    .seg:hover { background: rgba(255,255,255,0.07); }
    .seg.active { background: rgba(62,166,255,0.16); }
    .ts { flex: 0 0 auto; min-width: 40px; padding-top: 2px; color: #3ea6ff; font-size: 12px; font-variant-numeric: tabular-nums; }
    .txt { flex: 1; }
    .tw-word { cursor: pointer; border-radius: 3px; }
    .tw-word:hover { opacity: 0.8; text-decoration: underline; }
`;

const NFX_BAR_CSS = `
    #bar {
        display: none;
        background: rgba(8,8,8,0.85);
        backdrop-filter: blur(4px);
        border-radius: 6px;
        padding: 10px 18px;
        font-family: 'Netflix Sans', Roboto, Arial, sans-serif;
        font-size: 26px;
        line-height: 1.5;
        color: #fff;
        text-align: center;
        word-break: break-word;
        pointer-events: auto;
    }
    .tw-word {
        cursor: pointer;
        border-radius: 3px;
        padding: 0 1px;
        transition: opacity 0.1s;
    }
    .tw-word:hover { opacity: 0.8; }
`;

const NFX_TOGGLE_CSS = `
    #btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 68px;
        height: 46px;
        border: none;
        border-radius: 8px;
        background: rgba(0,0,0,0.55);
        cursor: pointer;
        padding: 0;
        opacity: 0.85;
        transition: opacity 0.15s, background 0.15s;
    }
    #btn:hover { opacity: 1; background: rgba(0,0,0,0.75); }
`;

