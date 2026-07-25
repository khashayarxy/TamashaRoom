import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
    SubtitleOverlay,
    type SubtitleCue,
    type SubtitleSettings,
} from "@/Components/composite/subtitle-overlay";

const DEFAULT_SETTINGS: SubtitleSettings = {
    size: 20,
    color: "#ffffff",
    enabled: true,
    bgOpacity: 40,
    position: "bottom",
};

function createMockVideo(currentTime = 0): HTMLVideoElement {
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", {
        value: currentTime,
        writable: true,
    });
    return video;
}

describe("SubtitleOverlay", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it("renders error state", () => {
        const ref = { current: createMockVideo() };
        render(
            <SubtitleOverlay
                videoRef={ref}
                cues={[]}
                settings={DEFAULT_SETTINGS}
                error="Failed to load"
            />,
        );
        expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });

    it("renders loading state", () => {
        const ref = { current: createMockVideo() };
        render(
            <SubtitleOverlay
                videoRef={ref}
                cues={[]}
                settings={DEFAULT_SETTINGS}
                loading
            />,
        );
        expect(
            screen.getByText("در حال بارگذاری زیرنویس..."),
        ).toBeInTheDocument();
    });

    it("renders nothing when disabled", () => {
        const ref = { current: createMockVideo() };
        const { container } = render(
            <SubtitleOverlay
                videoRef={ref}
                cues={[]}
                settings={{ ...DEFAULT_SETTINGS, enabled: false }}
            />,
        );
        expect(container.innerHTML).toBe("");
    });

    it("renders nothing when no cues provided", () => {
        const ref = { current: createMockVideo() };
        const { container } = render(
            <SubtitleOverlay
                videoRef={ref}
                cues={[]}
                settings={DEFAULT_SETTINGS}
            />,
        );
        expect(container.innerHTML).toBe("");
    });

    it("renders active cue text when video time matches", () => {
        const ref = { current: createMockVideo(2.5) };
        const cues: SubtitleCue[] = [
            { start: 1000, end: 4000, text: "Active cue" },
        ];

        render(
            <SubtitleOverlay
                videoRef={ref}
                cues={cues}
                settings={DEFAULT_SETTINGS}
            />,
        );

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(screen.getByText("Active cue")).toBeInTheDocument();
    });

    it("renders nothing when video time does not match any cue", () => {
        const ref = { current: createMockVideo(5) };
        const cues: SubtitleCue[] = [
            { start: 1000, end: 4000, text: "Earlier cue" },
        ];

        const { container } = render(
            <SubtitleOverlay
                videoRef={ref}
                cues={cues}
                settings={DEFAULT_SETTINGS}
            />,
        );

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(container.innerHTML).toBe("");
    });

    it("renders nothing when videoRef is null", () => {
        const ref = { current: null };
        const cues: SubtitleCue[] = [
            { start: 1000, end: 4000, text: "Should not show" },
        ];

        const { container } = render(
            <SubtitleOverlay
                videoRef={ref}
                cues={cues}
                settings={DEFAULT_SETTINGS}
            />,
        );
        expect(container.innerHTML).toBe("");
    });
});
