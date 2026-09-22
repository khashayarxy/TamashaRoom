import { describe, it, expect } from "vitest";
import { applyEmbeddedSubtitle } from "@/lib/embedded-subtitles";

function stubVideo(
    tracks: Array<{ kind: string; language: string; mode: string }>,
) {
    return {
        textTracks: tracks.map((t) => ({ ...t })),
    };
}

describe("applyEmbeddedSubtitle", () => {
    it("shows the Persian track by language across code variants", () => {
        const video = stubVideo([
            { kind: "subtitles", language: "en", mode: "disabled" },
            { kind: "subtitles", language: "per", mode: "disabled" },
        ]);

        applyEmbeddedSubtitle(video, { language: "fa", index: 0 });

        expect(video.textTracks[0].mode).toBe("disabled");
        expect(video.textTracks[1].mode).toBe("showing");
    });

    it("falls back to nth track when languages are missing", () => {
        const video = stubVideo([
            { kind: "subtitles", language: "", mode: "disabled" },
            { kind: "subtitles", language: "", mode: "disabled" },
        ]);

        applyEmbeddedSubtitle(video, { language: null, index: 1 });

        expect(video.textTracks[0].mode).toBe("disabled");
        expect(video.textTracks[1].mode).toBe("showing");
    });

    it("clamps an out-of-range index to the last track", () => {
        const video = stubVideo([
            { kind: "subtitles", language: "", mode: "disabled" },
        ]);

        applyEmbeddedSubtitle(video, { language: null, index: 9 });

        expect(video.textTracks[0].mode).toBe("showing");
    });

    it("disables everything when selection is null", () => {
        const video = stubVideo([
            { kind: "subtitles", language: "en", mode: "showing" },
            { kind: "captions", language: "fa", mode: "showing" },
        ]);

        applyEmbeddedSubtitle(video, null);

        expect(video.textTracks.every((t) => t.mode === "disabled")).toBe(true);
    });

    it("ignores non-subtitle track kinds", () => {
        const video = stubVideo([
            { kind: "metadata", language: "en", mode: "disabled" },
        ]);

        applyEmbeddedSubtitle(video, { language: "en", index: 0 });

        expect(video.textTracks[0].mode).toBe("disabled");
    });

    it("tolerates a null video element", () => {
        expect(() =>
            applyEmbeddedSubtitle(null, { language: "fa", index: 0 }),
        ).not.toThrow();
    });
});
