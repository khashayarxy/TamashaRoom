import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomChat } from "@/Components/composite/room-chat";

const mockDelete = vi.fn();
const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock("@/lib/api", () => ({
    default: {
        delete: (...args: unknown[]) => mockDelete(...args),
        post: (...args: unknown[]) => mockPost(...args),
        get: (...args: unknown[]) => mockGet(...args),
    },
}));

vi.mock("@inertiajs/react", () => ({
    usePage: () => ({
        props: { auth: { user: { id: 1 } } },
    }),
}));

function makeMessage(
    overrides: Partial<{
        id: number;
        user_id: number;
        body: string;
        created_at: string;
        user: { id: number; name: string };
    }> = {},
) {
    return {
        id: 1,
        user_id: 1,
        body: "Test message",
        created_at: new Date().toISOString(),
        user: { id: 1, name: "TestUser" },
        ...overrides,
    };
}

describe("RoomChat", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockResolvedValue({ data: [] });
    });

    it("renders initial messages", () => {
        const messages = [
            makeMessage({ id: 1, body: "Hello" }),
            makeMessage({ id: 2, body: "World", user_id: 2 }),
        ];
        render(<RoomChat roomId={1} initialMessages={messages} />);
        expect(screen.getByText("Hello")).toBeInTheDocument();
        expect(screen.getByText("World")).toBeInTheDocument();
    });

    it("shows delete button only on own messages", () => {
        const messages = [
            makeMessage({ id: 1, user_id: 1, body: "Mine" }),
            makeMessage({ id: 2, user_id: 2, body: "Theirs" }),
        ];
        render(<RoomChat roomId={1} initialMessages={messages} />);

        const deleteButtons = screen.getAllByRole("button", {
            name: "حذف پیام",
        });
        expect(deleteButtons).toHaveLength(1);
    });

    it("opens confirm dialog when delete button is clicked", async () => {
        const user = userEvent.setup();
        const messages = [
            makeMessage({ id: 1, user_id: 1, body: "To delete" }),
        ];
        render(<RoomChat roomId={1} initialMessages={messages} />);

        const deleteBtn = screen.getByRole("button", { name: "حذف پیام" });
        await user.click(deleteBtn);

        expect(
            screen.getByText(
                "آیا از حذف این پیام اطمینان دارید؟ این عمل قابل بازگشت نیست.",
            ),
        ).toBeInTheDocument();
        expect(screen.getByText("حذف شود")).toBeInTheDocument();
    });

    it("calls api.delete and removes message on confirm", async () => {
        const user = userEvent.setup();
        mockDelete.mockResolvedValue({ data: { status: "ok" } });

        const messages = [
            makeMessage({ id: 42, user_id: 1, body: "Delete me" }),
        ];
        render(<RoomChat roomId={1} initialMessages={messages} />);

        await user.click(screen.getByRole("button", { name: "حذف پیام" }));
        await user.click(screen.getByText("حذف شود"));

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith("/chat/1/messages/42");
        });

        expect(screen.queryByText("Delete me")).not.toBeInTheDocument();
    });

    it("does not call api.delete when cancel is clicked", async () => {
        const user = userEvent.setup();
        const messages = [makeMessage({ id: 1, user_id: 1, body: "Keep me" })];
        render(<RoomChat roomId={1} initialMessages={messages} />);

        await user.click(screen.getByRole("button", { name: "حذف پیام" }));
        await user.click(screen.getByText("انصراف"));

        expect(mockDelete).not.toHaveBeenCalled();
        expect(screen.getByText("Keep me")).toBeInTheDocument();
    });

    it("disables delete button while deleting", async () => {
        const user = userEvent.setup();
        let resolveDelete: () => void;
        mockDelete.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveDelete = () => resolve({ data: { status: "ok" } });
                }),
        );

        const messages = [makeMessage({ id: 1, user_id: 1, body: "Deleting" })];
        render(<RoomChat roomId={1} initialMessages={messages} />);

        await user.click(screen.getByRole("button", { name: "حذف پیام" }));
        await user.click(screen.getByText("حذف شود"));

        const confirmBtn = screen.getByText("در حال انجام...");
        expect(confirmBtn).toBeDisabled();

        resolveDelete!();
        await waitFor(() => {
            expect(
                screen.queryByText("در حال انجام..."),
            ).not.toBeInTheDocument();
        });
    });

    it("sends a message on form submit", async () => {
        const user = userEvent.setup();
        mockPost.mockResolvedValue({
            data: makeMessage({ id: 3, body: "New message" }),
        });

        render(<RoomChat roomId={1} initialMessages={[]} />);

        const input = screen.getByPlaceholderText("پیام خود را بنویسید...");
        await user.type(input, "New message");
        await user.click(screen.getByRole("button", { name: "ارسال پیام" }));

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith("/chat/1/messages", {
                body: "New message",
            });
        });

        expect(screen.getByText("New message")).toBeInTheDocument();
    });

    it("disables send button when input is empty", () => {
        render(<RoomChat roomId={1} initialMessages={[]} />);
        expect(
            screen.getByRole("button", { name: "ارسال پیام" }),
        ).toBeDisabled();
    });

    it("polls for new messages on interval", async () => {
        mockGet.mockResolvedValue({
            data: [makeMessage({ id: 1, body: "New polled message" })],
        });

        render(<RoomChat roomId={1} initialMessages={[]} pollInterval={100} />);

        await waitFor(() => {
            expect(mockGet).toHaveBeenCalledWith("/chat/1/messages");
        });

        await waitFor(
            () => {
                expect(
                    screen.getByText("New polled message"),
                ).toBeInTheDocument();
            },
            { timeout: 3000 },
        );
    });

    it("renders presence join moments as distinct system rows", () => {
        render(
            <RoomChat
                roomId={1}
                initialMessages={[]}
                presenceMoments={[
                    {
                        id: "m1",
                        type: "join",
                        name: "سارا",
                        user_id: 2,
                        at: Date.now(),
                    },
                ]}
            />,
        );
        expect(screen.getByText("سارا به اتاق پیوست")).toBeInTheDocument();
    });

    it("renders presence leave moments as distinct system rows", () => {
        render(
            <RoomChat
                roomId={1}
                initialMessages={[]}
                presenceMoments={[
                    {
                        id: "m2",
                        type: "leave",
                        name: "علی",
                        user_id: 3,
                        at: Date.now(),
                    },
                ]}
            />,
        );
        expect(screen.getByText("علی از اتاق خارج شد")).toBeInTheDocument();
    });

    it("does not render a delete button for presence moments", () => {
        render(
            <RoomChat
                roomId={1}
                initialMessages={[]}
                presenceMoments={[
                    {
                        id: "m1",
                        type: "join",
                        name: "سارا",
                        user_id: 2,
                        at: Date.now(),
                    },
                ]}
            />,
        );
        expect(
            screen.queryByRole("button", { name: "حذف پیام" }),
        ).not.toBeInTheDocument();
    });

    it("interleaves moments with messages by timestamp", () => {
        const now = Date.now();
        render(
            <RoomChat
                roomId={1}
                initialMessages={[
                    makeMessage({
                        id: 1,
                        body: "Older message",
                        created_at: new Date(now).toISOString(),
                    }),
                ]}
                presenceMoments={[
                    {
                        id: "m1",
                        type: "join",
                        name: "سارا",
                        user_id: 2,
                        at: now + 5000,
                    },
                ]}
            />,
        );
        const olderText = screen.getByText("Older message");
        const momentText = screen.getByText("سارا به اتاق پیوست");

        const list = olderText.closest(".flex-1") as HTMLElement;
        const targets = new Set<Element>([olderText, momentText]);
        const nodes = Array.from(list.querySelectorAll("*")).filter((n) =>
            targets.has(n),
        );
        expect(nodes.indexOf(momentText)).toBeGreaterThan(
            nodes.indexOf(olderText),
        );
    });
});
