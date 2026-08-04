import { beforeEach, describe, expect, it, vi } from "vitest";

describe("useThemeStore initialization applies the theme class to <html>", () => {
    beforeEach(() => {
        vi.resetModules();
        document.documentElement.classList.remove("dark");
        localStorage.removeItem("theme");
    });

    it("applies the dark class on first load when no preference is stored", async () => {
        const { useThemeStore } = await import("@/stores/theme");
        expect(useThemeStore.getState().dark).toBe(true);
        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("applies the light class when a light preference is stored", async () => {
        localStorage.setItem("theme", "light");
        const { useThemeStore } = await import("@/stores/theme");
        expect(useThemeStore.getState().dark).toBe(false);
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("applies the dark class when a dark preference is stored", async () => {
        localStorage.setItem("theme", "dark");
        const { useThemeStore } = await import("@/stores/theme");
        expect(useThemeStore.getState().dark).toBe(true);
        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("a single toggle from the initial default state is immediately visible", async () => {
        const { useThemeStore } = await import("@/stores/theme");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        useThemeStore.getState().toggle();
        expect(useThemeStore.getState().dark).toBe(false);
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
});
