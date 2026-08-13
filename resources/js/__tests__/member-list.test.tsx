import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberList } from "@/Components/composite/member-list";
import type { PresenceMember } from "@/Hooks/use-presence";

const mockPost = vi.fn();

vi.mock("@/lib/api", () => ({
    default: {
        post: (...args: unknown[]) => mockPost(...args),
    },
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

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

describe("MemberList", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders member names", () => {
        const members = [
            makeMember({ id: 1, user_id: 1, name: "Alice" }),
            makeMember({ id: 2, user_id: 2, name: "Bob" }),
        ];
        render(
            <MemberList members={members} roomId={1} ownerId={1} connected />,
        );
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("shows correct member count", () => {
        const members = [
            makeMember({ id: 1, user_id: 1, name: "Alice" }),
            makeMember({ id: 2, user_id: 2, name: "Bob" }),
        ];
        render(
            <MemberList members={members} roomId={1} ownerId={1} connected />,
        );
        expect(screen.getByText("اعضای اتاق (2)")).toBeInTheDocument();
    });

    it("shows online count", () => {
        const members = [
            makeMember({
                id: 1,
                user_id: 1,
                name: "Alice",
                presence_status: "online",
            }),
            makeMember({
                id: 2,
                user_id: 2,
                name: "Bob",
                presence_status: "offline",
            }),
        ];
        render(
            <MemberList members={members} roomId={1} ownerId={1} connected />,
        );
        expect(screen.getByText("1 آنلاین")).toBeInTheDocument();
    });

    it("shows disconnected state", () => {
        const members = [makeMember({ id: 1, user_id: 1, name: "Alice" })];
        render(
            <MemberList
                members={members}
                roomId={1}
                ownerId={1}
                connected={false}
            />,
        );
        expect(screen.getByText("قطع ارتباط")).toBeInTheDocument();
    });

    it("shows kick and transfer buttons for owner on non-owner members", () => {
        const members = [
            makeMember({ id: 1, user_id: 1, name: "Owner", is_owner: true }),
            makeMember({ id: 2, user_id: 2, name: "Member" }),
        ];
        render(
            <MemberList
                members={members}
                roomId={1}
                ownerId={1}
                currentUserId={1}
                connected
            />,
        );

        expect(screen.getByTitle("انتقال مالکیت")).toBeInTheDocument();
        expect(screen.getByTitle("حذف از اتاق")).toBeInTheDocument();
    });

    it("does not show action buttons for non-owner viewer", () => {
        const members = [
            makeMember({ id: 1, user_id: 1, name: "Owner", is_owner: true }),
            makeMember({ id: 2, user_id: 2, name: "Member" }),
        ];
        render(
            <MemberList
                members={members}
                roomId={1}
                ownerId={1}
                currentUserId={2}
                connected
            />,
        );

        expect(screen.queryByTitle("انتقال مالکیت")).not.toBeInTheDocument();
        expect(screen.queryByTitle("حذف از اتاق")).not.toBeInTheDocument();
    });

    it("shows crown icon on owner", () => {
        const members = [
            makeMember({ id: 1, user_id: 1, name: "Owner", is_owner: true }),
        ];
        render(
            <MemberList members={members} roomId={1} ownerId={1} connected />,
        );
        expect(screen.getByText("Owner")).toBeInTheDocument();
    });

    it("shows member count header and online status", () => {
        const members = [
            makeMember({ id: 1, user_id: 1, name: "Owner", is_owner: true }),
        ];
        render(
            <MemberList
                members={members}
                roomId={1}
                ownerId={1}
                currentUserId={1}
                connected
            />,
        );
        expect(screen.getByText("اعضای اتاق (1)")).toBeInTheDocument();
        expect(screen.getByText("1 آنلاین")).toBeInTheDocument();
    });

    it("calls onKick after kick confirmation", async () => {
        const user = userEvent.setup();
        const onKick = vi.fn();
        mockPost.mockResolvedValue({ data: { status: "ok" } });

        const members = [
            makeMember({ id: 1, user_id: 1, name: "Owner", is_owner: true }),
            makeMember({ id: 2, user_id: 2, name: "Target" }),
        ];
        render(
            <MemberList
                members={members}
                roomId={1}
                ownerId={1}
                currentUserId={1}
                onKick={onKick}
                connected
            />,
        );

        await user.click(screen.getByTitle("حذف از اتاق"));

        expect(
            screen.getByRole("heading", { name: /حذف Target/ }),
        ).toBeInTheDocument();

        await user.click(screen.getByText("حذف"));

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith("/rooms/1/kick/2");
        });
        expect(onKick).toHaveBeenCalledWith(2);
    });

    it("calls onTransfer after transfer confirmation", async () => {
        const user = userEvent.setup();
        const onTransfer = vi.fn();
        mockPost.mockResolvedValue({ data: { status: "ok" } });

        const members = [
            makeMember({ id: 1, user_id: 1, name: "Owner", is_owner: true }),
            makeMember({ id: 2, user_id: 2, name: "Target" }),
        ];
        render(
            <MemberList
                members={members}
                roomId={1}
                ownerId={1}
                currentUserId={1}
                onTransfer={onTransfer}
                connected
            />,
        );

        await user.click(screen.getByTitle("انتقال مالکیت"));

        expect(
            screen.getByRole("heading", { name: /انتقال مالکیت/ }),
        ).toBeInTheDocument();

        const confirmButtons = screen.getAllByRole("button", {
            name: "انتقال مالکیت",
        });
        await user.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith("/rooms/1/transfer/2");
        });
        expect(onTransfer).toHaveBeenCalledWith(2);
    });

    it("does not call onTransfer when the transfer request fails", async () => {
        const user = userEvent.setup();
        const onTransfer = vi.fn();
        mockPost.mockRejectedValue(new Error("network"));

        const members = [
            makeMember({ id: 1, user_id: 1, name: "Owner", is_owner: true }),
            makeMember({ id: 2, user_id: 2, name: "Target" }),
        ];
        render(
            <MemberList
                members={members}
                roomId={1}
                ownerId={1}
                currentUserId={1}
                onTransfer={onTransfer}
                connected
            />,
        );

        await user.click(screen.getByTitle("انتقال مالکیت"));

        const confirmButtons = screen.getAllByRole("button", {
            name: "انتقال مالکیت",
        });
        await user.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith("/rooms/1/transfer/2");
        });
        expect(onTransfer).not.toHaveBeenCalled();
    });

    it("shows last seen for offline members", () => {
        const members = [
            makeMember({
                id: 1,
                user_id: 1,
                name: "OfflineUser",
                presence_status: "offline",
                last_seen_at: new Date(Date.now() - 3600000).toISOString(),
            }),
        ];
        render(
            <MemberList members={members} roomId={1} ownerId={1} connected />,
        );
        expect(screen.getByText(/آخرین بازدید/)).toBeInTheDocument();
    });

    it("renders status indicator colors", () => {
        const members = [
            makeMember({
                id: 1,
                user_id: 1,
                name: "Online",
                presence_status: "online",
            }),
            makeMember({
                id: 2,
                user_id: 2,
                name: "Away",
                presence_status: "away",
            }),
            makeMember({
                id: 3,
                user_id: 3,
                name: "Offline",
                presence_status: "offline",
            }),
        ];
        const { container } = render(
            <MemberList members={members} roomId={1} ownerId={1} connected />,
        );

        const indicators = container.querySelectorAll(".h-2\\.5");
        expect(indicators).toHaveLength(3);
    });
});
