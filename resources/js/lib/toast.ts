export type ClientToastKind = 'error' | 'info' | 'success';

export interface ClientToastDetail {
    kind: ClientToastKind;
    message: string;
}

export const CLIENT_TOAST_EVENT = 'client-toast';

export function showToast(kind: ClientToastKind, message: string): void {
    window.dispatchEvent(
        new CustomEvent<ClientToastDetail>(CLIENT_TOAST_EVENT, {
            detail: { kind, message },
        }),
    );
}
