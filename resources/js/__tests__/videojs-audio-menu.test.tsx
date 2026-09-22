import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@videojs/react";
import { MediaAudioMenu } from "@/Components/Player/VideoJsPlayer";

interface MockAudioOption {
    value: string;
    label: string;
    disabled: boolean;
}

const audioState = vi.hoisted(() => ({
    hookReturn: null as null | {
        state: { availability: string };
        value: string;
        options: MockAudioOption[];
        setValue: (value: string) => void;
    },
}));

const apiMocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
}));

vi.mock("@videojs/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@videojs/react")>();
    return {
        ...actual,
        useAudioTrackOptions: () => audioState.hookReturn,
    };
});

vi.mock("@/lib/api", () => ({
    default: {
        get: (...args: unknown[]) => apiMocks.get(...args),
        post: (...args: unknown[]) => apiMocks.post(...args),
        patch: (...args: unknown[]) => apiMocks.patch(...args),
        put: (...args: unknown[]) => apiMocks.put(...args),
        delete: (...args: unknown[]) => apiMocks.delete(...args),
    },
}));

function twoTracks() {
    audioState.hookReturn = {
        state: { availability: "available" },
        value: "0",
        options: [
            { value: "0", label: "English", disabled: false },
            { value: "1", label: "فارسی", disabled: false },
        ],
        setValue: vi.fn(),
    };
}

async function renderMenu() {
    const result = render(
        <I18nProvider locale="fa">
            <MediaAudioMenu />
        </I18nProvider>,
    );
    // Flush the I18nProvider's lazy-translation microtasks inside act so the
    // post-mount state update is wrapped (no act() warning).
    await act(async () => {
        await Promise.resolve();
    });
    return result;
}

describe("MediaAudioMenu", () => {
    beforeEach(() => {
        audioState.hookReturn = null;
        vi.clearAllMocks();
    });

    it("renders nothing when the audio track feature is unconfigured", async () => {
        audioState.hookReturn = null;
        await renderMenu();
        expect(document.body.textContent ?? "").not.toContain("English");
    });

    it("renders nothing when availability is not available (e.g. single track, or browsers where no list is exposed: Chromium/Firefox progressive, any player bypassing the HLS adapter)", async () => {
        twoTracks();
        if (audioState.hookReturn) {
            audioState.hookReturn.state.availability = "unavailable";
        }
        await renderMenu();
        expect(document.body.textContent ?? "").not.toContain("English");
        expect(document.body.textContent ?? "").not.toContain("فارسی");
    });

    it("lists labeled options and switches locally without any network traffic", async () => {
        twoTracks();
        const { container } = await renderMenu();

        // Open the submenu. Note: jsdom lacks popover showPopover, so the
        // opened panel stays display:none and Testing Library's
        // role-queries (which skip hidden elements) can't see the items —
        // raw DOM queries can. fireEvent is used because Radix toggling is
        // flaky under userEvent's pointer sequence in jsdom.
        fireEvent.click(screen.getByText("English"));
        const items = container.querySelectorAll('[role="menuitemradio"]');
        expect(items).toHaveLength(2);
        expect(items[0].textContent).toContain("English");
        expect(items[1].textContent).toContain("فارسی");

        fireEvent.click(items[1]);
        expect(audioState.hookReturn?.setValue).toHaveBeenCalledWith("1");

        // Switching is a local media-element flip: no API, no sync PATCH.
        expect(apiMocks.get).not.toHaveBeenCalled();
        expect(apiMocks.post).not.toHaveBeenCalled();
        expect(apiMocks.patch).not.toHaveBeenCalled();
        expect(apiMocks.put).not.toHaveBeenCalled();
        expect(apiMocks.delete).not.toHaveBeenCalled();
    });
});
