import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSubtitles } from "@/Hooks/use-subtitles";
import { createFakeEcho, type FakeEcho } from "./helpers/fake-echo";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

const echoHolder = vi.hoisted(() => ({ instance: null as FakeEcho | null }));

vi.mock("@/lib/api", () => ({
    default: {
        get: (...args: unknown[]) => mockGet(...args),
        post: (...args: unknown[]) => mockPost(...args),
        delete: (...args: unknown[]) => mockDelete(...args),
    },
}));

vi.mock("@/lib/echo", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/echo")>();
    return {
        ...actual,
        getEcho: () => echoHolder.instance,
    };
});

function uploadTrack(id: number) {
    return {
        id,
        kind: "upload",
        track_index: null,
        label: `Track ${id}`,
        language: "fa",
        original_extension: "vtt",
        created_at: "2026-08-04T00:00:00.000000Z",
    };
}

function embeddedTrack(id: number, language: string, index: number) {
    return {
        id,
        kind: "embedded",
        track_index: index,
        label: `Embedded (${language.toUpperCase()})`,
        language,
        original_extension: "mkv",
        created_at: "2026-08-04T00:00:00.000000Z",
    };
}

describe("useSubtitles embedded tracks", () => {
    let fakeEcho: FakeEcho;

    beforeEach(() => {
        vi.clearAllMocks();
        fakeEcho = createFakeEcho();
        echoHolder.instance = fakeEcho;
        mockGet.mockImplementation((url: unknown) => {
            if (typeof url === "string" && url.endsWith("/cues")) {
                return Promise.resolve({ data: { cues: [] } });
            }
            return Promise.resolve({ data: [] });
        });
        localStorage.clear();
    });

    afterEach(() => {
        echoHolder.instance = null;
    });

    it("skips the cues fetch for embedded tracks and exposes the selection", async () => {
        mockGet.mockImplementation((url: unknown) => {
            if (typeof url === "string" && url.endsWith("/cues")) {
                return Promise.reject(new Error("must not fetch cues"));
            }
            return Promise.resolve({
                data: [embeddedTrack(7, "per", 0)],
            });
        });

        const { result } = renderHook(() => useSubtitles(1, 7));

        await waitFor(() => {
            expect(result.current.embeddedSelection).toEqual({
                language: "per",
                index: 0,
            });
        });
        // No cues fetch was attempted (would have rejected); no error set.
        expect(result.current.subError).toBeNull();
        expect(result.current.cues).toEqual([]);
    });

    it("applies broadcast room defaults only when following the default", async () => {
        mockGet.mockResolvedValue({
            data: [uploadTrack(1), uploadTrack(2)],
        });

        const { result } = renderHook(() => useSubtitles(1, 1));
        await waitFor(() => {
            expect(result.current.tracks).toHaveLength(2);
        });
        expect(result.current.activeTrackId).toBe(1);

        await act(async () => {
            fakeEcho.emit(".subtitle.default.changed", {
                default_track_id: 2,
            });
        });

        await waitFor(() => {
            expect(result.current.activeTrackId).toBe(2);
        });
    });

    it("keeps a local override when the room default broadcasts", async () => {
        mockGet.mockResolvedValue({
            data: [uploadTrack(1), uploadTrack(2)],
        });

        const { result } = renderHook(() => useSubtitles(1, 1));
        await waitFor(() => {
            expect(result.current.tracks).toHaveLength(2);
        });

        await act(async () => {
            result.current.selectTrack(2);
        });
        expect(result.current.activeTrackId).toBe(2);

        await act(async () => {
            fakeEcho.emit(".subtitle.default.changed", {
                default_track_id: 1,
            });
        });
        await new Promise((r) => setTimeout(r, 50));

        // Override wins: still on the locally chosen track.
        expect(result.current.activeTrackId).toBe(2);
        // ...but the room default itself updated.
        expect(result.current.roomDefaultId).toBe(1);
    });

    it("selecting a track never touches the network (override stays local)", async () => {
        mockGet.mockResolvedValue({ data: [uploadTrack(1)] });

        const { result } = renderHook(() => useSubtitles(1, null));
        await waitFor(() => {
            expect(result.current.tracks).toHaveLength(1);
        });

        mockPost.mockClear();
        await act(async () => {
            result.current.selectTrack(1);
        });

        expect(result.current.activeTrackId).toBe(1);
        expect(mockPost).not.toHaveBeenCalled();
        expect(localStorage.getItem("tamasharoom-active-track-1")).toBe("1");
    });
});
