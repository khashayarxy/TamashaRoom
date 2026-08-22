import api from "@/lib/api";
import { isPollingSuspended } from "@/lib/polling-controller";
import { getEcho, watchPushHealth, type EchoPresenceChannel } from "@/lib/echo";
import {
    derivePlaybackTransition,
    SEEK_COALESCE_MS,
    type PlaybackAction,
} from "@/lib/playback-actions";
import {
    computeExpectedPosition,
    PlaybackState,
    PlaybackStateResponse,
    PlaybackSyncResponse,
    toPlaybackState,
} from "@/lib/types/playback";
import { useCallback, useEffect, useRef, useState } from "react";

export { type PlaybackState } from "@/lib/types/playback";

const POLL_ACTIVE = 3000;
const POLL_IDLE = 10000;
// Position-only syncs are debounced to 1.5s: every PATCH does two SQLite
// writes (throttle cache increment + rooms update) plus a synchronous Pusher
// broadcast, and the throttle:playback limit is perMinute(60). 1.5s ≈ 40/min
// per host leaves headroom while halving how stale the guests' authoritative
// position can get between corrections (paired with the 1s drift threshold).
const DEBOUNCE_MS = 1500;

interface SyncOptions {
    roomId: number;
    isHost?: boolean;
    onRemoteChange?: (state: PlaybackState) => void;
    /**
     * Bump to force an authoritative GET refetch (applied when the value
     * changes). Lets the host reconcile its local state immediately after
     * setting or removing a video instead of waiting on a broadcast.
     */
    refreshKey?: number;
    /**
     * The local member's user id. Broadcast snapshots initiated by this
     * user (their own play/pause/seek in any tab) never surface as
     * onPlaybackAction — nobody gets their own actions toasted back.
     */
    currentUserId?: number;
    /**
     * Fires for remote members' play/pause/seek actions, derived from
     * broadcast snapshots only (never polls, never the local user's own
     * actions). Rapid consecutive seeks within SEEK_COALESCE_MS coalesce
     * into one action carrying the final target position.
     */
    onPlaybackAction?: (action: PlaybackAction) => void;
}

/**
 * Playback sync transport-agnostic hook.
 *
 * Push mode (default when Pusher is configured): the host's authoritative
 * writes are broadcast as `playback.state.changed` over the room's presence
 * channel and applied here. A one-shot `GET /playback/{room}/state` on mount
 * (and again on visibility-restore / socket reconnect) seeds the baseline, so
 * late joiners and reconnects never wait for the next event.
 *
 * Polling fallback (no Pusher configured, e.g. CI — or the push transport is
 * unhealthy: socket down or the presence channel failed to subscribe): the
 * same GET on the old tiered cadence — 3s while playing, 10s while idle.
 * "Configured" alone never disables polling; live connection health does.
 *
 * The write path is unchanged and identical in both modes: host-only PATCH
 * (debounced) or immediate, guarded by the server's state_version.
 */
