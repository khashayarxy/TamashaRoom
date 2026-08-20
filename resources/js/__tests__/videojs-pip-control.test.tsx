import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { I18nProvider } from "@videojs/react";
import { MediaPiPControl } from "@/Components/Player/VideoJsPlayer";

const pipState = vi.hoisted(() => ({
    pip: false,
    pipAvailability: "available" as "available" | "unavailable" | "unsupported",
    togglePictureInPicture: vi.fn(),
}));

vi.mock("@videojs/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@videojs/react")>();
    return {
        ...actual,
        usePlayer: () => pipState,
    };
});

async function renderControl() {
    render(
        <I18nProvider locale="fa">
            <MediaPiPControl />
        </I18nProvider>,
    );
    // Flush the I18nProvider's lazy-translation microtasks inside act so the
    // post-mount state update is wrapped (no act() warning).
    await act(async () => {
        await Promise.resolve();
    });
}

describe("MediaPiPControl", () => {
    beforeEach(() => {
        pipState.pip = false;
        pipState.pipAvailability = "available";
        pipState.togglePictureInPicture.mockReset();
    });

    it("does not render when PiP is unavailable", async () => {
        pipState.pipAvailability = "unavailable";
        await renderControl();
        expect(
            screen.queryByRole("button", { name: /تصویر در تصویر/ }),
        ).not.toBeInTheDocument();
    });

    it("does not render when PiP is unsupported", async () => {
        pipState.pipAvailability = "unsupported";
        await renderControl();
        expect(
            screen.queryByRole("button", { name: /تصویر در تصویر/ }),
        ).not.toBeInTheDocument();
    });

    it("renders the enter-PiP button and toggles PiP on click", async () => {
        pipState.pipAvailability = "available";
        pipState.pip = false;
        await renderControl();

        const button = screen.getByRole("button", {
            name: "تصویر در تصویر",
        });
        expect(button).not.toHaveAttribute("data-pip");
        expect(button).toHaveAttribute("data-availability", "available");

        fireEvent.click(button);

        expect(pipState.togglePictureInPicture).toHaveBeenCalledTimes(1);
    });

    it("reflects the active PiP state with the exit label and data-pip", async () => {
        pipState.pipAvailability = "available";
        pipState.pip = true;
        await renderControl();

        const button = screen.getByRole("button", {
            name: "خروج از حالت تصویر در تصویر",
        });
        expect(button).toHaveAttribute("data-pip");
    });
});
