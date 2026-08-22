import type { EchoLike, EchoPresenceChannel, EchoRawChannel } from "@/lib/echo";

export interface FakeEcho extends EchoLike {
    /** Emit a custom event (e.g. `.playback.state.changed`) to bound listeners. */
    emit: (event: string, payload: unknown) => void;
    fireHere: (members: unknown[]) => void;
    fireJoining: (member: unknown) => void;
    fireLeaving: (member: unknown) => void;
    /**
     * Socket connects and the presence channel subscribes (mirrors pusher-js
     * auto-subscribing channels once the connection is up).
     */
    fireConnected: () => void;
    /** Socket drops — the channel is no longer subscribed either. */
    fireDisconnected: () => void;
    /** Channel auth fails while the connection itself stays up. */
    fireSubscriptionError: () => void;
    joinedChannels: string[];
    leftChannels: string[];
    listening: (event: string) => boolean;
}

/**
 * Deterministic in-memory stand-in for the Echo presence channel, so hook tests
 * can simulate push events without a socket. Models the connection-state and
 * channel-subscription surfaces `watchPushHealth` observes on a real client.
 */
export function createFakeEcho(): FakeEcho {
    let hereCb: ((members: unknown[]) => void) | null = null;
    let joiningCb: ((member: unknown) => void) | null = null;
    let leavingCb: ((member: unknown) => void) | null = null;
    const eventCbs = new Map<string, (payload: unknown) => void>();
    const connectionCbs = new Map<string, Set<(payload?: unknown) => void>>();
    const channelCbs = new Map<string, Set<(payload?: unknown) => void>>();
    const joinedChannels: string[] = [];
    const leftChannels: string[] = [];
    let connectionState = "initialized";
    let channelSubscribed = false;

    const bindConnection = (event: string, cb: (payload?: unknown) => void) => {
        if (!connectionCbs.has(event)) connectionCbs.set(event, new Set());
        connectionCbs.get(event)!.add(cb);
    };
    const unbindConnection = (
        event: string,
        cb: (payload?: unknown) => void,
    ) => {
        connectionCbs.get(event)?.delete(cb);
    };
    const fireConnection = (event: string, payload?: unknown) => {
        connectionCbs.get(event)?.forEach((cb) => cb(payload));
    };
    const fireChannel = (event: string, payload?: unknown) => {
        channelCbs.get(event)?.forEach((cb) => cb(payload));
    };

    const rawChannel: EchoRawChannel = {
        bind: (event, cb) => {
            if (!channelCbs.has(event)) channelCbs.set(event, new Set());
            channelCbs.get(event)!.add(cb);
        },
        unbind: (event, cb) => {
            channelCbs.get(event)?.delete(cb);
        },
        get subscribed() {
            return channelSubscribed;
        },
    };

    const channel: EchoPresenceChannel = {
        here: (cb) => {
            hereCb = cb;
            return channel;
        },
        joining: (cb) => {
            joiningCb = cb;
            return channel;
        },
        leaving: (cb) => {
            leavingCb = cb;
            return channel;
        },
        listen: (event, cb) => {
            eventCbs.set(event, cb);
            return channel;
        },
        stopListening: (event) => {
            if (event) eventCbs.delete(event);
            else eventCbs.clear();
        },
    };

    return {
        join: (name) => {
            joinedChannels.push(name);
            return channel;
        },
        leave: (name) => {
            leftChannels.push(name);
        },
        connector: {
            pusher: {
                channel: () => rawChannel,
                connection: {
                    get state() {
                        return connectionState;
                    },
                    bind: bindConnection,
                    unbind: unbindConnection,
                },
            },
        },
        emit: (event, payload) => eventCbs.get(event)?.(payload),
        fireHere: (members) => hereCb?.(members),
        fireJoining: (member) => joiningCb?.(member),
        fireLeaving: (member) => leavingCb?.(member),
        fireConnected: () => {
            const previous = connectionState;
            connectionState = "connected";
            channelSubscribed = true;
            fireConnection("connected");
            fireConnection("state_changed", {
                previous,
                current: "connected",
            });
            fireChannel("pusher:subscription_succeeded");
        },
        fireDisconnected: () => {
            const previous = connectionState;
            connectionState = "disconnected";
            channelSubscribed = false;
            fireConnection("state_changed", {
                previous,
                current: "disconnected",
            });
        },
        fireSubscriptionError: () => {
            channelSubscribed = false;
            fireChannel("pusher:subscription_error");
        },
        joinedChannels,
        leftChannels,
        listening: (event) => eventCbs.has(event),
    };
}
