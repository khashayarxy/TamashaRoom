import api from "@/lib/api";
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
const DEBOUNCE_MS = 1000;

interface SyncOptions {
    roomId: number;
    isHost?: boolean;
    onRemoteChange?: (state: PlaybackState) => void;
}

export function usePlaybackSync({
    roomId,
    isHost = false,
    onRemoteChange,
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
    const cancelledRef = useRef(false);
    const activeControllerRef = useRef<AbortController | null>(null);
    const requestIdRef = useRef(0);
    const documentHiddenRef = useRef(
        typeof document !== "undefined" && document.hidden,
    );

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const fetchStateRef = useRef<() => Promise<void>>(async () => {});

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
        if (cancelledRef.current || documentHiddenRef.current) {
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

            const incoming = toPlaybackState(data);

            if (incoming.stateVersion <= versionRef.current) {
                return;
            }

            versionRef.current = incoming.stateVersion;
            lastPollRef.current = Date.now() / 1000;

            // Baseline for drift extrapolation: the client-clock instant this
            // authoritative snapshot was received. Extrapolation then uses
            // purely client-monotonic time, avoiding the client↔server clock
            // offset entirely.
            const received = {
                ...incoming,
                receivedAt: lastPollRef.current,
            };

            const expected = computeExpectedPosition(
                received,
                lastPollRef.current,
            );
            const corrected = { ...received, positionSeconds: expected };

            stateRef.current = corrected;
            setState(corrected);
            onRemoteChange?.(corrected);
            setError(null);
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
            schedulePoll();
        }
    }, [roomId, onRemoteChange, schedulePoll]);

    useEffect(() => {
        fetchStateRef.current = fetchState;
    }, [fetchState]);

    useEffect(() => {
        cancelledRef.current = false;
        void fetchState();
        return () => {
            cancelledRef.current = true;
            activeControllerRef.current?.abort();
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            if (debounceTimerRef.current)
                clearTimeout(debounceTimerRef.current);
        };
    }, [fetchState]);

    useEffect(() => {
        const handleVisibility = () => {
            documentHiddenRef.current = document.hidden;
            if (document.visibilityState === "visible") {
                void fetchStateRef.current();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () =>
            document.removeEventListener("visibilitychange", handleVisibility);
    }, []);

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
                video_url:
                    partial.videoUrl !== undefined
                        ? partial.videoUrl
                        : prev.videoUrl,
                client_timestamp: Date.now() / 1000,
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
                    // subsequent valid polls.
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
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
                sync(partial);
            }, DEBOUNCE_MS);
        },
        [sync],
    );

    const syncImmediate = useCallback(
        (partial: Partial<PlaybackState>) => {
            if (cancelledRef.current) return;

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
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
