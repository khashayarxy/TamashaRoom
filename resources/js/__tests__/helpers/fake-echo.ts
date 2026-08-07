import type { EchoLike, EchoPresenceChannel } from "@/lib/echo";

export interface FakeEcho extends EchoLike {
    /** Emit a custom event (e.g. `.playback.state.changed`) to bound listeners. */
    emit: (event: string, payload: unknown) => void;
    fireHere: (members: unknown[]) => void;
    fireJoining: (member: unknown) => void;
    fireLeaving: (member: unknown) => void;
    fireConnected: () => void;
    joinedChannels: string[];
    leftChannels: string[];
    listening: (event: string) => boolean;
}

/**
 * Deterministic in-memory stand-in for the Echo presence channel, so hook tests
 * can simulate push events without a socket.
 */
export function createFakeEcho(): FakeEcho {
    let hereCb: ((members: unknown[]) => void) | null = null;
    let joiningCb: ((member: unknown) => void) | null = null;
    let leavingCb: ((member: unknown) => void) | null = null;
    let connectedCb: (() => void) | null = null;
    const eventCbs = new Map<string, (payload: unknown) => void>();
    const joinedChannels: string[] = [];
    const leftChannels: string[] = [];

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
                connection: {
                    bind: (event, cb) => {
                        if (event === "connected") connectedCb = cb;
                    },
                    unbind: () => {},
                },
            },
        },
        emit: (event, payload) => eventCbs.get(event)?.(payload),
        fireHere: (members) => hereCb?.(members),
        fireJoining: (member) => joiningCb?.(member),
        fireLeaving: (member) => leavingCb?.(member),
        fireConnected: () => connectedCb?.(),
        joinedChannels,
        leftChannels,
        listening: (event) => eventCbs.has(event),
    };
}
