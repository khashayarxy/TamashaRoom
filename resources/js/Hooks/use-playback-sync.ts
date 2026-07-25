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
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const stateRef = useRef(state);
    const versionRef = useRef(0);
    const lastPollRef = useRef(0);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const fetchState = useCallback(async () => {
        try {
            const { data } = await api.get<PlaybackStateResponse>(
                `/playback/${roomId}/state`,
            );
            const incoming = toPlaybackState(data);

            if (incoming.stateVersion <= versionRef.current) {
                return;
            }

            versionRef.current = incoming.stateVersion;
            lastPollRef.current = Date.now() / 1000;

            const expected = computeExpectedPosition(
                incoming,
                lastPollRef.current,
            );
            const corrected = { ...incoming, positionSeconds: expected };

            setState(corrected);
            onRemoteChange?.(corrected);
            setError(null);
        } catch {
            setError("Failed to sync playback");
        } finally {
            setLoading(false);
        }
    }, [roomId, onRemoteChange]);

    const sync = useCallback(
        async (partial: Partial<PlaybackState>) => {
            if (!isHost) return;

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
                if (data.status === "ok") {
                    versionRef.current = data.state_version;
                    lastPollRef.current = Date.now() / 1000;
                    setState((s) => ({
                        ...s,
                        ...partial,
                        stateVersion: data.state_version,
                        serverTimestamp: data.server_timestamp,
                    }));
                }
                setError(null);
            } catch {
                setError("Failed to sync playback");
            }
        },
        [roomId, isHost],
    );

    const schedulePoll = useCallback(() => {
        if (pollTimerRef.current) {
            clearTimeout(pollTimerRef.current);
        }
        const interval = stateRef.current.isPlaying ? POLL_ACTIVE : POLL_IDLE;
        pollTimerRef.current = setTimeout(fetchState, interval);
    }, [fetchState]);

    useEffect(() => {
        fetchState();
        schedulePoll();
        return () => {
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, [fetchState, schedulePoll]);

    const debouncedSync = useCallback(
        (partial: Partial<PlaybackState>) => {
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
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            sync(partial).then(() => fetchState());
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
