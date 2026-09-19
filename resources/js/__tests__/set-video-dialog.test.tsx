import { SetVideoDialog } from "@/Components/composite/set-video-dialog";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("SetVideoDialog", () => {
    it("renders with initial URL and submits correctly", async () => {
        const handleSetVideo = vi.fn().mockResolvedValue(undefined);
        const handleClose = vi.fn();

        render(
            <SetVideoDialog
                open={true}
                onClose={handleClose}
                onSetVideo={handleSetVideo}
                initialUrl="https://example.com/movie.mp4"
            />,
        );

        const input = screen.getByLabelText("آدرس ویدیو") as HTMLInputElement;
        expect(input.value).toBe("https://example.com/movie.mp4");

        const submitBtn = screen.getByRole("button", { name: "تنظیم ویدیو" });
        fireEvent.click(submitBtn);

        expect(handleSetVideo).toHaveBeenCalledWith(
            "https://example.com/movie.mp4",
        );
    });

    it("selects input text on focus and double click", async () => {
        const user = userEvent.setup();
        const handleSetVideo = vi.fn();
        const handleClose = vi.fn();

        render(
            <SetVideoDialog
                open={true}
                onClose={handleClose}
                onSetVideo={handleSetVideo}
                initialUrl="https://example.com/movie.mp4"
            />,
        );

        const input = screen.getByLabelText("آدرس ویدیو") as HTMLInputElement;

        // Focus triggers select()
        input.focus();
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("https://example.com/movie.mp4".length);

        // Double click triggers select()
        await user.dblClick(input);
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("https://example.com/movie.mp4".length);
    });

    it("does not wipe user input when parent re-renders while open", () => {
        const handleSetVideo = vi.fn();
        const handleClose = vi.fn();

        const { rerender } = render(
            <SetVideoDialog
                open={true}
                onClose={handleClose}
                onSetVideo={handleSetVideo}
                initialUrl="https://example.com/initial.mp4"
            />,
        );

        const input = screen.getByLabelText("آدرس ویدیو") as HTMLInputElement;
        fireEvent.change(input, {
            target: { value: "https://example.com/typed-url.mp4" },
        });
        expect(input.value).toBe("https://example.com/typed-url.mp4");

        // Re-render with new initialUrl while open
        rerender(
            <SetVideoDialog
                open={true}
                onClose={handleClose}
                onSetVideo={handleSetVideo}
                initialUrl="https://example.com/poll-update.mp4"
            />,
        );

        // Value must NOT be wiped
        expect(input.value).toBe("https://example.com/typed-url.mp4");
    });

    describe("validation status stages", () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        function renderLoading() {
            render(
                <SetVideoDialog
                    open={true}
                    onClose={() => {}}
                    onSetVideo={async () => {}}
                    loading={true}
                    initialUrl="https://example.com/movie.mp4"
                />,
            );
        }

        it("shows the first stage and an indeterminate progressbar while loading", () => {
            renderLoading();
            expect(
                screen.getByText("در حال بررسی لینک..."),
            ).toBeInTheDocument();
            expect(
                screen.getByRole("progressbar", {
                    name: "در حال بررسی ویدیو",
                }),
            ).toBeInTheDocument();
        });

        it("cycles stages every 800ms and wraps around", () => {
            vi.useFakeTimers();
            renderLoading();

            expect(
                screen.getByText("در حال بررسی لینک..."),
            ).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(800);
            });
            expect(
                screen.getByText("در حال اتصال به سرور..."),
            ).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(800 * 3);
            });
            // Wrapped past the last stage back to the first.
            expect(
                screen.getByText("در حال بررسی لینک..."),
            ).toBeInTheDocument();
        });

        it("hides the status panel when not loading", () => {
            render(
                <SetVideoDialog
                    open={true}
                    onClose={() => {}}
                    onSetVideo={async () => {}}
                    loading={false}
                    initialUrl="https://example.com/movie.mp4"
                />,
            );
            expect(
                screen.queryByText("در حال بررسی لینک..."),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole("progressbar", {
                    name: "در حال بررسی ویدیو",
                }),
            ).not.toBeInTheDocument();
        });
    });
});
