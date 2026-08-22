import api from "@/lib/api";
import { isPollingSuspended } from "@/lib/polling-controller";
import { getEcho, watchPushHealth, type EchoPresenceChannel } from "@/lib/echo";
import {
    buildPresenceBaseline,
    derivePresenceMoments,
    type PresenceBaseline,
    type PresenceMoment,
} from "@/lib/presence-moments";
import { usePage } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PresenceMember {
    id: number;
    user_id: number;
    name: string;
    presence_status: "online" | "offline" | "away";
    last_seen_at: string;
    disconnected_at: string | null;
    joined_at: string;
    is_owner: boolean;
}

const HEARTBEAT_INTERVAL = 30000;
const POLL_INTERVAL = 5000;
const MAX_RETRY_DELAY = 300000;

interface UsePresenceOptions {
    /** Called when the room is no longer accessible (e.g. the member was removed). */
    onRemoved?: () => void;
}

/**
 * Presence transport-agnostic hook.
 *
 * Push mode (default when Pusher is configured): the member roster rides the
 * room's presence channel plus the server's `member.presence.changed`
 * broadcasts (status changes, kick, transfer, timeout). Every roster change
 * flows through `applySnapshot`, which diffs against the baseline — so moments
 * are never double-emitted regardless of which source delivers the same
 * roster. The socket-level `here`/`joining` signals only seed the member list
 * optimistically: they fire for reconnecting sockets too, so join/leave
 * moments derive exclusively from the authoritative server roster.
 *
 * The heartbeat POST (every 30s, exponential backoff) is unchanged in both
 * modes: it owns `connected`, keeps `presence_status` fresh on the server, and
 * its 403/404 is the fallback removal signal when push is unavailable.
 *
 * Polling fallback (no Pusher configured, e.g. CI — or the push transport is
 * unhealthy: socket down or the presence channel failed to subscribe): the
 * same GET every 5s. "Configured" alone never disables polling; live
 * connection health does.
 */
