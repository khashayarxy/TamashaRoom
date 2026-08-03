import { describe, it, expect, beforeEach } from "vitest";
import {
    loadActiveTrackId,
    saveActiveTrackId,
    clearActiveTrackChoice,
} from "@/lib/subtitle-selection";

describe("subtitle-selection localStorage helper", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("returns undefined when no choice is stored", () => {
        expect(loadActiveTrackId(1)).toBeUndefined();
    });

    it("returns a saved track id for the given room", () => {
        saveActiveTrackId(1, 42);
        saveActiveTrackId(2, 7);
        expect(loadActiveTrackId(1)).toBe(42);
        expect(loadActiveTrackId(2)).toBe(7);
    });

    it("persists a null choice (no subtitles) distinctly from no choice", () => {
        saveActiveTrackId(1, null);
        expect(loadActiveTrackId(1)).toBeNull();
        expect(loadActiveTrackId(2)).toBeUndefined();
    });

    it("clears only the given room's choice", () => {
        saveActiveTrackId(1, 42);
        saveActiveTrackId(2, 7);
        clearActiveTrackChoice(1);
        expect(loadActiveTrackId(1)).toBeUndefined();
        expect(loadActiveTrackId(2)).toBe(7);
    });

    it("is safe to clear when nothing is stored", () => {
        expect(() => clearActiveTrackChoice(99)).not.toThrow();
    });
});
