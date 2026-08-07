import { describe, it, expect } from "vitest";
import { shouldPreservePositionOnSourceChange } from "@/lib/player-source";

describe("shouldPreservePositionOnSourceChange", () => {
    it("preserves when the transport falls back for the same video", () => {
        expect(
            shouldPreservePositionOnSourceChange({
                previousSrc: "/proxy/video/1",
                nextSrc: "https://example.com/video.mp4",
                previousVideoUrl: "https://example.com/video.mp4",
                nextVideoUrl: "https://example.com/video.mp4",
            }),
        ).toBe(true);
    });

    it("does not preserve on the initial load", () => {
        expect(
            shouldPreservePositionOnSourceChange({
                previousSrc: null,
                nextSrc: "/proxy/video/1",
                previousVideoUrl: null,
                nextVideoUrl: "https://example.com/video.mp4",
            }),
        ).toBe(false);
    });

    it("does not preserve when the video URL itself changes", () => {
        expect(
            shouldPreservePositionOnSourceChange({
                previousSrc: "https://example.com/video.mp4",
                nextSrc: "https://example.com/new-video.mp4",
                previousVideoUrl: "https://example.com/video.mp4",
                nextVideoUrl: "https://example.com/new-video.mp4",
            }),
        ).toBe(false);
    });

    it("does not preserve when the source is unchanged", () => {
        expect(
            shouldPreservePositionOnSourceChange({
                previousSrc: "https://example.com/video.mp4",
                nextSrc: "https://example.com/video.mp4",
                previousVideoUrl: "https://example.com/video.mp4",
                nextVideoUrl: "https://example.com/video.mp4",
            }),
        ).toBe(false);
    });

    it("does not preserve when the video is still unknown", () => {
        expect(
            shouldPreservePositionOnSourceChange({
                previousSrc: "/proxy/video/1",
                nextSrc: "https://example.com/video.mp4",
                previousVideoUrl: "https://example.com/video.mp4",
                nextVideoUrl: null,
            }),
        ).toBe(false);
    });
});
