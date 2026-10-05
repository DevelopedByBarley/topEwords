import { csrfHeaders } from '@/lib/csrf';

export interface JsonResult {
    ok: boolean;
    status: number;
    data: Record<string, unknown>;
}

async function requestJson(
    method: 'POST' | 'DELETE',
    url: string,
    body?: object,
): Promise<JsonResult> {
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
            ...csrfHeaders(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
    >;

    return { ok: response.ok, status: response.status, data };
}

export async function postJson(
    url: string,
    body?: object,
): Promise<JsonResult> {
    return requestJson('POST', url, body);
}

export async function deleteJson(url: string): Promise<JsonResult> {
    return requestJson('DELETE', url);
}

export function httpErrorMessage(
    status?: number,
    fallback = 'A mentés nem sikerült — próbáld újra.',
): string {
    if (status === 401 || status === 419) {
        return 'A munkameneted lejárt — jelentkezz be újra, különben a módosításaid elvesznek.';
    }

    if (status === 429) {
        return 'Túl sok kérés — várj egy kicsit, majd próbáld újra.';
    }

    if (status === undefined) {
        return 'Nincs hálózati kapcsolat — a módosítás nem mentődött el.';
    }

    return fallback;
}
