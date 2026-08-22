import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { I18nProvider } from "@videojs/react";
import { MediaBigPlay } from "@/Components/Player/VideoJsPlayer";

const playerState = vi.hoisted(() => ({
    paused: true,
    ended: false,
    error: null as unknown,
    play: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/api", () => ({ default: {} }));

vi.mock("@videojs/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@videojs/react")>();
    return {
        ...actual,
        // Honor selector calls (state slices) and the no-arg store call alike.
        usePlayer: (selector?: (s: typeof playerState) => unknown) =>
            selector ? selector(playerState) : playerState,
    };
});

async function renderOverlay() {
    const { container } = render(
        <I18nProvider locale="fa">
            <MediaBigPlay />
        </I18nProvider>,
    );
    await act(async () => {
        await Promise.resolve();
    });
    return container.querySelector<HTMLElement>(".media-big-play");
}

describe("MediaBigPlay", () => {
    beforeEach(() => {
        playerState.paused = true;
        playerState.ended = false;
        playerState.error = null;
    });

    it("shows a centered play affordance while paused", async () => {
        const overlay = await renderOverlay();

        const button = screen.getByRole("button", { name: "پخش" });
        expect(button).toBeInTheDocument();
        expect(overlay?.getAttribute("aria-hidden")).toBe("false");
        expect(overlay?.className).not.toContain("pointer-events-none");
    });

    it("hides (and defocuses) while playing", async () => {
        playerState.paused = false;
        const overlay = await renderOverlay();

        expect(overlay?.getAttribute("aria-hidden")).toBe("true");
        expect(overlay?.className).toContain("pointer-events-none");
        // aria-hidden content is intentionally inaccessible to role queries;
        // inspect the button directly.
        const button = overlay?.querySelector("button");
        expect(button?.getAttribute("aria-label")).toBe("پخش");
        expect(button?.getAttribute("tabindex")).toBe("-1");
    });

    it("hides when the video has ended (replay overlay owns that state)", async () => {
        playerState.ended = true;
        const overlay = await renderOverlay();

        expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    });

    it("hides while a media error is showing (error dialog owns that state)", async () => {
        playerState.error = new Error("boom");
        const overlay = await renderOverlay();

        expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    });
});
