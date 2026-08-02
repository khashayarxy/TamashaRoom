import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePlaybackSync } from "@/Hooks/use-playback-sync";

const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock("@/lib/api", () => ({
    default: {
        get: (...args: unknown[]) => mockGet(...args),
        patch: (...args: unknown[]) => mockPatch(...args),
    },
}));

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
            timeout: 3000,
        });

        expect(mockPatch).toHaveBeenCalledWith(
            "/playback/1",
            expect.objectContaining({
                is_playing: true,
                position_seconds: 50,
            }),
        );
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
});
