import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SyncedVideoJsPlayer } from "@/Components/Player/SyncedVideoJsPlayer";
import { usePlaybackSync } from "@/Hooks/use-playback-sync";
import type { PlaybackState, PlaybackMode } from "@/lib/types/playback";

const mockSync = vi.fn();
const mockSyncImmediate = vi.fn();

const testState = vi.hoisted(() => {
    return {
        currentTime: 0,
        duration: 300,
        playMock: vi.fn(),
        pauseMock: vi.fn(),
        seekToMock: vi.fn(),
        props: null as {
            onPlay?: () => void;
            onPause?: () => void;
            onSeeked?: () => void;
            onTimeUpdate?: (currentTime: number) => void;
            onEnded?: () => void;
            onReady?: () => void;
            onError?: () => void;
            src?: string;
            videoUrl?: string | null;
        } | null,
    };
});

vi.mock("@/Components/Player/VideoJsPlayer", async () => {
    const React = await import("react");
    const { forwardRef, useImperativeHandle } = React;
    return {
        VideoJsPlayer: forwardRef(
            (
                props: {
                    src: string;
                    videoUrl?: string | null;
                    onPlay?: () => void;
                    onPause?: () => void;
                    onSeeked?: () => void;
                    onTimeUpdate?: (currentTime: number) => void;
                    onEnded?: () => void;
                    onReady?: () => void;
                    onError?: () => void;
                },
                ref,
            ) => {
                // eslint-disable-next-line react-compiler/react-compiler
                testState.props = props;
                useImperativeHandle(ref, () => ({
                    getCurrentTime: () => testState.currentTime,
                    getDuration: () => testState.duration,
                    getVolume: () => 1,
                    isPlaying: () => testState.currentTime > 0,
                    seekTo: (time: number) => {
                        testState.currentTime = time;
                        testState.seekToMock(time);
                    },
                    play: () => testState.playMock(),
                    pause: () => testState.pauseMock(),
                    toggleMuted: () => {},
                    toggleCaptions: () => {},
                    enterFullscreen: () => {},
                    getVideoElement: () => null,
                }));
                return React.createElement("video", {
                    "data-testid": "player-video",
                    "data-src": props.src,
                });
            },
        ),
    };
});

vi.mock("@/Hooks/use-playback-sync", () => ({
    usePlaybackSync: vi.fn(() => ({
        state: {
            isPlaying: false,
            positionSeconds: 0,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: "https://example.com/video.mp4",
            playbackMode: "direct" as const,
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            receivedAt: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        } satisfies PlaybackState,
        sync: mockSync,
        syncImmediate: mockSyncImmediate,
        loading: false,
        error: null,
    })),
}));

vi.mock("@/lib/types/playback", () => ({
    computeExpectedPosition: vi.fn(() => testState.currentTime + 5),
    toPlaybackState: vi.fn(),
}));

