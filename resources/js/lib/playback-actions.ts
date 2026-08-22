import {
    computeExpectedPosition,
    type PlaybackState,
} from "@/lib/types/playback";

export type PlaybackActionType = "play" | "pause" | "seek";

/** A remote playback action, attributed to the member who performed it. */
export interface PlaybackAction {
    type: PlaybackActionType;
    actorId: number;
    /** Seek target in seconds — present on "seek" actions. */
    positionSeconds?: number;
}

/**
 * The transition between two consecutive authoritative playback snapshots,
 * classified as a member-visible action — or null when the change is just
 * natural playback continuation. Mirrors the consecutive-snapshot diff of
 * `presence-moments`: repeated identical snapshots and position-sync drift
 * never classify as actions.
 */
export interface PlaybackActionTransition {
    type: PlaybackActionType;
    positionSeconds?: number;
}

/**
 * While playing, the host's position syncs are debounced to ~3s (6s at 2x
 * rate), so natural continuation deltas stay well under this; anything
 * larger is a deliberate scrub. 8s leaves headroom over the sync cadence
 * while catching seek-button jumps.
 */
const SEEK_PLAYING_THRESHOLD = 8;

/** While paused the position never drifts, so any real change is a seek. */
const SEEK_PAUSED_THRESHOLD = 2;

/**
 * Classify the prev→next snapshot transition. `clientNow` is the client
 * clock (epoch seconds) at which the next snapshot arrived, used to
 * extrapolate where uninterrupted playback would have reached.
 */
export function derivePlaybackTransition(
    prev: PlaybackState,
    next: Pick<PlaybackState, "isPlaying" | "positionSeconds" | "videoUrl">,
    clientNow: number,
): PlaybackActionTransition | null {
    // A new/replaced video resets the timeline by design — that is a video
    // change, not a member action.
    if (next.videoUrl !== prev.videoUrl) {
        return null;
    }

    // stateVersion 0 is the pre-snapshot placeholder; there is no real
    // baseline to diff against yet.
    if (prev.stateVersion === 0) {
        return null;
    }

    if (next.isPlaying !== prev.isPlaying) {
        return {
            type: next.isPlaying ? "play" : "pause",
            positionSeconds: next.positionSeconds,
        };
    }

    if (prev.isPlaying) {
        const expected = computeExpectedPosition(prev, clientNow);
        if (
            Math.abs(next.positionSeconds - expected) > SEEK_PLAYING_THRESHOLD
        ) {
            return { type: "seek", positionSeconds: next.positionSeconds };
        }
    } else if (
        Math.abs(next.positionSeconds - prev.positionSeconds) >
        SEEK_PAUSED_THRESHOLD
    ) {
        return { type: "seek", positionSeconds: next.positionSeconds };
    }

    return null;
}

/**
 * Coalescing window for seek toasts: consecutive scrubs within this window
 * collapse into one toast carrying the final target position. The deadline
 * is anchored to the first seek in the burst (not restarted per seek) so
 * continuous scrubbing cannot postpone the toast indefinitely.
 */
export const SEEK_COALESCE_MS = 1500;
