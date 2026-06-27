/**
 * Allowlist-based HTML sanitizer for user-stored rich text (flashcard front/back,
 * notes). Strips anything not on the tag/attribute allowlist, every `on*` event
 * handler, and `javascript:`/`data:` URLs — so stored HTML (e.g. a flashcard
 * created via the extension API with a raw `<img onerror=…>`) cannot execute when
 * rendered via `dangerouslySetInnerHTML`.
 *
 * Uses the DOM when available; falls back to a conservative regex strip during
 * SSR (no `document`).
 */

const ALLOWED_TAGS = new Set([
    'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'del', 'ins', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'a', 'mark', 'sub', 'sup', 'small', 'hr',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
]);

// Tags whose entire subtree is dropped (never unwrapped to text).
const DROP_TAGS = new Set([
    'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form',
    'link', 'meta', 'base', 'noscript', 'template',
]);

const ALLOWED_ATTRS = new Set([
    'class', 'style', 'href', 'target', 'rel', 'colspan', 'rowspan',
]);

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/)/i;

function sanitizeWithDom(dirty: string): string {
    const tpl = document.createElement('template');
    tpl.innerHTML = dirty;

    // Snapshot before mutating; children of dropped/unwrapped nodes are also in
    // the list and get processed in their own turn.
    const elements = Array.from(tpl.content.querySelectorAll('*'));

    for (const el of elements) {
        const tag = el.tagName.toLowerCase();

        if (DROP_TAGS.has(tag)) {
            el.remove();
            continue;
        }

        if (!ALLOWED_TAGS.has(tag)) {
            // Unwrap unknown-but-not-dangerous tags: keep their children/text.
            el.replaceWith(...Array.from(el.childNodes));
            continue;
        }

        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();

            if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) {
                el.removeAttribute(attr.name);
                continue;
            }

            if (name === 'href' && !SAFE_URL.test(attr.value.trim())) {
                el.removeAttribute(attr.name);
                continue;
            }

            if (name === 'style' && /expression\s*\(|javascript:|url\s*\(/i.test(attr.value)) {
                el.removeAttribute(attr.name);
            }
        }

        if (tag === 'a' && el.getAttribute('href')) {
            el.setAttribute('rel', 'noopener noreferrer nofollow');
            el.setAttribute('target', '_blank');
        }
    }

    return tpl.innerHTML;
}

function sanitizeWithRegex(dirty: string): string {
    return dirty
        .replace(/<\s*(script|style|iframe|object|embed|svg|math|form|link|meta|base|noscript|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/<\s*(script|style|iframe|object|embed|svg|math|form|link|meta|base|noscript|template)\b[^>]*\/?\s*>/gi, '')
        .replace(/\son[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, '');
}

export function sanitizeHtml(dirty: string | null | undefined): string {
    if (!dirty) {
        return '';
    }

    if (typeof document === 'undefined') {
        return sanitizeWithRegex(dirty);
    }

    return sanitizeWithDom(dirty);
}
