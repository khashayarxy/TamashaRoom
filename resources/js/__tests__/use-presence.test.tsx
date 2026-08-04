import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePresence, type PresenceMember } from "@/Hooks/use-presence";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("@/lib/api", () => ({
    default: {
        get: (...args: unknown[]) => mockGet(...args),
        post: (...args: unknown[]) => mockPost(...args),
    },
}));

function member(
    userId: number,
    status: PresenceMember["presence_status"],
    name = `user${userId}`,
): PresenceMember {
    return {
        id: userId,
        user_id: userId,
        name,
        presence_status: status,
        last_seen_at: new Date().toISOString(),
        disconnected_at: null,
        joined_at: new Date().toISOString(),
        is_owner: userId === 1,
    };
}

describe("usePresence moments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockGet.mockResolvedValue({ data: [member(1, "online")] });
        mockPost.mockResolvedValue({ data: { heartbeat_version: 1 } });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function flushInitial() {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
    }

    async function advancePoll() {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
    }

    it("does not create join messages on the initial snapshot", async () => {
        const { result } = renderHook(() => usePresence(1));
        await flushInitial();

        expect(result.current.members).toHaveLength(1);
        expect(result.current.moments).toEqual([]);
    });

    it("creates one join moment when a member becomes online", async () => {
        const { result } = renderHook(() => usePresence(1));
        await flushInitial();

        mockGet.mockResolvedValue({
            data: [member(1, "online"), member(2, "online", "سارا")],
        });
        await advancePoll();

        expect(result.current.moments).toHaveLength(1);
        expect(result.current.moments[0]).toMatchObject({
            type: "join",
            name: "سارا",
            user_id: 2,
        });
    });

    it("creates one leave moment when a member goes offline", async () => {
        const { result } = renderHook(() => usePresence(1));
        await flushInitial();

        mockGet.mockResolvedValue({
            data: [member(1, "online"), member(2, "online", "سارا")],
        });
        await advancePoll();

        mockGet.mockResolvedValue({
            data: [member(1, "online"), member(2, "offline", "سارا")],
        });
        await advancePoll();

        const moments = result.current.moments;
        expect(moments).toHaveLength(2);
        expect(moments[0]).toMatchObject({ type: "join", user_id: 2 });
        expect(moments[1]).toMatchObject({ type: "leave", user_id: 2 });
    });

    it("does not duplicate moments on repeated polling", async () => {
        const { result } = renderHook(() => usePresence(1));
        await flushInitial();

        mockGet.mockResolvedValue({
            data: [member(1, "online"), member(2, "online", "سارا")],
        });
        await advancePoll();
        await advancePoll();
        await advancePoll();

        expect(result.current.moments).toHaveLength(1);
    });

    it("does not treat online<->away as join/leave", async () => {
        const { result } = renderHook(() => usePresence(1));
        await flushInitial();

        mockGet.mockResolvedValue({
            data: [member(1, "online"), member(2, "away", "سارا")],
        });
        await advancePoll();

        mockGet.mockResolvedValue({
            data: [member(1, "online"), member(2, "online", "سارا")],
        });
        await advancePoll();

        expect(result.current.moments).toEqual([]);
    });

    it("resets the baseline when the room changes, so no stale moments", async () => {
        const { result, rerender } = renderHook(
            ({ roomId }: { roomId: number }) => usePresence(roomId),
            { initialProps: { roomId: 1 } },
        );
        await flushInitial();

        mockGet.mockResolvedValue({
            data: [member(1, "online"), member(9, "online", "room2")],
        });
        rerender({ roomId: 2 });
        await advancePoll();

        expect(result.current.moments).toEqual([]);
        expect(result.current.members).toHaveLength(2);
    });

    it("keeps the baseline unchanged on a failed poll, so retry does not duplicate", async () => {
        const { result } = renderHook(() => usePresence(1));
        await flushInitial();

        mockGet.mockResolvedValue({
            data: [member(1, "online"), member(2, "online", "سارا")],
        });
        await advancePoll();

        mockGet.mockRejectedValue(new Error("network"));
        await advancePoll();

        mockGet.mockResolvedValue({
            data: [member(1, "online"), member(2, "online", "سارا")],
        });
        await advancePoll();

        expect(result.current.moments).toHaveLength(1);
    });

    it("calls onRemoved when the presence poll returns 404 (kicked)", async () => {
        const onRemoved = vi.fn();
        const { result } = renderHook(() => usePresence(1, { onRemoved }));
        await flushInitial();

        mockGet.mockRejectedValue({
            response: { status: 404 },
        });
        await advancePoll();

        expect(onRemoved).toHaveBeenCalledTimes(1);
        expect(result.current.connected).toBe(false);
    });

    it("calls onRemoved once even if multiple polls return 404", async () => {
        const onRemoved = vi.fn();
        renderHook(() => usePresence(1, { onRemoved }));
        await flushInitial();

        mockGet.mockRejectedValue({
            response: { status: 403 },
        });
        await advancePoll();
        await advancePoll();

        expect(onRemoved).toHaveBeenCalledTimes(1);
    });

    it("does not treat a transient network error as removal", async () => {
        const onRemoved = vi.fn();
        renderHook(() => usePresence(1, { onRemoved }));
        await flushInitial();

        mockGet.mockRejectedValue(new Error("network"));
        await advancePoll();

        expect(onRemoved).not.toHaveBeenCalled();
    });

    it("uses heartbeat success as the single source of connected state", async () => {
        const { result } = renderHook(() => usePresence(1));
        await flushInitial();

        // Heartbeat ran on mount and succeeded.
        expect(result.current.connected).toBe(true);

        // A failed poll alone must not flip connected false (heartbeat owns it).
        mockGet.mockRejectedValue(new Error("network"));
        await advancePoll();
        expect(result.current.connected).toBe(true);

        // A heartbeat failure flips connected false.
        mockPost.mockRejectedValue(new Error("network"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30000);
        });
        expect(result.current.connected).toBe(false);
    });

    it("heartbeat failure flips connected to false", async () => {
        const { result } = renderHook(() => usePresence(1));
        await flushInitial();

        expect(result.current.connected).toBe(true);

        mockPost.mockRejectedValue(new Error("network"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30000);
        });
        expect(result.current.connected).toBe(false);
    });

    it("sends a leave beacon with the CSRF token in the body on unmount", async () => {
        document.head.innerHTML =
            '<meta name="csrf-token" content="test-csrf-token">';
        const sendBeacon = vi.fn<
            (_url: string, _data?: BodyInit | null) => boolean
        >(() => true);
        Object.defineProperty(navigator, "sendBeacon", {
            configurable: true,
            value: sendBeacon,
        });

        const { unmount } = renderHook(() => usePresence(1));
        await flushInitial();

        unmount();

        expect(sendBeacon).toHaveBeenCalledTimes(1);
        const [url, body] = sendBeacon.mock.calls[0];
        expect(url).toBe("/presence/1/leave");
        expect(body).toBeInstanceOf(FormData);
        expect(body).not.toBeNull();
        expect((body as FormData).get("_token")).toBe("test-csrf-token");

        Object.defineProperty(navigator, "sendBeacon", {
            configurable: true,
            value: undefined,
        });
    });
});
