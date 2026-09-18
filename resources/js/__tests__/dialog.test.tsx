import { Dialog } from "@/Components/ui/dialog";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function dialogClass(container: HTMLElement): string {
    const el = container.querySelector("dialog");
    expect(el).not.toBeNull();
    return (el as HTMLDialogElement).className;
}

describe("Dialog", () => {
    it("centers by default with blurred backdrop and entry animation", () => {
        const { container } = render(
            <Dialog open={false} onClose={() => {}}>
                content
            </Dialog>,
        );
        const cls = dialogClass(container);
        expect(cls).toContain("backdrop:bg-black/50");
        expect(cls).toContain("backdrop:backdrop-blur-sm");
        expect(cls).toContain("open:animate-dialog-in");
        expect(cls).toContain("max-w-lg");
        expect(cls).toContain("max-h-[85vh]");
        expect(cls).not.toContain("backdrop:bg-transparent");
    });

    it("honors disableBackdropBlur in the center variant", () => {
        const { container } = render(
            <Dialog open={false} onClose={() => {}} disableBackdropBlur>
                content
            </Dialog>,
        );
        const cls = dialogClass(container);
        expect(cls).toContain("backdrop:bg-black/50");
        expect(cls).not.toContain("backdrop:backdrop-blur-sm");
    });

    it("docks side-right with transparent backdrop and slide animation", () => {
        const { container } = render(
            <Dialog open={false} onClose={() => {}} variant="side-right">
                content
            </Dialog>,
        );
        const cls = dialogClass(container);
        expect(cls).toContain("backdrop:bg-transparent");
        expect(cls).not.toContain("backdrop:backdrop-blur-sm");
        expect(cls).not.toContain("backdrop:bg-black/50");
        expect(cls).toContain("ml-auto");
        expect(cls).toContain("open:animate-dialog-side-in");
        expect(cls).not.toContain("max-w-lg");
    });

    it("calls onClose when the backdrop itself is clicked", () => {
        const onClose = vi.fn();
        const { container } = render(
            <Dialog open={false} onClose={onClose}>
                content
            </Dialog>,
        );
        const el = container.querySelector("dialog") as HTMLDialogElement;
        fireEvent.click(el);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
