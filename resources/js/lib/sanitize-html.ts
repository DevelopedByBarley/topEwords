const ALLOWED_TAGS = new Set([
    'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'del', 'ins', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'a', 'mark', 'sub', 'sup', 'small', 'hr',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
]);

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

    const elements = Array.from(tpl.content.querySelectorAll('*'));

    for (const el of elements) {
        const tag = el.tagName.toLowerCase();

        if (DROP_TAGS.has(tag)) {
            el.remove();
            continue;
        }

        if (!ALLOWED_TAGS.has(tag)) {
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

export function sanitizeHtml(dirty: string | null | undefined): string {
    if (!dirty) {
        return '';
    }

    if (typeof document === 'undefined') {
        return '';
    }

    return sanitizeWithDom(dirty);
}
