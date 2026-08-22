export type PlaybackMode = "direct" | "proxy";

export interface PlaybackState {
    isPlaying: boolean;
    positionSeconds: number;
    durationSeconds: number;
    playbackRate: number;
    videoUrl: string | null;
    playbackMode: PlaybackMode;
    stateVersion: number;
    serverTimestamp: number | null;
    updatedAt: string;
    /** Client-clock epoch-seconds when this authoritative snapshot was received. */
    receivedAt: number | null;
}

export interface PlaybackStateResponse {
    is_playing: boolean;
    position_seconds: number;
    duration_seconds: number;
    playback_rate: number;
    video_url: string | null;
    playback_mode: PlaybackMode;
    state_version: number;
    server_timestamp: number | null;
    updated_at: string;
    /**
     * Present only on `playback.state.changed` broadcasts (the member who
     * performed the change); the state GET never carries it. Used to derive
     * member-visible play/pause/seek action toasts — and to distinguish a
     * broadcast snapshot from a poll snapshot, so polls can never toast.
     */
    user_id?: number;
}

export interface PlaybackSyncResponse {
    status: string;
    state_version: number;
    server_timestamp: number;
    playback_mode?: PlaybackMode;
}

export function toPlaybackState(data: PlaybackStateResponse): PlaybackState {
    return {
        isPlaying: data.is_playing,
        positionSeconds: data.position_seconds,
        durationSeconds: data.duration_seconds,
        playbackRate: data.playback_rate,
        videoUrl: data.video_url,
        playbackMode: data.playback_mode,
        stateVersion: data.state_version,
        serverTimestamp: data.server_timestamp,
        updatedAt: data.updated_at,
        receivedAt: null,
    };
}

/**
 * Expected position at `clientTimestampNow`, extrapolated from a
 * client-monotonic baseline (`receivedAt`) captured when the authoritative
 * snapshot arrived. This deliberately avoids comparing raw client
 * `Date.now()` against the server's clock, which would drift by the unknown
 * client↔server clock offset.
 */
export function computeExpectedPosition(
    state: PlaybackState,
    clientTimestampNow: number,
): number {
    if (!state.isPlaying || state.receivedAt === null) {
        return state.positionSeconds;
    }
    const elapsed = clientTimestampNow - state.receivedAt;
    return state.positionSeconds + elapsed * state.playbackRate;
}
