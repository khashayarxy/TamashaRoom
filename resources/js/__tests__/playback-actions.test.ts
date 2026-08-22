import { describe, it, expect } from "vitest";
import { derivePlaybackTransition } from "@/lib/playback-actions";
import type { PlaybackState } from "@/lib/types/playback";

function state(overrides: Partial<PlaybackState> = {}): PlaybackState {
    return {
        isPlaying: false,
        positionSeconds: 0,
        durationSeconds: 600,
        playbackRate: 1,
        videoUrl: "https://example.com/v.mp4",
        playbackMode: "direct",
        stateVersion: 1,
        serverTimestamp: null,
        updatedAt: new Date().toISOString(),
        receivedAt: null,
        ...overrides,
    };
}

describe("derivePlaybackTransition", () => {
    it("classifies paused -> playing as play", () => {
        const prev = state({ isPlaying: false, positionSeconds: 120 });
        const next = {
            isPlaying: true,
            positionSeconds: 120,
            videoUrl: prev.videoUrl,
        };

        expect(derivePlaybackTransition(prev, next, 2000)).toEqual({
            type: "play",
            positionSeconds: 120,
        });
    });

    it("classifies playing -> paused as pause", () => {
        const prev = state({
            isPlaying: true,
            positionSeconds: 120,
            receivedAt: 1000,
        });
        const next = {
            isPlaying: false,
            positionSeconds: 125,
            videoUrl: prev.videoUrl,
        };

        expect(derivePlaybackTransition(prev, next, 1002)).toEqual({
            type: "pause",
            positionSeconds: 125,
        });
    });

    it("classifies a position jump while paused as seek", () => {
        const prev = state({ isPlaying: false, positionSeconds: 100 });
        const next = {
            isPlaying: false,
            positionSeconds: 200,
            videoUrl: prev.videoUrl,
        };

        expect(derivePlaybackTransition(prev, next, 2000)).toEqual({
            type: "seek",
            positionSeconds: 200,
        });
    });

    it("ignores a tiny position change while paused (below threshold)", () => {
        const prev = state({ isPlaying: false, positionSeconds: 100 });
        const next = {
            isPlaying: false,
            positionSeconds: 101,
            videoUrl: prev.videoUrl,
        };

        expect(derivePlaybackTransition(prev, next, 2000)).toBeNull();
    });

    it("classifies a discontinuous jump while playing as seek", () => {
        const prev = state({
            isPlaying: true,
            positionSeconds: 100,
            playbackRate: 1,
            receivedAt: 1000,
        });
        const next = {
            isPlaying: true,
            positionSeconds: 300,
            videoUrl: prev.videoUrl,
        };

        expect(derivePlaybackTransition(prev, next, 1001)).toEqual({
            type: "seek",
            positionSeconds: 300,
        });
    });

    it("ignores natural continuation at 1x rate (debounced position syncs)", () => {
        const prev = state({
            isPlaying: true,
            positionSeconds: 100,
            playbackRate: 1,
            receivedAt: 1000,
        });
        // 3s of uninterrupted playback: next position ~103.
        const next = {
            isPlaying: true,
            positionSeconds: 104,
            videoUrl: prev.videoUrl,
        };

        expect(derivePlaybackTransition(prev, next, 1003)).toBeNull();
    });

    it("ignores natural continuation at 2x rate", () => {
        const prev = state({
            isPlaying: true,
            positionSeconds: 100,
            playbackRate: 2,
            receivedAt: 1000,
        });
        // 3s at 2x: next position ~106.
        const next = {
            isPlaying: true,
            positionSeconds: 106,
            videoUrl: prev.videoUrl,
        };

        expect(derivePlaybackTransition(prev, next, 1003)).toBeNull();
    });

    it("ignores a paused snapshot with no position change (poll repeat)", () => {
        const prev = state({ isPlaying: false, positionSeconds: 100 });
        const next = {
            isPlaying: false,
            positionSeconds: 100,
            videoUrl: prev.videoUrl,
        };

        expect(derivePlaybackTransition(prev, next, 2000)).toBeNull();
    });

    it("never classifies a video change as an action", () => {
        const prev = state({
            isPlaying: true,
            positionSeconds: 100,
            receivedAt: 1000,
        });
        const next = {
            isPlaying: false,
            positionSeconds: 0,
            videoUrl: "https://example.com/other.mp4",
        };

        expect(derivePlaybackTransition(prev, next, 1001)).toBeNull();
    });

    it("never classifies against the pre-snapshot placeholder baseline", () => {
        const prev = state({ stateVersion: 0 });
        const next = {
            isPlaying: true,
            positionSeconds: 0,
            videoUrl: prev.videoUrl,
        };

        expect(derivePlaybackTransition(prev, next, 1000)).toBeNull();
    });
});
