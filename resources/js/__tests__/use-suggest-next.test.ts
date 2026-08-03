import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSuggestNext } from "@/Hooks/use-suggest-next";
import { toast } from "@/Hooks/use-toast";

const mockPost = vi.fn();

vi.mock("@/lib/api", () => ({
    default: {
        post: (...args: unknown[]) => mockPost(...args),
    },
}));

vi.mock("@/Hooks/use-toast", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

describe("useSuggestNext", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("posts a suggestion through the existing chat mechanism", async () => {
        mockPost.mockResolvedValue({ data: { id: 1 } });

        const { result } = renderHook(() => useSuggestNext(7));

        await act(async () => {
            await result.current.suggestNext();
        });

        expect(mockPost).toHaveBeenCalledWith("/chat/7/messages", {
            body: expect.stringContaining("پیشنهاد"),
        });
    });

    it("shows an error toast when the chat post fails", async () => {
        mockPost.mockRejectedValue(new Error("network"));

        const { result } = renderHook(() => useSuggestNext(7));

        await act(async () => {
            await result.current.suggestNext();
        });

        expect(toast.error).toHaveBeenCalledWith("خطا در ارسال پیشنهاد");
    });
});
