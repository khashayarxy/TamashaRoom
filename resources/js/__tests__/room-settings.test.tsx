import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoomSettingsDialog } from "@/Components/composite/room-settings";

const mockOnUpdate = vi.fn();

vi.mock("@/lib/api", () => ({
    default: { post: vi.fn(), patch: vi.fn() },
}));

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

function makeRoom(overrides: Partial<{ is_locked: boolean }> = {}) {
    return {
        id: 1,
        name: "اتاق تست",
        invite_code: "ABC123",
        is_locked: false,
        ...overrides,
    };
}

describe("RoomSettingsDialog lock warning", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows the lock-implication warning while the room is locked", () => {
        render(
            <RoomSettingsDialog
                open
                onClose={() => {}}
                room={makeRoom({ is_locked: true })}
                onUpdate={mockOnUpdate}
            />,
        );

        expect(
            screen.getByText(
                "تا زمانی که اتاق قفل است، هیچ‌کس نمی‌تواند با لینک یا کد وارد اتاق شود.",
            ),
        ).toBeInTheDocument();
    });

    it("hides the warning while the room is unlocked", () => {
        render(
            <RoomSettingsDialog
                open
                onClose={() => {}}
                room={makeRoom({ is_locked: false })}
                onUpdate={mockOnUpdate}
            />,
        );

        expect(screen.queryByRole("note")).not.toBeInTheDocument();
    });
});
