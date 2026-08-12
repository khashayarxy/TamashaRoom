/**
 * Tab-local polling suspension controller.
 *
 * Mitigates same-tab navigation races by pausing/aborting residual in-flight
 * room background polling loops (playback-sync, presence, chat) when the user
 * initiates a navigation or form submission within the same browser tab.
 *
 * Note: Cross-tab session protection (e.g. Tab 2 logging in while Tab 1 has active
 * room polls) is handled at the HTTP layer by the backend `SuppressAnonymousSessionCookie`
 * middleware, which prevents 401 unauthenticated background responses from issuing
 * guest `Set-Cookie` headers that would overwrite the browser's cookie jar.
 */
let suspended = false;

export function suspendPolling(): void {
    suspended = true;
}

export function resumePolling(): void {
    suspended = false;
}

export function isPollingSuspended(): boolean {
    return suspended;
}
