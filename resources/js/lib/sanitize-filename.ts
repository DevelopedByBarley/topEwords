/**
 * Returns a filename safe to send as the multipart `filename` of an upload.
 *
 * The production server runs a WAF (ModSecurity / OWASP CRS) that flags an
 * apostrophe or quote in a request — including inside the multipart filename —
 * as a SQL-injection attempt and rejects it with a 403 before the request ever
 * reaches Laravel. A title like "Ender's Game" was enough to trip it. We strip
 * the quote-like characters and replace any other punctuation with a space so
 * the transmitted name stays readable (the book title is derived from it) while
 * passing the WAF. The extension is preserved and lowercased so server-side
 * `extensions:` validation still matches.
 */
export function sanitizeUploadFilename(name: string): string {
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
    const base = dot > 0 ? name.slice(0, dot) : name;

    const safeBase =
        base
            .replace(/['"`’‘”“]/g, '')
            .replace(/[^\p{L}\p{N} _.-]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim() || 'book';

    return safeBase + ext;
}