function makeState(overrides: Partial<PlaybackState> = {}): PlaybackState {
    return {
        isPlaying: false,
        positionSeconds: 0,
        durationSeconds: 300,
        playbackRate: 1,
        videoUrl: "https://example.com/video.mp4",
        playbackMode: "direct" as PlaybackMode,
        stateVersion: 1,
        serverTimestamp: Date.now() / 1000,
        receivedAt: Date.now() / 1000,
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

describe("SyncedVideoJsPlayer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        testState.currentTime = 0;
        testState.duration = 300;
        testState.props = null;
        testState.seekToMock.mockImplementation(() => {});
    });

    afterEach(() => {
        testState.playMock.mockReset();
        testState.pauseMock.mockReset();
    });

    it("shows a sync error banner above the player", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState(),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: "Network Error",
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        expect(screen.getByText(/خطا در همگام‌سازی/)).toBeInTheDocument();
    });

    it("uses the proxy URL when playbackMode is proxy", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ playbackMode: "proxy" }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(<SyncedVideoJsPlayer roomId={1} />);
        expect(screen.getByTestId("player-video")).toHaveAttribute(
            "data-src",
            "/proxy/video/1",
        );
    });

    it("falls back to the direct URL when the proxy source errors", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ playbackMode: "proxy" }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(<SyncedVideoJsPlayer roomId={1} />);
        expect(screen.getByTestId("player-video")).toHaveAttribute(
            "data-src",
            "/proxy/video/1",
        );

        act(() => {
            testState.props?.onError?.();
        });

        expect(screen.getByTestId("player-video")).toHaveAttribute(
            "data-src",
            "https://example.com/video.mp4",
        );
    });

    it("passes the content videoUrl through to the player", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ playbackMode: "proxy" }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        expect(testState.props?.videoUrl).toBe("https://example.com/video.mp4");

        act(() => {
            testState.props?.onError?.();
        });
        // The content identity stays the same after the proxy→direct fallback.
        expect(testState.props?.videoUrl).toBe("https://example.com/video.mp4");
    });

    it("uses the direct URL when playbackMode is direct", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ playbackMode: "direct" }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        expect(screen.getByTestId("player-video")).toHaveAttribute(
            "data-src",
            "https://example.com/video.mp4",
        );
    });

    it("shows the empty state when no video URL is available", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ videoUrl: null }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(<SyncedVideoJsPlayer roomId={1} initialVideoUrl={null} />);
        expect(
            screen.getByText("هنوز ویدیویی تنظیم نشده است"),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("player-video")).not.toBeInTheDocument();
    });

    it("host syncs an authoritative play on the native play event", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState(),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        act(() => {
            testState.props?.onPlay?.();
        });

        expect(mockSyncImmediate).toHaveBeenCalledWith({
            isPlaying: true,
            positionSeconds: 0,
        });
    });

    it("hosts sync an immediate pause with the current position", () => {
        testState.currentTime = 42;
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ isPlaying: true }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        act(() => {
            testState.props?.onPause?.();
        });

        expect(mockSyncImmediate).toHaveBeenCalledWith({
            isPlaying: false,
            positionSeconds: 42,
        });
    });

    it("hosts sync a classified seek on the seeked event", () => {
        testState.currentTime = 77;
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState(),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        act(() => {
            testState.props?.onSeeked?.();
        });

        expect(mockSyncImmediate).toHaveBeenCalledWith({ positionSeconds: 77 });
    });

    it("hosts sync time-updates through the regular sync channel", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ isPlaying: true }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        act(() => {
            testState.props?.onReady?.();
        });
        testState.currentTime = 10;
        act(() => {
            testState.props?.onTimeUpdate?.(10);
        });

        expect(mockSync).toHaveBeenCalledWith({
            positionSeconds: 10,
            durationSeconds: 300,
        });
    });

    it("guests do not emit sync events", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState(),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );

        act(() => {
            testState.props?.onPlay?.();
            testState.props?.onPause?.();
            testState.props?.onSeeked?.();
            testState.props?.onTimeUpdate?.(10);
        });

        expect(mockSync).not.toHaveBeenCalled();
        expect(mockSyncImmediate).not.toHaveBeenCalled();
    });

    it("corrects guest drift toward the expected position when playing", () => {
        testState.currentTime = 100;
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ isPlaying: true, positionSeconds: 10 }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );

        act(() => {
            testState.props?.onReady?.();
        });

        // computeExpectedPosition is faked to currentTime + 5 → 105, and the
        // guest sits at 100: within threshold? No — diff is 5 > 2, so it must
        // snap to 105.
        expect(testState.seekToMock).toHaveBeenCalledWith(105);
        expect(testState.playMock).toHaveBeenCalled();
    });

    it("does not correct the host's position", () => {
        testState.currentTime = 100;
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ isPlaying: true, positionSeconds: 10 }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        act(() => {
            testState.props?.onReady?.();
        });

        expect(testState.seekToMock).not.toHaveBeenCalled();
    });

    it("pauses the guest when the room is paused", () => {
        testState.currentTime = 40;
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ positionSeconds: 10 }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );

        act(() => {
            testState.props?.onReady?.();
        });

        expect(testState.pauseMock).toHaveBeenCalled();
    });

    it("shows the tap-to-play overlay when a guest's autoplay is blocked", async () => {
        testState.playMock.mockRejectedValue(
            new DOMException("NotAllowedError", "NotAllowedError"),
        );
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ isPlaying: true, positionSeconds: 5 }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );

        act(() => {
            testState.props?.onReady?.();
        });

        expect(await screen.findByText("شروع پخش")).toBeInTheDocument();
    });

    it("does not show the tap-to-play overlay for the host", () => {
        testState.playMock.mockRejectedValue(
            new DOMException("NotAllowedError", "NotAllowedError"),
        );
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ isPlaying: true, positionSeconds: 5 }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        act(() => {
            testState.props?.onReady?.();
        });

        expect(screen.queryByText("شروع پخش")).not.toBeInTheDocument();
    });

    it("tap-to-play starts the video locally without writing playback state", async () => {
        testState.playMock.mockRejectedValueOnce(
            new DOMException("NotAllowedError", "NotAllowedError"),
        );
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState({ isPlaying: true, positionSeconds: 5 }),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );

        act(() => {
            testState.props?.onReady?.();
        });
        await screen.findByText("شروع پخش");

        testState.playMock.mockImplementation(() => Promise.resolve());
        fireEvent.click(screen.getByText("شروع پخش"));

        expect(mockSync).not.toHaveBeenCalled();
        expect(mockSyncImmediate).not.toHaveBeenCalled();
        expect(screen.queryByText("شروع پخش")).not.toBeInTheDocument();
    });

    it("shows the end card and lets a host replay", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState(),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        act(() => {
            testState.props?.onEnded?.();
        });

        expect(screen.getByText("ویدیو به پایان رسید")).toBeInTheDocument();

        fireEvent.click(screen.getByText("دوباره ببینیم"));

        expect(mockSyncImmediate).toHaveBeenCalledWith({
            isPlaying: true,
            positionSeconds: 0,
        });
        expect(
            screen.queryByText("ویدیو به پایان رسید"),
        ).not.toBeInTheDocument();
    });

    it("hides the replay button for guests", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState(),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );

        act(() => {
            testState.props?.onEnded?.();
        });

        expect(screen.queryByText("دوباره ببینیم")).not.toBeInTheDocument();
    });

    it("renders subtitle overlay state for provided subtitles", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState(),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
                subtitles={{
                    cues: [],
                    settings: {
                        size: 20,
                        color: "#ffffff",
                        enabled: true,
                        bgOpacity: 40,
                        position: "bottom",
                        offset: 0,
                        fontFamily: "Vazirmatn-Medium",
                        borderRadius: "rounded",
                        vOffset: 0,
                    },
                    loading: true,
                    error: null,
                }}
            />,
        );

        expect(
            screen.getByText("در حال بارگذاری زیرنویس..."),
        ).toBeInTheDocument();
    });

    it("renders the subtitle error pill when subtitles fail", () => {
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: makeState(),
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });
        render(
            <SyncedVideoJsPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
                subtitles={{
                    cues: [],
                    settings: {
                        size: 20,
                        color: "#ffffff",
                        enabled: true,
                        bgOpacity: 40,
                        position: "bottom",
                        offset: 0,
                        fontFamily: "Vazirmatn-Medium",
                        borderRadius: "rounded",
                        vOffset: 0,
                    },
                    loading: false,
                    error: "زیرنویس نامعتبر",
                }}
            />,
        );

        expect(screen.getByText("زیرنویس نامعتبر")).toBeInTheDocument();
    });
});
