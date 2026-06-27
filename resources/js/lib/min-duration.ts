/**
 * Resolves with the awaited value, but never sooner than `ms` milliseconds.
 *
 * AI responses are cached server-side, so a cache hit returns almost instantly
 * — fast enough that it's obvious no model actually ran. Wrapping the request
 * in a minimum duration keeps the loading state on screen long enough to read
 * as a genuine AI response. A real (uncached) generation is usually already
 * slower than this floor, so it only pads the suspiciously quick cache hits.
 */
export async function withMinDuration<T>(
    work: Promise<T>,
    ms = 2000,
): Promise<T> {
    const [result] = await Promise.all([
        work,
        new Promise((resolve) => setTimeout(resolve, ms)),
    ]);

    return result;
}
