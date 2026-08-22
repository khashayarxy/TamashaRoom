import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePlaybackSync } from "@/Hooks/use-playback-sync";
import { createFakeEcho, type FakeEcho } from "./helpers/fake-echo";

const mockGet = vi.fn();
const mockPatch = vi.fn();

const echoHolder = vi.hoisted(() => ({ instance: null as FakeEcho | null }));

vi.mock("@/lib/api", () => ({
    default: {
        get: (...args: unknown[]) => mockGet(...args),
        patch: (...args: unknown[]) => mockPatch(...args),
    },
}));

vi.mock("@/lib/echo", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/echo")>();
    return {
        ...actual,
        getEcho: () => echoHolder.instance,
    };
});

function makeResponse(overrides: Record<string, unknown> = {}) {
    return {
        is_playing: false,
        position_seconds: 0,
        duration_seconds: 300,
        playback_rate: 1,
        video_url: "https://example.com/v.mp4",
        playback_mode: "direct",
        state_version: 1,
        server_timestamp: Date.now() / 1000,
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

describe("usePlaybackSync", () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockPatch.mockReset();
        mockGet.mockResolvedValue({ data: makeResponse() });
        // Undo any document.hidden leakage from visibility tests.
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });
    });

    it("fetches initial state on mount", async () => {
        const { result } = renderHook(() => usePlaybackSync({ roomId: 1 }));

        expect(result.current.loading).toBe(true);
        expect(mockGet).toHaveBeenCalledWith(
            "/playback/1/state",
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.state.isPlaying).toBe(false);
        expect(result.current.state.stateVersion).toBe(1);
    });

    it("does not allow non-host to sync", async () => {
        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: false }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.sync({ isPlaying: true });
        });

        expect(mockPatch).not.toHaveBeenCalled();
    });

    it("debounces host sync then sends patch", async () => {
        mockPatch.mockResolvedValue({
            data: { status: "ok", state_version: 2, server_timestamp: 2000 },
        });

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.sync({ isPlaying: true, positionSeconds: 50 });
        });

        expect(mockPatch).not.toHaveBeenCalled();

        await waitFor(() => expect(mockPatch).toHaveBeenCalled(), {
            timeout: 4000,
        });

        expect(mockPatch).toHaveBeenCalledWith(
            "/playback/1",
            expect.objectContaining({
                is_playing: true,
                position_seconds: 50,
            }),
        );
    });

    it("omits video_url from a routine position sync", async () => {
        mockPatch.mockResolvedValue({
            data: { status: "ok", state_version: 2, server_timestamp: 2000 },
        });

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.sync({ isPlaying: true, positionSeconds: 50 });
        });

        await waitFor(() => expect(mockPatch).toHaveBeenCalled(), {
            timeout: 4000,
        });

        // A position-only sync must never carry the host's (possibly stale)
        // local videoUrl. Sending it would make the server treat that PATCH as
        // an authoritative video change and revert a newly set video.
        expect(mockPatch).toHaveBeenCalledWith(
            "/playback/1",
            expect.not.objectContaining({
                video_url: expect.anything(),
            }),
        );
    });

    it("refetches authoritative state when refreshKey changes", async () => {
        const { result, rerender } = renderHook(
            ({ refreshKey }: { refreshKey: number }) =>
                usePlaybackSync({ roomId: 1, refreshKey }),
            { initialProps: { refreshKey: 0 } },
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(mockGet).toHaveBeenCalledTimes(1);

        mockGet.mockResolvedValue({
            data: makeResponse({
                state_version: 2,
                video_url: "https://x.com/new.mp4",
            }),
        });

        rerender({ refreshKey: 1 });

        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
        await waitFor(() =>
            expect(result.current.state.videoUrl).toBe("https://x.com/new.mp4"),
        );
    });

    it("does not refetch when refreshKey is unchanged", async () => {
        const { rerender } = renderHook(
            ({ refreshKey }: { refreshKey: number }) =>
                usePlaybackSync({ roomId: 1, refreshKey }),
            { initialProps: { refreshKey: 0 } },
        );

        await waitFor(() => expect(mockGet).toHaveBeenCalled());
        expect(mockGet).toHaveBeenCalledTimes(1);

        rerender({ refreshKey: 0 });

        expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("syncImmediate calls patch then refetches state", async () => {
        mockPatch.mockResolvedValue({
            data: { status: "ok", state_version: 3, server_timestamp: 3000 },
        });

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        mockGet.mockClear();

        await act(async () => {
            await result.current.syncImmediate({ isPlaying: true });
        });

        expect(mockPatch).toHaveBeenCalled();
        expect(mockGet).toHaveBeenCalled();
    });

    it("sets error state on fetch failure", async () => {
        mockGet.mockReset();
        mockGet.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => usePlaybackSync({ roomId: 1 }));

        await waitFor(() => expect(result.current.loading).toBe(false), {
            timeout: 3000,
        });
        expect(result.current.error).toBe("Failed to sync playback");
    });

    it("calls onRemoteChange when new state arrives", async () => {
        const onRemoteChange = vi.fn();

        renderHook(() => usePlaybackSync({ roomId: 1, onRemoteChange }));

        await waitFor(() => {
            expect(onRemoteChange).toHaveBeenCalledWith(
                expect.objectContaining({ stateVersion: 1 }),
            );
        });
    });

    it("continues polling after the initial fetch", async () => {
        vi.useFakeTimers();

        try {
            renderHook(() => usePlaybackSync({ roomId: 1 }));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            expect(mockGet).toHaveBeenCalledTimes(1);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });

            expect(mockGet).toHaveBeenCalledTimes(2);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });

            expect(mockGet).toHaveBeenCalledTimes(3);
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not poll further while the document is hidden", async () => {
        vi.useFakeTimers();

        try {
            Object.defineProperty(document, "hidden", {
                configurable: true,
                value: true,
            });
            Object.defineProperty(document, "visibilityState", {
                configurable: true,
                value: "hidden",
            });

            renderHook(() => usePlaybackSync({ roomId: 1 }));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            expect(mockGet).toHaveBeenCalledTimes(0);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(30000);
            });

            expect(mockGet).toHaveBeenCalledTimes(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it("resumes polling when the document becomes visible again", async () => {
        vi.useFakeTimers();

        try {
            Object.defineProperty(document, "hidden", {
                configurable: true,
                value: true,
            });
            Object.defineProperty(document, "visibilityState", {
                configurable: true,
                value: "hidden",
            });

            renderHook(() => usePlaybackSync({ roomId: 1 }));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            expect(mockGet).toHaveBeenCalledTimes(0);

            Object.defineProperty(document, "hidden", {
                configurable: true,
                value: false,
            });
            Object.defineProperty(document, "visibilityState", {
                configurable: true,
                value: "visible",
            });
            document.dispatchEvent(new Event("visibilitychange"));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            expect(mockGet).toHaveBeenCalledTimes(1);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });

            expect(mockGet).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("keeps polling after a fetch error", async () => {
        vi.useFakeTimers();

        try {
            mockGet.mockRejectedValue(new Error("Network error"));

            const { result } = renderHook(() => usePlaybackSync({ roomId: 1 }));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            expect(result.current.error).toBe("Failed to sync playback");
            expect(mockGet).toHaveBeenCalledTimes(1);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });

            expect(mockGet).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("polls at the active interval while playing", async () => {
        vi.useFakeTimers();

        try {
            mockGet.mockResolvedValue({
                data: makeResponse({ is_playing: true }),
            });

            renderHook(() => usePlaybackSync({ roomId: 1 }));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            expect(mockGet).toHaveBeenCalledTimes(1);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2999);
            });

            expect(mockGet).toHaveBeenCalledTimes(1);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });

            expect(mockGet).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("stops polling after unmount", async () => {
        vi.useFakeTimers();

        try {
            const { unmount } = renderHook(() =>
                usePlaybackSync({ roomId: 1 }),
            );

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            expect(mockGet).toHaveBeenCalledTimes(1);

            unmount();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(60000);
            });

            expect(mockGet).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("applies playback_mode from the sync response", async () => {
        mockPatch.mockResolvedValue({
            data: {
                status: "ok",
                state_version: 2,
                server_timestamp: 2000,
                playback_mode: "proxy",
            },
        });

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.syncImmediate({
                isPlaying: true,
                videoUrl: "https://x.com/2.mp4",
            });
        });

        expect(result.current.state.playbackMode).toBe("proxy");
    });

    it("aborts an in-flight fetch on unmount", async () => {
        let capturedSignal: AbortSignal | undefined;
        mockGet.mockReset();
        mockGet.mockImplementation(
            (_url: string, config: { signal?: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    capturedSignal = config.signal;
                    config.signal?.addEventListener("abort", () =>
                        reject(new DOMException("Aborted", "AbortError")),
                    );
                }),
        );

        const { unmount } = renderHook(() => usePlaybackSync({ roomId: 1 }));

        expect(mockGet).toHaveBeenCalledTimes(1);

        unmount();

        expect(capturedSignal?.aborted).toBe(true);
    });

    it("does not clear loading from a stale response while a newer request is pending", async () => {
        const deferred: Record<number, (v: { data: unknown }) => void> = {};
        let call = 0;
        mockGet.mockReset();
        mockGet.mockImplementation(
            () =>
                new Promise((resolve) => {
                    deferred[++call] = resolve;
                }),
        );
        mockPatch.mockResolvedValue({
            data: { status: "ok", state_version: 2, server_timestamp: 2000 },
        });

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

        await act(async () => {
            void result.current.syncImmediate({ isPlaying: true });
        });

        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

        await act(async () => {
            deferred[1]({ data: makeResponse() });
        });

        expect(result.current.loading).toBe(true);

        await act(async () => {
            deferred[2]({ data: makeResponse({ state_version: 3 }) });
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.state.stateVersion).toBe(3);
    });

    it("discards stale fetch responses that arrive after a newer request", async () => {
        const deferred: Record<number, (v: { data: unknown }) => void> = {};
        let call = 0;
        mockGet.mockReset();
        mockGet.mockImplementation(
            () =>
                new Promise((resolve) => {
                    deferred[++call] = resolve;
                }),
        );
        mockPatch.mockResolvedValue({
            data: { status: "ok", state_version: 2, server_timestamp: 2000 },
        });

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

        await act(async () => {
            void result.current.syncImmediate({ isPlaying: true });
        });

        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

        await act(async () => {
            deferred[2]({ data: makeResponse({ state_version: 3 }) });
        });

        await act(async () => {
            deferred[1]({ data: makeResponse({ state_version: 2 }) });
        });

        expect(result.current.state.stateVersion).toBe(3);
    });

    it("ignores fetch results that arrive after unmount", async () => {
        let resolveFetch: (v: { data: unknown }) => void;
        mockGet.mockReset();
        mockGet.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveFetch = resolve;
                }),
        );

        const onRemoteChange = vi.fn();

        const { unmount } = renderHook(() =>
            usePlaybackSync({ roomId: 1, onRemoteChange }),
        );

        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

        unmount();

        await act(async () => {
            resolveFetch({ data: makeResponse() });
        });

        expect(onRemoteChange).not.toHaveBeenCalled();
    });

    it("does not refetch after unmount when a late patch resolves", async () => {
        let resolvePatch: (v: { data: unknown }) => void;
        mockPatch.mockReset();
        mockPatch.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolvePatch = resolve;
                }),
        );

        const { result, unmount } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        mockGet.mockClear();

        act(() => {
            result.current.syncImmediate({ isPlaying: true });
        });

        unmount();

        await act(async () => {
            resolvePatch({
                data: {
                    status: "ok",
                    state_version: 2,
                    server_timestamp: 2000,
                },
            });
        });

        expect(mockGet).not.toHaveBeenCalled();
    });

    it("does not apply a PATCH response with a stale state_version", async () => {
        mockPatch.mockResolvedValue({
            data: {
                status: "ok",
                state_version: 5,
                server_timestamp: 5000,
            },
        });

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        // Current version is 1 (from the initial poll). A late/stale PATCH
        // response claiming an older version must be ignored.
        mockPatch.mockResolvedValue({
            data: {
                status: "ok",
                state_version: 0,
                server_timestamp: 1000,
            },
        });

        await act(async () => {
            await result.current.syncImmediate({ isPlaying: true });
        });

        expect(result.current.state.stateVersion).toBeGreaterThan(0);
    });
});

