import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRoomOwnership } from "@/Hooks/use-room-ownership";
import type { PresenceMember } from "@/Hooks/use-presence";

function makeMember(overrides: Partial<PresenceMember> = {}): PresenceMember {
    return {
        id: overrides.id ?? 1,
        user_id: overrides.user_id ?? 1,
        name: overrides.name ?? "User",
        presence_status: overrides.presence_status ?? "online",
        is_owner: overrides.is_owner ?? false,
        last_seen_at: overrides.last_seen_at ?? new Date().toISOString(),
        disconnected_at: overrides.disconnected_at ?? null,
        joined_at: overrides.joined_at ?? new Date().toISOString(),
    };
}

describe("useRoomOwnership", () => {
    it("reports the current user as owner when they are the initial owner", () => {
        const { result } = renderHook(() =>
            useRoomOwnership({
                initialOwnerId: 1,
                currentUserId: 1,
                presenceMembers: [],
            }),
        );

        expect(result.current.isOwner).toBe(true);
        expect(result.current.ownerId).toBe(1);
    });

    it("reports a non-owner user as non-owner", () => {
        const { result } = renderHook(() =>
            useRoomOwnership({
                initialOwnerId: 1,
                currentUserId: 2,
                presenceMembers: [],
            }),
        );

        expect(result.current.isOwner).toBe(false);
        expect(result.current.ownerId).toBe(1);
    });

    it("loses ownership immediately after transferring it away", async () => {
        const { result } = renderHook(() =>
            useRoomOwnership({
                initialOwnerId: 1,
                currentUserId: 1,
                presenceMembers: [],
            }),
        );

        expect(result.current.isOwner).toBe(true);

        act(() => {
            result.current.transferOwnership(2);
        });

        await waitFor(() => {
            expect(result.current.isOwner).toBe(false);
            expect(result.current.ownerId).toBe(2);
        });
    });

    it("adopts presence-reported ownership for the new owner", async () => {
        const { result, rerender } = renderHook(
            ({ presence }) =>
                useRoomOwnership({
                    initialOwnerId: 1,
                    currentUserId: 2,
                    presenceMembers: presence,
                }),
            { initialProps: { presence: [] as PresenceMember[] } },
        );

        expect(result.current.isOwner).toBe(false);

        rerender({ presence: [makeMember({ user_id: 2, is_owner: true })] });

        await waitFor(() => {
            expect(result.current.isOwner).toBe(true);
            expect(result.current.ownerId).toBe(2);
        });
    });

    it("keeps stale presence from reverting a just-performed transfer", async () => {
        const { result } = renderHook(() =>
            useRoomOwnership({
                initialOwnerId: 1,
                currentUserId: 1,
                presenceMembers: [makeMember({ user_id: 1, is_owner: true })],
            }),
        );

        expect(result.current.isOwner).toBe(true);

        act(() => {
            result.current.transferOwnership(2);
        });

        await waitFor(() => {
            expect(result.current.isOwner).toBe(false);
            expect(result.current.ownerId).toBe(2);
        });
    });
});
