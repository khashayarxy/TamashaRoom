import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoPlayer } from "@/Components/composite/video-player";
import { usePlaybackSync } from "@/Hooks/use-playback-sync";
import type { PlaybackState, PlaybackMode } from "@/lib/types/playback";

const mockSync = vi.fn();
const mockSyncImmediate = vi.fn();

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
    computeExpectedPosition: vi.fn(() => 0),
    toPlaybackState: vi.fn(),
}));

describe("VideoPlayer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows empty state when no video URL is set", () => {
        const emptyState: PlaybackState = {
            isPlaying: false,
            positionSeconds: 0,
            durationSeconds: 0,
            playbackRate: 1,
            videoUrl: null,
            playbackMode: "direct" as PlaybackMode,
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            receivedAt: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };
        vi.mocked(usePlaybackSync).mockReturnValueOnce({
            state: emptyState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        render(<VideoPlayer roomId={1} />);
        expect(
            screen.getByText("هنوز ویدیویی تنظیم نشده است"),
        ).toBeInTheDocument();
    });

    it("renders video element with source URL", () => {
        const { container } = render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        const video = container.querySelector("video");
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute("src", "https://example.com/video.mp4");
    });

    it("renders controls overlay with play/pause button when canControl is true", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );
        expect(screen.getByLabelText("پخش یا مکث")).toBeInTheDocument();
    });

    it("hides play/pause button when canControl is false", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );
        expect(screen.queryByLabelText("پخش یا مکث")).not.toBeInTheDocument();
    });

    it("shows skip buttons when canControl is true", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );
        expect(
            screen.getByLabelText("پرش ۱۰ ثانیه به عقب"),
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText("پرش ۱۰ ثانیه به جلو"),
        ).toBeInTheDocument();
    });

    it("hides skip buttons when canControl is false", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );
        expect(
            screen.queryByLabelText("پرش ۱۰ ثانیه به عقب"),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByLabelText("پرش ۱۰ ثانیه به جلو"),
        ).not.toBeInTheDocument();
    });

    it("calls syncImmediate on play/pause click", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        fireEvent.click(screen.getByLabelText("پخش یا مکث"));

        expect(mockSyncImmediate).toHaveBeenCalledWith({ isPlaying: true });
    });

    it("renders duration display", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        expect(screen.getByText("0:00")).toBeInTheDocument();
        expect(screen.getByText("5:00")).toBeInTheDocument();
    });

    it("renders children inside the player", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            >
                <div data-testid="child">Child content</div>
            </VideoPlayer>,
        );
        expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("uses proxy URL when playbackMode is proxy", () => {
        const proxyState: PlaybackState = {
            isPlaying: false,
            positionSeconds: 0,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: "https://example.com/video.mp4",
            playbackMode: "proxy",
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            receivedAt: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };
        vi.mocked(usePlaybackSync).mockReturnValueOnce({
            state: proxyState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        const { container } = render(<VideoPlayer roomId={1} />);
        const video = container.querySelector("video");
        expect(video).toHaveAttribute("src", "/proxy/video/1");
    });

    it("falls back to direct URL when proxy fails", () => {
        const proxyState: PlaybackState = {
            isPlaying: false,
            positionSeconds: 0,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: "https://example.com/backup.mp4",
            playbackMode: "proxy",
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            receivedAt: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };

        vi.mocked(usePlaybackSync).mockReturnValue({
            state: proxyState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        const { container } = render(<VideoPlayer roomId={1} />);
        const video = container.querySelector("video");

        fireEvent.error(video!);

        const newVideo = container.querySelector("video");
        expect(newVideo).toHaveAttribute(
            "src",
            "https://example.com/backup.mp4",
        );
    });

    it("shows volume, mute and fullscreen controls for guests", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );
        expect(screen.getByLabelText("بی\u200cصدا کردن")).toBeInTheDocument();
        expect(screen.getByLabelText("صدا")).toBeInTheDocument();
        expect(screen.getByLabelText("تمام صفحه")).toBeInTheDocument();
    });

    it("toggles mute state when mute button is clicked", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        fireEvent.click(screen.getByLabelText("بی\u200cصدا کردن"));
        expect(screen.getByLabelText("باز کردن صدا")).toBeInTheDocument();
    });

    it("mutes the video when volume slider is set to zero", () => {
        const { container } = render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        fireEvent.change(screen.getByLabelText("صدا"), {
            target: { value: "0" },
        });
        expect(screen.getByLabelText("باز کردن صدا")).toBeInTheDocument();
        const video = container.querySelector("video");
        expect(video!.muted).toBe(true);
    });

    it("shows loading skeleton when fetching state with no video URL", () => {
        const loadingState: PlaybackState = {
            isPlaying: false,
            positionSeconds: 0,
            durationSeconds: 0,
            playbackRate: 1,
            videoUrl: null,
            playbackMode: "direct" as PlaybackMode,
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            receivedAt: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };
        vi.mocked(usePlaybackSync).mockReturnValueOnce({
            state: loadingState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: true,
            error: null,
        });

        render(<VideoPlayer roomId={1} />);
        expect(
            screen.getByText("در حال بارگذاری ویدیو..."),
        ).toBeInTheDocument();
    });

    it("shows error message when fetching fails and no video URL", () => {
        vi.mocked(usePlaybackSync).mockReturnValueOnce({
            state: {
                isPlaying: false,
                positionSeconds: 0,
                durationSeconds: 0,
                playbackRate: 1,
                videoUrl: null,
                playbackMode: "direct" as PlaybackMode,
                stateVersion: 1,
                serverTimestamp: Date.now() / 1000,
                receivedAt: Date.now() / 1000,
                updatedAt: new Date().toISOString(),
            } satisfies PlaybackState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: "Network Error",
        });

        render(<VideoPlayer roomId={1} />);
        expect(
            screen.getByText("خطا در دریافت اطلاعات ویدیو"),
        ).toBeInTheDocument();
    });

    it("shows sync error banner above the video", () => {
        vi.mocked(usePlaybackSync).mockReturnValueOnce({
            state: {
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
            } satisfies PlaybackState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: "Network Error",
        });

        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        expect(screen.getByText(/خطا در همگام‌سازی/)).toBeInTheDocument();
    });

    it("shows the end-of-video card when the video ends", () => {
        const { container } = render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
                onSuggestNext={vi.fn()}
            />,
        );
        const video = container.querySelector("video")!;
        fireEvent.ended(video);
        expect(screen.getByText("ویدیو به پایان رسید")).toBeInTheDocument();
        expect(screen.getByText("دوباره ببینیم")).toBeInTheDocument();
        expect(screen.getByText("پیشنهاد بعدی")).toBeInTheDocument();
    });

    it("does not show the end card before the video ends", () => {
        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        expect(
            screen.queryByText("ویدیو به پایان رسید"),
        ).not.toBeInTheDocument();
    });

    it("replays through the authoritative playback path for the host", () => {
        const { container } = render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );
        const video = container.querySelector("video")!;
        fireEvent.ended(video);

        fireEvent.click(screen.getByText("دوباره ببینیم"));

        expect(mockSyncImmediate).toHaveBeenCalledWith({
            isPlaying: true,
            positionSeconds: 0,
        });
        expect(
            screen.queryByText("ویدیو به پایان رسید"),
        ).not.toBeInTheDocument();
    });

    it("hides the replay button for guests but keeps the suggest action", () => {
        const { container } = render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
                onSuggestNext={vi.fn()}
            />,
        );
        const video = container.querySelector("video")!;
        fireEvent.ended(video);

        expect(screen.queryByText("دوباره ببینیم")).not.toBeInTheDocument();
        expect(screen.getByText("پیشنهاد بعدی")).toBeInTheDocument();
    });

    it("does not allow a guest to trigger playback control on replay", () => {
        const { container } = render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );
        const video = container.querySelector("video")!;
        fireEvent.ended(video);

        expect(mockSyncImmediate).not.toHaveBeenCalled();
    });

    it("calls onSuggestNext when the suggest-next button is clicked", () => {
        const onSuggestNext = vi.fn();
        const { container } = render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                onSuggestNext={onSuggestNext}
            />,
        );
        const video = container.querySelector("video")!;
        fireEvent.ended(video);

        fireEvent.click(screen.getByText("پیشنهاد بعدی"));
        expect(onSuggestNext).toHaveBeenCalledTimes(1);
    });

    it("does not duplicate the end UI on repeated ended events", () => {
        const { container } = render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        const video = container.querySelector("video")!;
        fireEvent.ended(video);
        fireEvent.ended(video);
        fireEvent.ended(video);

        expect(screen.getAllByText("ویدیو به پایان رسید")).toHaveLength(1);
    });

    it("clears the end state when playback resumes", () => {
        const { container } = render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
            />,
        );
        const video = container.querySelector("video")!;
        fireEvent.ended(video);
        expect(screen.getByText("ویدیو به پایان رسید")).toBeInTheDocument();

        fireEvent.play(video);
        expect(
            screen.queryByText("ویدیو به پایان رسید"),
        ).not.toBeInTheDocument();
    });

    it("shows a tap-to-play overlay for a guest when the browser blocks autoplay", async () => {
        const playingState: PlaybackState = {
            isPlaying: true,
            positionSeconds: 5,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: "https://example.com/video.mp4",
            playbackMode: "direct" as PlaybackMode,
            stateVersion: 2,
            serverTimestamp: Date.now() / 1000,
            receivedAt: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: playingState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        // Simulate a browser autoplay block: play() rejects (jsdom's play()
        // returns undefined, so stub the rejected-promise contract explicitly).
        const playSpy = vi
            .spyOn(HTMLMediaElement.prototype, "play")
            .mockRejectedValue(
                new DOMException("NotAllowedError", "NotAllowedError"),
            );

        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );

        await screen.findByText("شروع پخش");

        const video = document.querySelector("video")!;
        expect(video).toBeInTheDocument();
        playSpy.mockRestore();
    });

    it("does not show a tap-to-play overlay for the owner", async () => {
        const playingState: PlaybackState = {
            isPlaying: true,
            positionSeconds: 5,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: "https://example.com/video.mp4",
            playbackMode: "direct" as PlaybackMode,
            stateVersion: 2,
            serverTimestamp: Date.now() / 1000,
            receivedAt: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: playingState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        const playSpy = vi
            .spyOn(HTMLMediaElement.prototype, "play")
            .mockRejectedValue(
                new DOMException("NotAllowedError", "NotAllowedError"),
            );

        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        expect(screen.queryByText("شروع پخش")).not.toBeInTheDocument();
        playSpy.mockRestore();
    });

    it("tap-to-play starts the video locally without mutating playback state", async () => {
        const playingState: PlaybackState = {
            isPlaying: true,
            positionSeconds: 5,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: "https://example.com/video.mp4",
            playbackMode: "direct" as PlaybackMode,
            stateVersion: 2,
            serverTimestamp: Date.now() / 1000,
            receivedAt: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: playingState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        const playSpy = vi
            .spyOn(HTMLMediaElement.prototype, "play")
            .mockRejectedValue(
                new DOMException("NotAllowedError", "NotAllowedError"),
            );

        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );

        await screen.findByText("شروع پخش");

        // A user gesture now allows play(); the tap starts the video locally.
        playSpy.mockResolvedValue();
        fireEvent.click(screen.getByText("شروع پخش"));

        expect(playSpy).toHaveBeenCalled();
        expect(mockSyncImmediate).not.toHaveBeenCalled();
        expect(mockSync).not.toHaveBeenCalled();
        expect(screen.queryByText("شروع پخش")).not.toBeInTheDocument();

        playSpy.mockRestore();
    });

    it("seek bar is a keyboard-operable slider for the host", () => {
        const seekState: PlaybackState = {
            isPlaying: false,
            positionSeconds: 10,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: "https://example.com/video.mp4",
            playbackMode: "direct" as PlaybackMode,
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
            receivedAt: Date.now() / 1000,
        };
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: seekState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl
            />,
        );

        const slider = screen.getByRole("slider", { name: "موقعیت پخش" });
        expect(slider).toHaveAttribute("aria-valuemin", "0");
        expect(slider).toHaveAttribute("aria-valuemax", "300");
        expect(slider).toHaveAttribute("aria-valuenow", "10");

        // ArrowRight seeks forward through the authoritative path.
        mockSyncImmediate.mockClear();
        fireEvent.keyDown(slider, { key: "ArrowRight" });
        expect(mockSyncImmediate).toHaveBeenCalledWith({
            positionSeconds: expect.any(Number),
        });
        const calledWith = mockSyncImmediate.mock.calls[0][0];
        expect(calledWith.positionSeconds).toBeGreaterThan(10);

        // Home seeks to the start.
        mockSyncImmediate.mockClear();
        fireEvent.keyDown(slider, { key: "Home" });
        expect(mockSyncImmediate).toHaveBeenCalledWith({
            positionSeconds: 0,
        });
    });

    it("seek bar is not focusable for guests", () => {
        const seekState: PlaybackState = {
            isPlaying: false,
            positionSeconds: 10,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: "https://example.com/video.mp4",
            playbackMode: "direct" as PlaybackMode,
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
            receivedAt: Date.now() / 1000,
        };
        vi.mocked(usePlaybackSync).mockReturnValue({
            state: seekState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        render(
            <VideoPlayer
                roomId={1}
                initialVideoUrl="https://example.com/video.mp4"
                canControl={false}
            />,
        );

        const slider = screen.getByRole("slider", { name: "موقعیت پخش" });
        expect(slider).toHaveAttribute("tabindex", "-1");

        mockSyncImmediate.mockClear();
        fireEvent.keyDown(slider, { key: "ArrowRight" });
        expect(mockSyncImmediate).not.toHaveBeenCalled();
    });
});