export function usePlaybackSync({
    roomId,
    isHost = false,
    onRemoteChange,
    refreshKey,
    currentUserId,
    onPlaybackAction,
}: SyncOptions) {
    const [state, setState] = useState<PlaybackState>({
        isPlaying: false,
        positionSeconds: 0,
        durationSeconds: 0,
        playbackRate: 1,
        videoUrl: null,
        playbackMode: "proxy",
        stateVersion: 0,
        serverTimestamp: null,
        updatedAt: new Date().toISOString(),
        receivedAt: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const stateRef = useRef(state);
    const versionRef = useRef(0);
    const lastPollRef = useRef(0);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSyncRef = useRef<Partial<PlaybackState> | null>(null);
    const cancelledRef = useRef(false);
    const activeControllerRef = useRef<AbortController | null>(null);
    const requestIdRef = useRef(0);
    const documentHiddenRef = useRef(
        typeof document !== "undefined" && document.hidden,
    );
    /**
     * Live push-transport health — true only while the socket is connected
     * and the room's presence channel is subscribed. Polling runs whenever
     * this is false, so a socket that never connects (blocked, unreachable,
     * auth failure) still leaves the room functional on the polling cadence.
     */
    const pushHealthyRef = useRef(false);
    const channelRef = useRef<EchoPresenceChannel | null>(null);
    const appliedRefreshKeyRef = useRef(refreshKey);
    const stopHealthWatchRef = useRef<(() => void) | null>(null);
    const fetchStateRef = useRef<() => Promise<void>>(async () => {});
    const applySnapshotRef = useRef<(raw: PlaybackStateResponse) => void>(
        () => {},
    );
    const currentUserIdRef = useRef<number | null>(currentUserId ?? null);
    const onPlaybackActionRef = useRef<
        ((action: PlaybackAction) => void) | undefined
    >(onPlaybackAction);
    const pendingSeekRef = useRef<{
        actorId: number;
        positionSeconds: number;
        timer: ReturnType<typeof setTimeout>;
    } | null>(null);

    useEffect(() => {
        currentUserIdRef.current = currentUserId ?? null;
    }, [currentUserId]);

    useEffect(() => {
        onPlaybackActionRef.current = onPlaybackAction;
    }, [onPlaybackAction]);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    /**
     * Emit (or coalesce) a member-visible playback action. Seeks within
     * SEEK_COALESCE_MS of the first seek of a burst collapse into one action
     * carrying the final position; the deadline never restarts, so
     * continuous scrubbing cannot postpone the toast indefinitely.
     * Play/pause flush any pending seek first so ordering is preserved.
     */
    const dispatchPlaybackAction = useCallback((action: PlaybackAction) => {
        if (action.type === "seek") {
            if (pendingSeekRef.current) {
                pendingSeekRef.current.positionSeconds =
                    action.positionSeconds ?? 0;
                return;
            }
            const timer = setTimeout(() => {
                const pending = pendingSeekRef.current;
                pendingSeekRef.current = null;
                if (pending && !cancelledRef.current) {
                    onPlaybackActionRef.current?.({
                        type: "seek",
                        actorId: pending.actorId,
                        positionSeconds: pending.positionSeconds,
                    });
                }
            }, SEEK_COALESCE_MS);
            pendingSeekRef.current = {
                actorId: action.actorId,
                positionSeconds: action.positionSeconds ?? 0,
                timer,
            };
            return;
        }
        if (pendingSeekRef.current) {
            clearTimeout(pendingSeekRef.current.timer);
            const pending = pendingSeekRef.current;
            pendingSeekRef.current = null;
            if (!cancelledRef.current) {
                onPlaybackActionRef.current?.({
                    type: "seek",
                    actorId: pending.actorId,
                    positionSeconds: pending.positionSeconds,
                });
            }
        }
        onPlaybackActionRef.current?.(action);
    }, []);

    /**
     * Single path for authoritative snapshots — from the state GET and from
     * push events alike. Applies the version guard, seeds the client-clock
     * drift baseline, extrapolates, and surfaces the corrected state.
     */
    const applySnapshot = useCallback(
        (raw: PlaybackStateResponse) => {
            if (cancelledRef.current) return;

            const incoming = toPlaybackState(raw);

            if (incoming.stateVersion <= versionRef.current) {
                return;
            }

            versionRef.current = incoming.stateVersion;
            lastPollRef.current = Date.now() / 1000;

            const received = {
                ...incoming,
                receivedAt: lastPollRef.current,
            };
            const expected = computeExpectedPosition(
                received,
                lastPollRef.current,
            );
            const corrected = { ...received, positionSeconds: expected };

            // Member-visible action toasts: broadcast snapshots only —
            // `user_id` rides broadcasts and never the state GET, so polls
            // can never toast — and never the local user's own actions.
            const actorId = raw.user_id;
            if (actorId !== undefined && actorId !== currentUserIdRef.current) {
                const transition = derivePlaybackTransition(
                    stateRef.current,
                    corrected,
                    lastPollRef.current,
                );
                if (transition) {
                    dispatchPlaybackAction({ ...transition, actorId });
                }
            }

            stateRef.current = corrected;
            setState(corrected);
            onRemoteChange?.(corrected);
            setError(null);
        },
        [onRemoteChange, dispatchPlaybackAction],
    );

    const schedulePoll = useCallback(() => {
        if (cancelledRef.current || documentHiddenRef.current) {
            return;
        }

        if (pollTimerRef.current) {
            clearTimeout(pollTimerRef.current);
        }
        const interval = stateRef.current.isPlaying ? POLL_ACTIVE : POLL_IDLE;
        pollTimerRef.current = setTimeout(() => {
            void fetchStateRef.current();
        }, interval);
    }, []);

    const fetchState = useCallback(async () => {
        if (
            cancelledRef.current ||
            documentHiddenRef.current ||
            isPollingSuspended()
        ) {
            return;
        }

        activeControllerRef.current?.abort();
        const controller = new AbortController();
        activeControllerRef.current = controller;
        const requestId = ++requestIdRef.current;

        try {
            const { data } = await api.get<PlaybackStateResponse>(
                `/playback/${roomId}/state`,
                { signal: controller.signal },
            );

            if (cancelledRef.current || requestId !== requestIdRef.current) {
                return;
            }

            applySnapshot(data);
        } catch {
            if (cancelledRef.current || requestId !== requestIdRef.current) {
                return;
            }
            setError("Failed to sync playback");
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;
            }
            if (cancelledRef.current || requestId !== requestIdRef.current) {
                return;
            }
            setLoading(false);
            if (!pushHealthyRef.current) {
                schedulePoll();
            }
        }
    }, [roomId, applySnapshot, schedulePoll]);

    useEffect(() => {
        fetchStateRef.current = fetchState;
    }, [fetchState]);

    useEffect(() => {
        applySnapshotRef.current = applySnapshot;
    }, [applySnapshot]);

    useEffect(() => {
        if (refreshKey === undefined) return;
        if (refreshKey === appliedRefreshKeyRef.current) return;
        appliedRefreshKeyRef.current = refreshKey;
        if (!cancelledRef.current) {
            void fetchStateRef.current();
        }
    }, [refreshKey]);

    useEffect(() => {
        cancelledRef.current = false;
        const echo = getEcho();
        pushHealthyRef.current = false;

        if (echo) {
            // Echo's join() already prepends the presence- prefix, so pass the
            // base channel name to subscribe to presence-room.{id} on the wire.
            const channel = echo.join(`room.${roomId}`);
            channelRef.current = channel;

            channel.listen(".playback.state.changed", (payload) => {
                if (cancelledRef.current) return;
                applySnapshotRef.current(payload as PlaybackStateResponse);
            });

            // Push health drives the transport: while healthy, broadcasts
            // deliver state and polling stops; on any drop (connecting,
            // disconnected, subscription/auth failure) the tiered polling
            // fallback resumes, and a healthy transition re-seeds from the
            // authoritative GET.
            stopHealthWatchRef.current = watchPushHealth(
                echo,
                `room.${roomId}`,
                (healthy) => {
                    if (cancelledRef.current) return;
                    pushHealthyRef.current = healthy;
                    if (healthy) {
                        if (pollTimerRef.current) {
                            clearTimeout(pollTimerRef.current);
                            pollTimerRef.current = null;
                        }
                        void fetchStateRef.current();
                    } else {
                        schedulePoll();
                    }
                },
            );
        }

        void fetchStateRef.current();

        const handleVisibility = () => {
            documentHiddenRef.current = document.hidden;
            if (document.visibilityState === "visible") {
                void fetchStateRef.current();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            cancelledRef.current = true;
            activeControllerRef.current?.abort();
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            if (debounceTimerRef.current)
                clearTimeout(debounceTimerRef.current);
            if (pendingSeekRef.current) {
                clearTimeout(pendingSeekRef.current.timer);
                pendingSeekRef.current = null;
            }
            pendingSyncRef.current = null;
            document.removeEventListener("visibilitychange", handleVisibility);
            stopHealthWatchRef.current?.();
            stopHealthWatchRef.current = null;
            channelRef.current?.stopListening(".playback.state.changed");
            echo?.leave(`room.${roomId}`);
            channelRef.current = null;
        };
    }, [roomId, schedulePoll]);

    const sync = useCallback(
        async (partial: Partial<PlaybackState>) => {
            if (!isHost || cancelledRef.current) return;

            const prev = stateRef.current;
            const payload = {
                is_playing: partial.isPlaying ?? prev.isPlaying,
                position_seconds:
                    partial.positionSeconds ?? prev.positionSeconds,
                duration_seconds:
                    partial.durationSeconds ?? prev.durationSeconds,
                playback_rate: partial.playbackRate ?? prev.playbackRate,
                client_timestamp: Date.now() / 1000,
                // Position syncs must never carry a video_url: the host's local
                // copy can be stale (a video was just set or removed), and the
                // server treats a PATCHed URL as an authoritative change that
                // would revert the room's current video. Only an explicit
                // video change from the caller sends video_url.
                ...(partial.videoUrl !== undefined
                    ? { video_url: partial.videoUrl }
                    : {}),
            } as const;

            try {
                const { data } = await api.patch<PlaybackSyncResponse>(
                    `/playback/${roomId}`,
                    payload,
                );
                if (cancelledRef.current) return;
                if (data.status === "ok") {
                    // Guard against out-of-order/late PATCH responses: only
                    // apply the response if it reflects a newer server state,
                    // otherwise it would regress the version and freeze
                    // subsequent valid snapshots.
                    if (data.state_version > versionRef.current) {
                        versionRef.current = data.state_version;
                        lastPollRef.current = Date.now() / 1000;
                        setState((s) => ({
                            ...s,
                            ...partial,
                            stateVersion: data.state_version,
                            serverTimestamp: data.server_timestamp,
                            receivedAt: lastPollRef.current,
                            ...(data.playback_mode
                                ? { playbackMode: data.playback_mode }
                                : {}),
                        }));
                    }
                }
                setError(null);
            } catch {
                if (cancelledRef.current) return;
                setError("Failed to sync playback");
            }
        },
        [roomId, isHost],
    );

    const debouncedSync = useCallback(
        (partial: Partial<PlaybackState>) => {
            if (cancelledRef.current) return;

            // Coalesce: keep only the latest pending sync and do NOT re-arm the
            // timer on every call. Re-arming on each ~1s timeupdate would
            // perpetually reset DEBOUNCE_MS and starve the PATCH — the host's
            // position would never reach the server during continuous playback.
            pendingSyncRef.current = partial;
            if (debounceTimerRef.current) return;

            debounceTimerRef.current = setTimeout(() => {
                debounceTimerRef.current = null;
                const latest = pendingSyncRef.current;
                pendingSyncRef.current = null;
                if (latest) {
                    void sync(latest);
                }
            }, DEBOUNCE_MS);
        },
        [sync],
    );

    const syncImmediate = useCallback(
        (partial: Partial<PlaybackState>) => {
            if (cancelledRef.current) return;

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            pendingSyncRef.current = null;
            void sync(partial).then(() => {
                if (!cancelledRef.current) {
                    void fetchState();
                }
            });
        },
        [sync, fetchState],
    );

    return {
        state,
        loading,
        error,
        sync: debouncedSync,
        syncImmediate,
    };
}
