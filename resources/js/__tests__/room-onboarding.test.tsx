import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoomOnboarding } from "@/Components/composite/room-onboarding";

describe("RoomOnboarding", () => {
    it("shows the three setup steps", () => {
        render(
            <RoomOnboarding
                onCopyInvite={() => {}}
                onAddVideo={() => {}}
                onDismiss={() => {}}
            />,
        );
        expect(screen.getByText("راه‌اندازی اتاق")).toBeInTheDocument();
        expect(screen.getByText("یک ویدیو اضافه کنید")).toBeInTheDocument();
        expect(
            screen.getByText("لینک دعوت را برای دوستان بفرستید"),
        ).toBeInTheDocument();
        expect(screen.getByText("همه هم‌زمان تماشا کنید")).toBeInTheDocument();
    });

    it("calls onAddVideo when the add-video button is clicked", () => {
        const onAddVideo = vi.fn();
        render(
            <RoomOnboarding
                onCopyInvite={() => {}}
                onAddVideo={onAddVideo}
                onDismiss={() => {}}
            />,
        );
        fireEvent.click(screen.getByText("افزودن ویدیو"));
        expect(onAddVideo).toHaveBeenCalledTimes(1);
    });

    it("calls onCopyInvite when the copy-link button is clicked", () => {
        const onCopyInvite = vi.fn();
        render(
            <RoomOnboarding
                onCopyInvite={onCopyInvite}
                onAddVideo={() => {}}
                onDismiss={() => {}}
            />,
        );
        fireEvent.click(screen.getByText("کپی لینک دعوت"));
        expect(onCopyInvite).toHaveBeenCalledTimes(1);
    });

    it("calls onDismiss when the dismiss button is clicked", () => {
        const onDismiss = vi.fn();
        render(
            <RoomOnboarding
                onCopyInvite={() => {}}
                onAddVideo={() => {}}
                onDismiss={onDismiss}
            />,
        );
        fireEvent.click(screen.getByLabelText("بستن راهنما"));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