export function usePresence(
    roomId: number | null,
    options: UsePresenceOptions = {},
) {
    const { onRemoved } = options;
    const onRemovedRef = useRef(onRemoved);
    const removedRef = useRef(false);

    useEffect(() => {
        onRemovedRef.current = onRemoved;
    }, [onRemoved]);

    const [members, setMembers] = useState<PresenceMember[]>([]);
    const [connected, setConnected] = useState(false);
    const [moments, setMoments] = useState<PresenceMoment[]>([]);
    const membersRef = useRef<PresenceMember[]>([]);
    const baselineRef = useRef<PresenceBaseline | null>(null);
    const momentIdRef = useRef(0);
    const versionRef = useRef(0);
    const retryRef = useRef(HEARTBEAT_INTERVAL);
    const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const generationRef = useRef(0);
    const roomIdRef = useRef(roomId);
    const documentHiddenRef = useRef(
        typeof document !== "undefined" && document.hidden,
    );
    const cancelledRef = useRef(false);
    const currentUserIdRef = useRef<number | null>(null);
    const channelRef = useRef<EchoPresenceChannel | null>(null);
    /** Live push-transport health — gates the roster polling fallback. */
    const pushHealthyRef = useRef(false);
    const fetchPresenceRef = useRef<() => Promise<void>>(async () => {});
    const applySnapshotRef = useRef<(list: PresenceMember[]) => void>(() => {});
    const seedRosterRef = useRef<(list: PresenceMember[]) => void>(() => {});

    useEffect(() => {
        baselineRef.current = null;
        setMoments([]);
        removedRef.current = false;
    }, [roomId]);

    useEffect(() => {
        roomIdRef.current = roomId;
    }, [roomId]);

    // Current user id for the kicked-self detection. Guarded so the hook still
    // works outside the Inertia page context (component tests).
    let currentUserId: number | null = null;
    try {
        const page = usePage();
        currentUserId =
            (page.props as { auth?: { user?: { id?: number } } }).auth?.user
                ?.id ?? null;
    } catch {
        currentUserId = null;
    }
    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    /**
     * Single path for authoritative roster snapshots — the initial GET,
     * `.member.presence.changed` broadcasts. Diffs against the baseline (so
     * repeated/duplicate deliveries emit no moments) and detects when the
     * current user is no longer a member (kicked/removed) to fire onRemoved.
     */
    const applySnapshot = useCallback((list: PresenceMember[]) => {
        if (cancelledRef.current || removedRef.current) return;

        const derived = derivePresenceMoments(
            baselineRef.current,
            list,
            Date.now(),
        );
        if (derived.length > 0) {
            setMoments((prev) => [
                ...prev,
                ...derived.map((moment) => ({
                    ...moment,
                    id: `moment-${++momentIdRef.current}`,
                })),
            ]);
        }

        baselineRef.current = buildPresenceBaseline(list);
        membersRef.current = list;
        setMembers(list);
    }, []);

    /**
     * Optimistically merge a socket-level roster seed (`here`/`joining`) into
     * the member list without touching the moment baseline — reconnecting
     * sockets fire these for users who never left, so only the authoritative
     * server roster may derive join/leave moments.
     */
    const seedRoster = useCallback((list: PresenceMember[]) => {
        if (cancelledRef.current || removedRef.current) return;

        const merged = new Map(membersRef.current.map((m) => [m.user_id, m]));
        for (const member of list) {
            merged.set(member.user_id, member);
        }
        const next = Array.from(merged.values());
        membersRef.current = next;
        setMembers(next);
    }, []);

    const scheduleHeartbeat = useCallback((delay: number) => {
        const gen = ++generationRef.current;

        clearTimeout(heartbeatTimerRef.current!);
        heartbeatTimerRef.current = setTimeout(tick, delay);

        async function tick() {
            if (generationRef.current !== gen) return;

            if (documentHiddenRef.current || isPollingSuspended()) {
                heartbeatTimerRef.current = setTimeout(tick, retryRef.current);
                return;
            }

            const rid = roomIdRef.current;
            if (!rid) return;
            try {
                const { data } = await api.post(`/presence/${rid}/heartbeat`);
                if (data.heartbeat_version > versionRef.current) {
                    versionRef.current = data.heartbeat_version;
                }
                retryRef.current = HEARTBEAT_INTERVAL;
                setConnected(true);
            } catch (error) {
                if (isRemovalError(error) && !removedRef.current) {
                    removedRef.current = true;
                    setConnected(false);
                    onRemovedRef.current?.();
                    return;
                }
                retryRef.current = Math.min(
                    retryRef.current * 2,
                    MAX_RETRY_DELAY,
                );
                setConnected(false);
            }

            if (generationRef.current === gen) {
                heartbeatTimerRef.current = setTimeout(tick, retryRef.current);
            }
        }
    }, []);

    const fetchPresence = useCallback(async () => {
        if (!roomId || documentHiddenRef.current || isPollingSuspended())
            return;
        try {
            const { data } = await api.get<PresenceMember[]>(
                `/presence/${roomId}`,
            );

            applySnapshot(data);
        } catch (error) {
            // A 403/404 means the room is no longer accessible to this user —
            // typically they were removed/kicked. Surface that distinctly from
            // a transient network failure so the page can redirect away.
            if (isRemovalError(error) && !removedRef.current) {
                removedRef.current = true;
                setConnected(false);
                onRemovedRef.current?.();
                return;
            }
            // The presence poll only updates member data; `connected` is owned
            // by the heartbeat (single source of truth).
        }
    }, [roomId, applySnapshot]);

    useEffect(() => {
        fetchPresenceRef.current = fetchPresence;
    }, [fetchPresence]);

    useEffect(() => {
        applySnapshotRef.current = applySnapshot;
    }, [applySnapshot]);

    useEffect(() => {
        seedRosterRef.current = seedRoster;
    }, [seedRoster]);

    useEffect(() => {
        if (!roomId) return;

        cancelledRef.current = false;
        const echo = getEcho();
        pushHealthyRef.current = false;

        scheduleHeartbeat(0);
        void fetchPresenceRef.current();

        let stopHealthWatch: (() => void) | null = null;

        if (echo) {
            // Echo's join() already prepends the presence- prefix, so pass the
            // base channel name to subscribe to presence-room.{id} on the wire.
            const channel = echo.join(`room.${roomId}`);
            channelRef.current = channel;

            // Socket-level seeds only (`leaving` is deliberately ignored: it
            // fires for any dropped connection, including brief network
            // blips, and must not read as the user leaving the room).
            channel.here((echoMembers) => {
                if (cancelledRef.current) return;
                seedRosterRef.current(echoMembers as PresenceMember[]);
            });

            channel.joining((member) => {
                if (cancelledRef.current) return;
                const info = member as PresenceMember;
                const current = membersRef.current;
                if (!current.some((m) => m.user_id === info.user_id)) {
                    seedRosterRef.current([...current, info]);
                }
            });

            channel.listen(".member.presence.changed", (payload) => {
                if (cancelledRef.current) return;
                const data = payload as { members?: PresenceMember[] };
                if (Array.isArray(data.members)) {
                    applySnapshotRef.current(data.members);
                }
            });

            // A healthy transition re-seeds the roster from the server;
            // while unhealthy, the polling interval below keeps the roster
            // and moments flowing on the fallback cadence.
            stopHealthWatch = watchPushHealth(
                echo,
                `room.${roomId}`,
                (healthy) => {
                    if (cancelledRef.current) return;
                    pushHealthyRef.current = healthy;
                    if (healthy) {
                        void fetchPresenceRef.current();
                    }
                },
            );
        }

        // Roster poll fallback: always ticking, skipped while push is healthy.
        pollTimerRef.current = setInterval(() => {
            if (pushHealthyRef.current) return;
            void fetchPresenceRef.current();
        }, POLL_INTERVAL);

        const handleVisibility = () => {
            documentHiddenRef.current = document.hidden;
            if (document.visibilityState === "visible") {
                void fetchPresenceRef.current();
                scheduleHeartbeat(0);
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            cancelledRef.current = true;
            invalidateGeneration(generationRef);
            if (heartbeatTimerRef.current)
                clearTimeout(heartbeatTimerRef.current);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            document.removeEventListener("visibilitychange", handleVisibility);
            stopHealthWatch?.();
            channelRef.current?.stopListening(".member.presence.changed");
            echo?.leave(`room.${roomId}`);
            channelRef.current = null;
        };
    }, [roomId, scheduleHeartbeat]);

    useEffect(() => {
        if (!roomId) return;

        const handleBeforeUnload = () => {
            sendLeaveBeacon(roomId);
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            // SPA navigation (Inertia) unmounts the room page without firing
            // beforeunload, so also send the leave beacon here so the member
            // is marked offline promptly instead of waiting for the timeout.
            sendLeaveBeacon(roomId);
        };
    }, [roomId]);

    return {
        members,
        connected,
        moments,
        sendHeartbeat: () => {
            scheduleHeartbeat(0);
        },
    };
}

function invalidateGeneration(generation: { current: number }): void {
    generation.current += 1;
}

function isRemovalError(error: unknown): boolean {
    if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { status?: unknown } }).response
            ?.status === "number"
    ) {
        const status = (error as { response: { status: number } }).response
            .status;
        return status === 403 || status === 404;
    }
    return false;
}

function sendLeaveBeacon(roomId: number): void {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        // sendBeacon cannot set custom headers, so carry the CSRF token in the
        // body (multipart FormData) so the web-group /leave route doesn't 419.
        const formData = new FormData();
        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");
        if (csrfToken) {
            formData.append("_token", csrfToken);
        }
        navigator.sendBeacon(`/presence/${roomId}/leave`, formData);
    }
}
