import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RoomCard, type RoomCardRoom } from "@/Components/composite/room-card";

vi.mock("@inertiajs/react", () => ({
    Link: ({
        href,
        children,
        "aria-label": ariaLabel,
    }: {
        href: string;
        children?: React.ReactNode;
        "aria-label"?: string;
    }) => (
        <a href={href} aria-label={ariaLabel}>
            {children}
        </a>
    ),
}));

globalThis.route = ((name: string, params?: unknown) =>
    `/__route/${name}/${String(params ?? "")}`) as never;

const baseRoom: RoomCardRoom = {
    id: 1,
    name: "فیلم شب جمعه",
    invite_code: "ABC123XYZ789",
    owner: { id: 1, name: "آرش" },
    members_count: 3,
    max_members: 10,
    is_playing: false,
    is_locked: false,
    video_url: null,
    last_activity_at: null,
};

describe("RoomCard", () => {
    it("shows the room name, owner, member count in Persian digits, and a paused chip", () => {
        render(
            <RoomCard
                room={baseRoom}
                onCopyInvite={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        expect(screen.getByText("فیلم شب جمعه")).toBeInTheDocument();
        expect(screen.getByText(/ساخته شده توسط آرش/)).toBeInTheDocument();
        expect(screen.getByText("۳ از ۱۰ نفر")).toBeInTheDocument();
        expect(screen.getByText("متوقف")).toBeInTheDocument();
    });

    it("renders the invite code in a dedicated LTR element", () => {
        render(
            <RoomCard
                room={baseRoom}
                onCopyInvite={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        const code = screen.getByText("ABC123XYZ789");
        expect(code).toBeInTheDocument();
        expect(code.getAttribute("dir")).toBe("ltr");
    });

    it("shows the playing chip and lock indicator when the room is playing and locked", () => {
        render(
            <RoomCard
                room={{ ...baseRoom, is_playing: true, is_locked: true }}
                onCopyInvite={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        expect(screen.getByText("در حال پخش")).toBeInTheDocument();
        expect(screen.getByText("قفل")).toBeInTheDocument();
    });

    it("shows the re-watch affordance only for rooms with a video", () => {
        const { rerender } = render(
            <RoomCard
                room={{ ...baseRoom, video_url: "https://example.com/v.mp4" }}
                onCopyInvite={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        expect(screen.getByText("دوباره ببینیم")).toBeInTheDocument();

        rerender(
            <RoomCard
                room={baseRoom}
                onCopyInvite={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        expect(screen.queryByText("دوباره ببینیم")).not.toBeInTheDocument();
    });

    it("navigates to the room via a labeled stretched link", () => {
        render(
            <RoomCard
                room={baseRoom}
                onCopyInvite={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        const link = screen.getByRole("link", {
            name: "ورود به اتاق فیلم شب جمعه",
        });
        expect(link).toHaveAttribute("href", "/__route/rooms.show/1");
    });

    it("copies the invite code on the copy action", () => {
        const onCopyInvite = vi.fn();
        render(
            <RoomCard
                room={baseRoom}
                onCopyInvite={onCopyInvite}
                onDelete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /کپی/ }));
        expect(onCopyInvite).toHaveBeenCalledWith("ABC123XYZ789");
    });

    it("requests deletion of the room on the delete action", () => {
        const onDelete = vi.fn();
        render(
            <RoomCard
                room={baseRoom}
                onCopyInvite={vi.fn()}
                onDelete={onDelete}
            />,
        );
        fireEvent.click(
            screen.getByRole("button", { name: "حذف اتاق فیلم شب جمعه" }),
        );
        expect(onDelete).toHaveBeenCalledWith(baseRoom);
    });
});