describe("usePlaybackSync (Pusher push transport)", () => {
    let fakeEcho: FakeEcho;

    beforeEach(() => {
        fakeEcho = createFakeEcho();
        echoHolder.instance = fakeEcho;
        mockGet.mockReset();
        mockPatch.mockReset();
        mockGet.mockResolvedValue({ data: makeResponse() });
    });

    afterEach(() => {
        echoHolder.instance = null;
    });

    it("joins the presence channel and applies a broadcast snapshot", async () => {
        const onRemoteChange = vi.fn();

        renderHook(() => usePlaybackSync({ roomId: 1, onRemoteChange }));

        expect(fakeEcho.joinedChannels).toContain("room.1");
        expect(fakeEcho.listening(".playback.state.changed")).toBe(true);

        const payload = makeResponse({
            state_version: 2,
            is_playing: true,
            position_seconds: 42,
        });

        await act(async () => {
            fakeEcho.emit(".playback.state.changed", payload);
        });

        expect(onRemoteChange).toHaveBeenCalledWith(
            expect.objectContaining({ stateVersion: 2, isPlaying: true }),
        );
    });

    it("ignores stale broadcasts whose state_version is not newer", async () => {
        const onRemoteChange = vi.fn();

        renderHook(() => usePlaybackSync({ roomId: 1, onRemoteChange }));

        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({ state_version: 1 }),
            );
        });

        // Initial GET already applied version 1; the duplicate must be dropped.
        expect(onRemoteChange).toHaveBeenCalledTimes(1);
    });

    it("re-seeds from the authoritative GET when the socket reconnects", async () => {
        renderHook(() => usePlaybackSync({ roomId: 1 }));

        mockGet.mockClear();
        mockGet.mockResolvedValue({
            data: makeResponse({ state_version: 3 }),
        });

        await act(async () => {
            fakeEcho.fireConnected();
        });

        expect(mockGet).toHaveBeenCalled();
    });

    it("does not poll while the push transport is healthy", async () => {
        vi.useFakeTimers();

        try {
            renderHook(() => usePlaybackSync({ roomId: 1 }));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
            await act(async () => {
                fakeEcho.fireConnected();
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            mockGet.mockClear();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(30000);
            });

            // Healthy push: the tiered polling loop must stay disarmed.
            expect(mockGet).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it("polls while push is unhealthy and stops once the socket connects", async () => {
        vi.useFakeTimers();

        try {
            renderHook(() => usePlaybackSync({ roomId: 1 }));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
            expect(mockGet).toHaveBeenCalledTimes(1);

            // Socket never connected: the polling fallback stays armed.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });
            expect(mockGet).toHaveBeenCalledTimes(2);

            await act(async () => {
                fakeEcho.fireConnected();
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            mockGet.mockClear();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(30000);
            });
            expect(mockGet).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it("resumes polling when a healthy socket drops", async () => {
        vi.useFakeTimers();

        try {
            renderHook(() => usePlaybackSync({ roomId: 1 }));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
            await act(async () => {
                fakeEcho.fireConnected();
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            mockGet.mockClear();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });
            expect(mockGet).not.toHaveBeenCalled();

            await act(async () => {
                fakeEcho.fireDisconnected();
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });

            expect(mockGet).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("keeps polling when the presence channel fails to subscribe (auth error)", async () => {
        vi.useFakeTimers();

        try {
            renderHook(() => usePlaybackSync({ roomId: 1 }));

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            // Connection up but the channel auth failed: never healthy.
            await act(async () => {
                fakeEcho.fireConnected();
                fakeEcho.fireSubscriptionError();
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            mockGet.mockClear();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });

            expect(mockGet).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("leaves the channel on unmount", async () => {
        const { unmount } = renderHook(() => usePlaybackSync({ roomId: 1 }));

        unmount();

        expect(fakeEcho.leftChannels).toContain("room.1");
    });
});

describe("usePlaybackSync (playback action toasts)", () => {
    let fakeEcho: FakeEcho;

    beforeEach(() => {
        fakeEcho = createFakeEcho();
        echoHolder.instance = fakeEcho;
        mockGet.mockReset();
        mockPatch.mockReset();
        mockGet.mockResolvedValue({ data: makeResponse() });
    });

    afterEach(() => {
        echoHolder.instance = null;
        vi.useRealTimers();
    });

    it("fires a pause action for a remote member's pause broadcast", async () => {
        mockGet.mockResolvedValue({
            data: makeResponse({
                is_playing: true,
                position_seconds: 60,
            }),
        });
        const onPlaybackAction = vi.fn();

        renderHook(() =>
            usePlaybackSync({ roomId: 1, currentUserId: 1, onPlaybackAction }),
        );
        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

        // The initial poll snapshot has no actor and must never toast.
        expect(onPlaybackAction).not.toHaveBeenCalled();

        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 2,
                    is_playing: false,
                    position_seconds: 60,
                    user_id: 2,
                }),
            );
        });

        expect(onPlaybackAction).toHaveBeenCalledTimes(1);
        expect(onPlaybackAction).toHaveBeenCalledWith({
            type: "pause",
            actorId: 2,
            positionSeconds: 60,
        });
    });

    it("fires a play action for a remote member's play broadcast", async () => {
        const onPlaybackAction = vi.fn();

        renderHook(() =>
            usePlaybackSync({ roomId: 1, currentUserId: 1, onPlaybackAction }),
        );
        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 2,
                    is_playing: true,
                    position_seconds: 30,
                    user_id: 2,
                }),
            );
        });

        expect(onPlaybackAction).toHaveBeenCalledWith({
            type: "play",
            actorId: 2,
            positionSeconds: 30,
        });
    });

    it("never fires for the acting user's own broadcasts", async () => {
        mockGet.mockResolvedValue({
            data: makeResponse({
                is_playing: true,
                position_seconds: 60,
            }),
        });
        const onPlaybackAction = vi.fn();

        renderHook(() =>
            usePlaybackSync({ roomId: 1, currentUserId: 1, onPlaybackAction }),
        );
        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 2,
                    is_playing: false,
                    position_seconds: 60,
                    user_id: 1,
                }),
            );
        });

        expect(onPlaybackAction).not.toHaveBeenCalled();
    });

    it("never fires for the local host's own PATCH flow", async () => {
        mockGet.mockResolvedValue({
            data: makeResponse({ is_playing: true, position_seconds: 60 }),
        });
        mockPatch.mockResolvedValue({
            data: { status: "ok", state_version: 2, server_timestamp: 2000 },
        });
        const onPlaybackAction = vi.fn();

        const { result } = renderHook(() =>
            usePlaybackSync({
                roomId: 1,
                isHost: true,
                currentUserId: 1,
                onPlaybackAction,
            }),
        );
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.syncImmediate({ isPlaying: false });
        });

        expect(mockPatch).toHaveBeenCalled();
        expect(onPlaybackAction).not.toHaveBeenCalled();
    });

    it("coalesces rapid seeks into one action with the final position", async () => {
        vi.useFakeTimers();
        mockGet.mockResolvedValue({
            data: makeResponse({
                is_playing: true,
                position_seconds: 100,
            }),
        });
        const onPlaybackAction = vi.fn();

        renderHook(() =>
            usePlaybackSync({ roomId: 1, currentUserId: 1, onPlaybackAction }),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(mockGet).toHaveBeenCalledTimes(1);

        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 2,
                    is_playing: true,
                    position_seconds: 300,
                    user_id: 2,
                }),
            );
        });
        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 3,
                    is_playing: true,
                    position_seconds: 420,
                    user_id: 2,
                }),
            );
        });

        // Inside the coalescing window: nothing fired yet.
        expect(onPlaybackAction).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });

        expect(onPlaybackAction).toHaveBeenCalledTimes(1);
        expect(onPlaybackAction).toHaveBeenCalledWith({
            type: "seek",
            actorId: 2,
            positionSeconds: 420,
        });
    });

    it("flushes a pending seek immediately when a pause arrives, preserving order", async () => {
        mockGet.mockResolvedValue({
            data: makeResponse({
                is_playing: true,
                position_seconds: 100,
            }),
        });
        const onPlaybackAction = vi.fn();

        renderHook(() =>
            usePlaybackSync({ roomId: 1, currentUserId: 1, onPlaybackAction }),
        );
        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 2,
                    is_playing: true,
                    position_seconds: 300,
                    user_id: 2,
                }),
            );
        });
        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 3,
                    is_playing: false,
                    position_seconds: 300,
                    user_id: 2,
                }),
            );
        });

        expect(onPlaybackAction).toHaveBeenCalledTimes(2);
        expect(onPlaybackAction).toHaveBeenNthCalledWith(1, {
            type: "seek",
            actorId: 2,
            positionSeconds: 300,
        });
        expect(onPlaybackAction).toHaveBeenNthCalledWith(2, {
            type: "pause",
            actorId: 2,
            positionSeconds: 300,
        });
    });

    it("does not fire a pending seek after unmount", async () => {
        vi.useFakeTimers();
        mockGet.mockResolvedValue({
            data: makeResponse({
                is_playing: true,
                position_seconds: 100,
            }),
        });
        const onPlaybackAction = vi.fn();

        const { unmount } = renderHook(() =>
            usePlaybackSync({ roomId: 1, currentUserId: 1, onPlaybackAction }),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 2,
                    is_playing: true,
                    position_seconds: 300,
                    user_id: 2,
                }),
            );
        });

        unmount();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });

        expect(onPlaybackAction).not.toHaveBeenCalled();
    });
});

