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
