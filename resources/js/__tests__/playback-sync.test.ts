import { describe, it, expect } from "vitest";
import {
    computeExpectedPosition,
    toPlaybackState,
    type PlaybackState,
    type PlaybackStateResponse,
} from "@/lib/types/playback";

function makeState(overrides: Partial<PlaybackState> = {}): PlaybackState {
    return {
        isPlaying: false,
        positionSeconds: 100,
        durationSeconds: 300,
        playbackRate: 1,
        videoUrl: "https://example.com/video.mp4",
        playbackMode: "direct",
        stateVersion: 5,
        serverTimestamp: 1000,
        updatedAt: new Date().toISOString(),
        receivedAt: 1000,
        ...overrides,
    };
}

describe("toPlaybackState", () => {
    it("maps snake_case response to camelCase state", () => {
        const response: PlaybackStateResponse = {
            is_playing: true,
            position_seconds: 50,
            duration_seconds: 200,
            playback_rate: 1.5,
            video_url: "https://example.com/v.mp4",
            playback_mode: "proxy",
            state_version: 3,
            server_timestamp: 5000,
            updated_at: "2026-07-22T12:00:00Z",
        };

        const result = toPlaybackState(response);

        expect(result.isPlaying).toBe(true);
        expect(result.positionSeconds).toBe(50);
        expect(result.durationSeconds).toBe(200);
        expect(result.playbackRate).toBe(1.5);
        expect(result.videoUrl).toBe("https://example.com/v.mp4");
        expect(result.playbackMode).toBe("proxy");
        expect(result.stateVersion).toBe(3);
        expect(result.serverTimestamp).toBe(5000);
        expect(result.updatedAt).toBe("2026-07-22T12:00:00Z");
    });

    it("maps null video_url to null videoUrl", () => {
        const response: PlaybackStateResponse = {
            is_playing: false,
            position_seconds: 0,
            duration_seconds: 0,
            playback_rate: 1,
            video_url: null,
            playback_mode: "proxy",
            state_version: 0,
            server_timestamp: null,
            updated_at: "",
        };

        const result = toPlaybackState(response);

        expect(result.videoUrl).toBeNull();
        expect(result.serverTimestamp).toBeNull();
    });
});

describe("computeExpectedPosition", () => {
    it("returns positionSeconds when not playing", () => {
        const state = makeState({ isPlaying: false, positionSeconds: 42 });
        expect(computeExpectedPosition(state, 2000)).toBe(42);
    });

    it("returns positionSeconds when receivedAt is null", () => {
        const state = makeState({
            isPlaying: true,
            receivedAt: null,
            positionSeconds: 42,
        });
        expect(computeExpectedPosition(state, 2000)).toBe(42);
    });

    it("compensates drift when playing with a receivedAt baseline at normal speed", () => {
        const state = makeState({
            isPlaying: true,
            receivedAt: 1000,
            positionSeconds: 50,
            playbackRate: 1,
        });
        expect(computeExpectedPosition(state, 1005)).toBe(55);
    });

    it("compensates drift at 2x playback rate", () => {
        const state = makeState({
            isPlaying: true,
            receivedAt: 1000,
            positionSeconds: 50,
            playbackRate: 2,
        });
        expect(computeExpectedPosition(state, 1005)).toBe(60);
    });

    it("compensates drift at 0.5x playback rate", () => {
        const state = makeState({
            isPlaying: true,
            receivedAt: 1000,
            positionSeconds: 50,
            playbackRate: 0.5,
        });
        expect(computeExpectedPosition(state, 1010)).toBe(55);
    });

    it("handles large elapsed time (long poll interval)", () => {
        const state = makeState({
            isPlaying: true,
            receivedAt: 1000,
            positionSeconds: 0,
            playbackRate: 1,
        });
        expect(computeExpectedPosition(state, 1010)).toBe(10);
    });

    it("extrapolates from a client-monotonic baseline, ignoring the server clock offset", () => {
        // The snapshot was received at client-time 2000 (server clock said
        // 1000 — a 1000s client↔server offset). Extrapolation must use the
        // client receipt baseline, not the server timestamp.
        const state = makeState({
            isPlaying: true,
            receivedAt: 2000,
            serverTimestamp: 1000,
            positionSeconds: 50,
            playbackRate: 1,
        });
        expect(computeExpectedPosition(state, 2005)).toBe(55);
    });
});