describe("usePlaybackSync host optimistic control (pause-delay regression)", () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockPatch.mockReset();
        mockGet.mockResolvedValue({ data: makeResponse() });
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });
    });

    function deferred<T>() {
        let resolve!: (value: T) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    }

    it("applies the host's pause optimistically, before the PATCH resolves", async () => {
        mockGet.mockResolvedValue({
            data: makeResponse({ state_version: 1, is_playing: true }),
        });
        const patch = deferred<{
            data: {
                status: string;
                state_version: number;
                server_timestamp: number;
            };
        }>();
        mockPatch.mockReturnValue(patch.promise);

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.syncImmediate({
                isPlaying: false,
                positionSeconds: 40,
            });
        });

        // The optimistic application must be synchronous with the user's
        // action — the component's apply effect keys on this state and would
        // otherwise re-call play() until the round-trip completes.
        expect(result.current.state.isPlaying).toBe(false);

        await act(async () => {
            patch.resolve({
                data: {
                    status: "ok",
                    state_version: 2,
                    server_timestamp: 2000,
                },
            });
        });

        expect(result.current.state.isPlaying).toBe(false);
        expect(result.current.state.stateVersion).toBe(2);
    });

    it("never reverts a just-paused host when the pre-pause position echo lands", async () => {
        // The regression: while playing, a position PATCH is on the wire when
        // the user pauses. That PATCH's broadcast echo (is_playing=true,
        // state_version=2 > the client's 1) used to flip state back to
        // playing, so the apply effect re-played the video for ~1s until the
        // pause PATCH's own response landed.
        mockGet.mockResolvedValue({
            data: makeResponse({
                state_version: 1,
                is_playing: true,
                position_seconds: 30,
            }),
        });
        const positionPatch = deferred<{
            data: {
                status: string;
                state_version: number;
                server_timestamp: number;
            };
        }>();
        const pausePatch = deferred<{
            data: {
                status: string;
                state_version: number;
                server_timestamp: number;
            };
        }>();
        mockPatch.mockReturnValueOnce(positionPatch.promise);
        mockPatch.mockReturnValueOnce(pausePatch.promise);

        const fakeEcho = createFakeEcho();
        echoHolder.instance = fakeEcho;

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true, currentUserId: 7 }),
        );
        await waitFor(() => expect(result.current.loading).toBe(false));

        // Host's debounced position sync flushes → position PATCH in flight.
        act(() => {
            result.current.sync({ positionSeconds: 41 });
        });
        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1), {
            timeout: 4000,
        });

        // The user pauses while that position PATCH is still on the wire.
        act(() => {
            result.current.syncImmediate({
                isPlaying: false,
                positionSeconds: 42,
            });
        });
        expect(mockPatch).toHaveBeenCalledTimes(2);
        expect(result.current.state.isPlaying).toBe(false);

        // The stale pre-pause echo arrives: playing, newer version, own id.
        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 2,
                    is_playing: true,
                    position_seconds: 41,
                    user_id: 7,
                }),
            );
        });

        expect(result.current.state.isPlaying).toBe(false);

        // Pause PATCH completes (server version 3)…
        await act(async () => {
            pausePatch.resolve({
                data: {
                    status: "ok",
                    state_version: 3,
                    server_timestamp: 3000,
                },
            });
        });

        // …and the stashed stale echo dies on the version guard, while the
        // pause's own echo applies as a consistent no-op.
        expect(result.current.state.isPlaying).toBe(false);
        expect(result.current.state.stateVersion).toBe(3);

        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 3,
                    is_playing: false,
                    position_seconds: 42,
                    user_id: 7,
                }),
            );
        });
        expect(result.current.state.isPlaying).toBe(false);

        // The abandoned position PATCH's response is out-of-order and ignored.
        await act(async () => {
            positionPatch.resolve({
                data: {
                    status: "ok",
                    state_version: 2,
                    server_timestamp: 2500,
                },
            });
        });
        expect(result.current.state.stateVersion).toBe(3);

        echoHolder.instance = null;
    });

    it("flushes a genuinely newer snapshot that arrived behind the fence", async () => {
        mockGet.mockResolvedValue({
            data: makeResponse({ state_version: 1, is_playing: true }),
        });
        const pausePatch = deferred<{
            data: {
                status: string;
                state_version: number;
                server_timestamp: number;
            };
        }>();
        mockPatch.mockReturnValueOnce(pausePatch.promise);

        const fakeEcho = createFakeEcho();
        echoHolder.instance = fakeEcho;
        const onPlaybackAction = vi.fn();

        const { result } = renderHook(() =>
            usePlaybackSync({
                roomId: 1,
                isHost: true,
                currentUserId: 7,
                onPlaybackAction,
            }),
        );
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.syncImmediate({
                isPlaying: false,
                positionSeconds: 10,
            });
        });

        // A NEWER authoritative snapshot (e.g. ownership changed mid-flight and
        // someone else resumed playback) lands while the fence is up.
        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 5,
                    is_playing: true,
                    position_seconds: 60,
                    user_id: 9,
                }),
            );
        });
        // Still fenced: nothing applied yet.
        expect(result.current.state.isPlaying).toBe(false);

        await act(async () => {
            pausePatch.resolve({
                data: {
                    status: "ok",
                    state_version: 2,
                    server_timestamp: 2000,
                },
            });
        });

        // Fence released: version 5 beats our response's 2 and applies, with
        // its member-visible action.
        expect(result.current.state.isPlaying).toBe(true);
        expect(result.current.state.stateVersion).toBe(5);
        expect(onPlaybackAction).toHaveBeenCalledWith({
            type: "play",
            actorId: 9,
            positionSeconds: 60,
        });

        echoHolder.instance = null;
    });

    it("reverts optimistically on a failed control PATCH via the stashed snapshot", async () => {
        mockGet.mockResolvedValue({
            data: makeResponse({ state_version: 1, is_playing: true }),
        });
        const pausePatch = deferred<{
            data: {
                status: string;
                state_version: number;
                server_timestamp: number;
            };
        }>();
        mockPatch.mockReturnValueOnce(pausePatch.promise);

        const fakeEcho = createFakeEcho();
        echoHolder.instance = fakeEcho;

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.syncImmediate({
                isPlaying: false,
                positionSeconds: 40,
            });
        });
        expect(result.current.state.isPlaying).toBe(false);

        // The room's authoritative playing echo piles up behind the fence…
        await act(async () => {
            fakeEcho.emit(
                ".playback.state.changed",
                makeResponse({
                    state_version: 2,
                    is_playing: true,
                    position_seconds: 41,
                    user_id: 7,
                }),
            );
        });

        // …and the pause PATCH fails: the honest reconciliation is to follow
        // the authoritative snapshot (playing) and surface the error.
        await act(async () => {
            pausePatch.reject(new Error("network down"));
        });

        expect(result.current.state.isPlaying).toBe(true);
        expect(result.current.error).toBe("Failed to sync playback");

        echoHolder.instance = null;
    });
});
