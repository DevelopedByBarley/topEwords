/**
 * CSRF headers for fetch() requests to Laravel.
 *
 * Prefers the XSRF-TOKEN cookie, which Laravel refreshes on every response, so
 * it stays valid even after the session is regenerated during an Inertia visit
 * (e.g. right after login). Falls back to the csrf-token meta tag rendered by
 * the blade layout.
 */
export function csrfHeaders(): Record<string, string> {
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='));

    if (cookie) {
        return {
            'X-XSRF-TOKEN': decodeURIComponent(
                cookie.substring('XSRF-TOKEN='.length),
            ),
        };
    }

    return {
        'X-CSRF-TOKEN':
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '',
    };
}
