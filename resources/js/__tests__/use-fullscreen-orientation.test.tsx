import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFullscreenOrientationLock } from "@/Hooks/use-fullscreen-orientation";

const playerState = vi.hoisted(() => ({ fullscreen: false }));

vi.mock("@videojs/react", () => ({
    usePlayer: (selector: (s: { fullscreen: boolean }) => unknown) =>
        selector(playerState),
}));

function installOrientation(
    orientation:
        { lock?: () => Promise<void>; unlock?: () => void } | undefined,
) {
    Object.defineProperty(window.screen, "orientation", {
        configurable: true,
        value: orientation,
    });
}

describe("useFullscreenOrientationLock", () => {
    beforeEach(() => {
        playerState.fullscreen = false;
    });

    afterEach(() => {
        installOrientation(undefined);
    });

    it("does not lock while not fullscreen", () => {
        const lock = vi.fn(() => Promise.resolve());
        const unlock = vi.fn();
        installOrientation({ lock, unlock });

        renderHook(() => useFullscreenOrientationLock());

        expect(lock).not.toHaveBeenCalled();
        expect(unlock).not.toHaveBeenCalled();
    });

    it("locks to landscape on fullscreen and releases on exit", async () => {
        const lock = vi.fn(() => Promise.resolve());
        const unlock = vi.fn();
        installOrientation({ lock, unlock });

        const { rerender } = renderHook(() => useFullscreenOrientationLock());

        playerState.fullscreen = true;
        rerender();

        expect(lock).toHaveBeenCalledWith("landscape");

        playerState.fullscreen = false;
        rerender();

        expect(unlock).toHaveBeenCalled();
    });

    it("swallows lock rejections (unsupported platform)", async () => {
        const lock = vi.fn(() => Promise.reject(new Error("NotSupported")));
        const unlock = vi.fn();
        installOrientation({ lock, unlock });

        const { rerender } = renderHook(() => useFullscreenOrientationLock());

        playerState.fullscreen = true;
        rerender();

        // Drain microtasks — a floating rejection here would fail the test.
        await act(async () => {
            await Promise.resolve();
        });

        expect(lock).toHaveBeenCalled();

        playerState.fullscreen = false;
        rerender();

        expect(unlock).toHaveBeenCalled();
    });

    it("is a no-op when screen.orientation is missing (iOS Safari)", () => {
        installOrientation(undefined);

        const { rerender } = renderHook(() => useFullscreenOrientationLock());

        playerState.fullscreen = true;
        expect(() => rerender()).not.toThrow();
    });

    it("is a no-op when lock is not a function", () => {
        const unlock = vi.fn();
        installOrientation({ unlock });

        const { rerender } = renderHook(() => useFullscreenOrientationLock());

        playerState.fullscreen = true;
        expect(() => rerender()).not.toThrow();
        expect(unlock).not.toHaveBeenCalled();
    });
});
