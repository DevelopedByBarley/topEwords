export type ClientToastKind = 'error' | 'info' | 'success';

export interface ClientToastDetail {
    kind: ClientToastKind;
    message: string;
}

export const CLIENT_TOAST_EVENT = 'client-toast';

/**
 * Show a toast from client-side code (fetch errors etc.). The globally
 * mounted FlashToast component listens for this event and renders it the
 * same way as backend flash messages.
 */
export function showToast(kind: ClientToastKind, message: string): void {
    window.dispatchEvent(
        new CustomEvent<ClientToastDetail>(CLIENT_TOAST_EVENT, {
            detail: { kind, message },
        }),
    );
}
