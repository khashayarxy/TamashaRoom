import Echo from "laravel-echo";
import Pusher from "pusher-js";

/**
 * Minimal subset of the Echo presence-channel surface the room hooks use.
 * Kept deliberately narrow so tests can fake it and the Reverb migration
 * (same Pusher protocol) needs no changes here.
 */
export interface EchoPresenceChannel {
    here: (callback: (members: unknown[]) => void) => EchoPresenceChannel;
    joining: (callback: (member: unknown) => void) => EchoPresenceChannel;
    leaving: (callback: (member: unknown) => void) => EchoPresenceChannel;
    listen: (
        event: string,
        callback: (payload: unknown) => void,
    ) => EchoPresenceChannel;
    stopListening: (event?: string) => void;
}

export interface EchoLike {
    join: (channel: string) => EchoPresenceChannel;
    leave: (channel: string) => void;
    connector: {
        pusher: {
            connection: {
                bind: (event: string, callback: () => void) => void;
                unbind: (event: string, callback: () => void) => void;
            };
        };
    };
}

/** Shared auth wiring for the session-authenticated `/broadcasting/auth` route. */
interface EchoConnectorConfig {
    broadcaster: "pusher";
    key: string;
    forceTLS: boolean;
    wsHost: string;
    wsPort: number;
    wssPort: number;
    enabledTransports: ["ws", "wss"];
    cluster?: string;
    disableStats?: boolean;
    authEndpoint: string;
    auth: {
        headers: {
            "X-CSRF-TOKEN": string;
            "X-Requested-With": string;
        };
    };
}

let echoInstance: EchoLike | null = null;

function readCsrfToken(): string | null {
    return (
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") ?? null
    );
}

function authConfig(): EchoConnectorConfig["auth"] {
    return {
        headers: {
            "X-CSRF-TOKEN": readCsrfToken() ?? "",
            "X-Requested-With": "XMLHttpRequest",
        },
    };
}

/**
 * Resolve the Echo client config for the active broadcast driver
 * (`VITE_BROADCAST_CONNECTION`: `pusher` default, or `apinator`). Returns
 * null when the selected driver has no app key, which tells the room hooks to
 * fall back to polling.
 */
function getEchoConfig(): EchoConnectorConfig | null {
    const driver =
        (
            import.meta.env.VITE_BROADCAST_CONNECTION as string | undefined
        )?.trim() || "pusher";

    if (driver === "apinator") {
        const key = (
            import.meta.env.VITE_APINATOR_APP_KEY as string | undefined
        )?.trim();
        if (!key) return null;

        return {
            broadcaster: "pusher",
            key,
            wsHost:
                (import.meta.env.VITE_APINATOR_HOST as string | undefined) ||
                "api.apinator.io",
            wsPort: 443,
            wssPort: 443,
            forceTLS: true,
            disableStats: true,
            enabledTransports: ["ws", "wss"],
            authEndpoint: "/broadcasting/auth",
            auth: authConfig(),
        };
    }

    const key = (
        import.meta.env.VITE_PUSHER_APP_KEY as string | undefined
    )?.trim();
    if (!key) return null;

    const cluster =
        (import.meta.env.VITE_PUSHER_APP_CLUSTER as string | undefined) ??
        "mt1";
    const scheme =
        (import.meta.env.VITE_PUSHER_SCHEME as string | undefined) ?? "https";
    const port = Number(import.meta.env.VITE_PUSHER_PORT);

    return {
        broadcaster: "pusher",
        key,
        cluster,
        wsHost:
            (import.meta.env.VITE_PUSHER_HOST as string | undefined) ||
            `ws-${cluster}.pusher.com`,
        wsPort: port || 80,
        wssPort: port || 443,
        forceTLS: scheme === "https",
        enabledTransports: ["ws", "wss"],
        authEndpoint: "/broadcasting/auth",
        auth: authConfig(),
    };
}

/** Construct a fresh Echo instance for the given connector config. */
export function createEcho(config: EchoConnectorConfig): EchoLike {
    (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;
    return new Echo(config) as unknown as EchoLike;
}

/**
 * Lazy Echo singleton. Returns null when the active driver isn't configured
 * (no app key or under test), which tells the room hooks to fall back to
 * polling. The hosted-driver defaults are overridable via the VITE_* env vars;
 * Reverb speaks the same Pusher protocol, so no client rework is expected.
 */
export function getEcho(): EchoLike | null {
    if (echoInstance) return echoInstance;

    if (import.meta.env.MODE === "test") return null;

    const config = getEchoConfig();
    if (!config) return null;

    echoInstance = createEcho(config);
    return echoInstance;
}

/** True when the Echo client is available (i.e. push is the active transport). */
export function isPushConfigured(): boolean {
    return getEcho() !== null;
}

/** Test helper: reset the singleton so a later getEcho() re-evaluates config. */
export function resetEcho(): void {
    echoInstance?.leave("");
    echoInstance = null;
}
