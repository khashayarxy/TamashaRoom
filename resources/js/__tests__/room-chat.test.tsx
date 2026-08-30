import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomChat } from "@/Components/composite/room-chat";
import { createFakeEcho, type FakeEcho } from "./helpers/fake-echo";

const mockDelete = vi.fn();
const mockPost = vi.fn();
const mockGet = vi.fn();

const echoHolder = vi.hoisted(() => ({ instance: null as FakeEcho | null }));

vi.mock("@/lib/api", () => ({
    default: {
        delete: (...args: unknown[]) => mockDelete(...args),
        post: (...args: unknown[]) => mockPost(...args),
        get: (...args: unknown[]) => mockGet(...args),
    },
}));

vi.mock("@/lib/echo", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/echo")>();
    return {
        ...actual,
        getEcho: () => echoHolder.instance,
    };
});

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
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
        // The delete ConfirmDialog's cancel button is inside the open dialog.
        const dialogs = screen.getAllByRole("dialog");
        const openDialog = dialogs.find((d) => d.hasAttribute("open"));
        const cancelBtn = openDialog!.querySelectorAll("button")[0];
        await user.click(cancelBtn);

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

    it("counts only new messages as unread when hidden, tracking by id", async () => {
        const onUnreadCountChange = vi.fn();
        mockGet.mockResolvedValue({
            data: [makeMessage({ id: 1, body: "initial" })],
        });

        render(
            <RoomChat
                roomId={1}
                initialMessages={[makeMessage({ id: 1, body: "initial" })]}
                pollInterval={100}
                onUnreadCountChange={onUnreadCountChange}
            />,
        );

        // Hide the document: the visibility handler marks the tab not visible.
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: true,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));

        // New message arrives. Make the document visible again WITHOUT firing
        // the visible handler (so the chat tab is still considered inactive),
        // then let the poll run — it should count only the new id as unread.
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });

        mockGet.mockResolvedValue({
            data: [
                makeMessage({ id: 1, body: "initial" }),
                makeMessage({ id: 2, body: "new" }),
            ],
        });

        await waitFor(
            () => {
                expect(onUnreadCountChange).toHaveBeenCalledWith(1);
            },
            { timeout: 3000 },
        );

        // Restore the real properties.
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });
    });

    it("does not inflate unread on a same-size change with no newer messages", async () => {
        const onUnreadCountChange = vi.fn();
        mockGet.mockResolvedValue({
            data: [makeMessage({ id: 5, body: "initial" })],
        });

        render(
            <RoomChat
                roomId={1}
                initialMessages={[makeMessage({ id: 5, body: "initial" })]}
                pollInterval={100}
                onUnreadCountChange={onUnreadCountChange}
            />,
        );

        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: true,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));

        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });

        // Same size but with a lower (reshuffled) message id: the length-delta
        // approach would have inflated unread; id-tracking must not.
        mockGet.mockResolvedValue({
            data: [makeMessage({ id: 4, body: "reshuffled" })],
        });

        await waitFor(
            () => {
                expect(mockGet).toHaveBeenCalled();
            },
            { timeout: 3000 },
        );

        const seenValues = onUnreadCountChange.mock.calls.map((c) => c[0]);
        expect(seenValues.every((v) => v === 0)).toBe(true);

        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });
    });

    it("shows a reconnecting indicator when polling fails", async () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });

        mockGet.mockRejectedValue(new Error("network"));
        render(
            <RoomChat
                roomId={1}
                initialMessages={[makeMessage({ id: 1 })]}
                pollInterval={100}
            />,
        );

        await waitFor(
            () => {
                const indicator = screen.getByText(/در حال اتصال مجدد/);
                expect(indicator.closest('[role="status"]')).not.toBeNull();
            },
            { timeout: 3000 },
        );
    });

    it("clears the reconnecting indicator once polling recovers", async () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });

        mockGet.mockRejectedValueOnce(new Error("network"));
        render(
            <RoomChat
                roomId={1}
                initialMessages={[makeMessage({ id: 1 })]}
                pollInterval={100}
            />,
        );

        await waitFor(
            () => {
                expect(
                    screen.getByText(/در حال اتصال مجدد/),
                ).toBeInTheDocument();
            },
            { timeout: 3000 },
        );

        mockGet.mockResolvedValue({ data: [] });
        await waitFor(
            () => {
                expect(
                    screen.queryByText(/در حال اتصال مجدد/),
                ).not.toBeInTheDocument();
            },
            { timeout: 3000 },
        );
    });
});

describe("RoomChat (owner moderation)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockResolvedValue({ data: [] });
    });

    it("shows delete button on all messages when isOwner is true", () => {
        const messages = [
            makeMessage({ id: 1, user_id: 1, body: "Mine" }),
            makeMessage({ id: 2, user_id: 2, body: "Theirs" }),
        ];
        render(
            <RoomChat roomId={1} initialMessages={messages} isOwner={true} />,
        );

        const deleteButtons = screen.getAllByRole("button", {
            name: "حذف پیام",
        });
        expect(deleteButtons).toHaveLength(2);
    });

    it("does not show report button when isOwner is true", () => {
        const messages = [
            makeMessage({ id: 1, user_id: 2, body: "Other message" }),
        ];
        render(
            <RoomChat roomId={1} initialMessages={messages} isOwner={true} />,
        );

        expect(
            screen.queryByRole("button", { name: "گزارش پیام" }),
        ).not.toBeInTheDocument();
    });

    it("shows report button on other users messages when not owner", () => {
        const messages = [
            makeMessage({ id: 1, user_id: 1, body: "Mine" }),
            makeMessage({ id: 2, user_id: 2, body: "Theirs" }),
        ];
        render(
            <RoomChat roomId={1} initialMessages={messages} isOwner={false} />,
        );

        // Report button exists for other users' messages
        expect(
            screen.getByRole("button", { name: "گزارش پیام" }),
        ).toBeInTheDocument();
        // Delete button only on own message (1), not on the other user's message
        const deleteButtons = screen.getAllByRole("button", {
            name: "حذف پیام",
        });
        expect(deleteButtons).toHaveLength(1);
    });

    it("does not show report button on own messages", () => {
        const messages = [
            makeMessage({ id: 1, user_id: 1, body: "Mine" }),
        ];
        render(
            <RoomChat roomId={1} initialMessages={messages} isOwner={false} />,
        );

        expect(
            screen.queryByRole("button", { name: "گزارش پیام" }),
        ).not.toBeInTheDocument();
    });

    it("opens report dialog when report button is clicked", async () => {
        const user = userEvent.setup();
        const messages = [
            makeMessage({ id: 1, user_id: 2, body: "Report this" }),
        ];
        render(
            <RoomChat roomId={1} initialMessages={messages} isOwner={false} />,
        );

        await user.click(screen.getByRole("button", { name: "گزارش پیام" }));

        expect(screen.getByText("گزارش پیام")).toBeInTheDocument();
        expect(screen.getByText("گزارش شود")).toBeInTheDocument();
    });

    it("calls api.post to report a message", async () => {
        const user = userEvent.setup();
        mockPost.mockResolvedValue({ data: { status: "ok" } });

        const messages = [
            makeMessage({ id: 42, user_id: 2, body: "Report me" }),
        ];
        render(
            <RoomChat roomId={1} initialMessages={messages} isOwner={false} />,
        );

        await user.click(screen.getByRole("button", { name: "گزارش پیام" }));
        await user.click(screen.getByText("گزارش شود"));

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith("/chat/1/messages/42/report", {
                reason: undefined,
                details: undefined,
            });
        });

        const { toast } = await import("sonner");
        expect(toast.success).toHaveBeenCalledWith("گزارش پیام ثبت شد.");
    });

    it("allows owner to delete member message via confirm dialog", async () => {
        const user = userEvent.setup();
        mockDelete.mockResolvedValue({ data: { status: "ok" } });

        const messages = [
            makeMessage({ id: 10, user_id: 2, body: "Delete this" }),
        ];
        render(
            <RoomChat roomId={1} initialMessages={messages} isOwner={true} />,
        );

        await user.click(screen.getByRole("button", { name: "حذف پیام" }));
        await user.click(screen.getByText("حذف شود"));

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith("/chat/1/messages/10");
        });

        expect(screen.queryByText("Delete this")).not.toBeInTheDocument();
    });
});

describe("RoomChat (push transport)", () => {
    let fakeEcho: FakeEcho;

    beforeEach(() => {
        vi.clearAllMocks();
        fakeEcho = createFakeEcho();
        echoHolder.instance = fakeEcho;
        mockGet.mockResolvedValue({ data: [] });
        mockPost.mockReset();
    });

    afterEach(() => {
        echoHolder.instance = null;
        vi.useRealTimers();
    });

    it("appends a message delivered by the Echo broadcast instantly", async () => {
        render(<RoomChat roomId={1} initialMessages={[]} />);

        await act(async () => {
            fakeEcho.emit(
                ".chat.message.new",
                makeMessage({ id: 9, user_id: 2, body: "سلام از پوش" }),
            );
        });

        expect(screen.getByText("سلام از پوش")).toBeInTheDocument();
    });

    it("deduplicates when the Echo delivery races an already-known message", async () => {
        render(
            <RoomChat
                roomId={1}
                initialMessages={[makeMessage({ id: 5, body: "همین پیام" })]}
            />,
        );

        await act(async () => {
            fakeEcho.emit(
                ".chat.message.new",
                makeMessage({ id: 5, body: "همین پیام" }),
            );
        });

        expect(screen.getAllByText("همین پیام")).toHaveLength(1);
    });

    it("renders the sender's message optimistically while the POST is in flight", async () => {
        const user = userEvent.setup();
        let resolvePost: (v: { data: unknown }) => void;
        mockPost.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolvePost = resolve;
                }),
        );

        render(<RoomChat roomId={1} initialMessages={[]} />);

        const input = screen.getByPlaceholderText("پیام خود را بنویسید...");
        await user.type(input, "پیام خوش‌بینانه");
        await user.click(screen.getByRole("button", { name: "ارسال پیام" }));

        // Visible immediately, with the pending indicator.
        expect(screen.getByText("پیام خوش‌بینانه")).toBeInTheDocument();
        expect(
            screen.getByRole("status", { name: "در حال ارسال" }),
        ).toBeInTheDocument();

        await act(async () => {
            resolvePost!({
                data: makeMessage({ id: 20, body: "پیام خوش‌بینانه" }),
            });
        });

        expect(screen.getByText("پیام خوش‌بینانه")).toBeInTheDocument();
        expect(
            screen.queryByRole("status", { name: "در حال ارسال" }),
        ).not.toBeInTheDocument();
    });

    it("rolls the optimistic message back and restores the draft on failure", async () => {
        const user = userEvent.setup();
        mockPost.mockRejectedValue(new Error("network"));

        render(<RoomChat roomId={1} initialMessages={[]} />);

        const input = screen.getByPlaceholderText("پیام خود را بنویسید...");
        await user.type(input, "پیام شکست‌خورده");
        await user.click(screen.getByRole("button", { name: "ارسال پیام" }));

        await waitFor(() => {
            expect(
                screen.queryByText("پیام شکست‌خورده"),
            ).not.toBeInTheDocument();
        });
        expect(input).toHaveValue("پیام شکست‌خورده");
        const { toast } = await import("sonner");
        expect(toast.error).toHaveBeenCalledWith("خطا در ارسال پیام");
    });

    it("does not serialize rapid consecutive sends (each POST is independent)", async () => {
        const user = userEvent.setup();
        const resolvers: Array<(v: { data: unknown }) => void> = [];
        mockPost.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolvers.push(resolve);
                }),
        );

        render(<RoomChat roomId={1} initialMessages={[]} />);

        const input = screen.getByPlaceholderText("پیام خود را بنویسید...");
        await user.type(input, "پیام اول");
        await user.click(screen.getByRole("button", { name: "ارسال پیام" }));

        // The first POST is still in flight — the second message must render
        // optimistically anyway (regression: a shared "sending" gate made
        // every message wait out the previous POST's round-trip).
        await user.type(input, "پیام دوم");
        await user.click(screen.getByRole("button", { name: "ارسال پیام" }));

        expect(screen.getByText("پیام اول")).toBeInTheDocument();
        expect(screen.getByText("پیام دوم")).toBeInTheDocument();
        expect(mockPost).toHaveBeenCalledTimes(2);

        await act(async () => {
            resolvers[0]!({
                data: makeMessage({ id: 30, body: "پیام اول" }),
            });
        });
        await act(async () => {
            resolvers[1]!({
                data: makeMessage({ id: 31, body: "پیام دوم" }),
            });
        });

        expect(screen.getAllByText("پیام اول")).toHaveLength(1);
        expect(screen.getAllByText("پیام دوم")).toHaveLength(1);
        expect(
            screen.queryByRole("status", { name: "در حال ارسال" }),
        ).not.toBeInTheDocument();
    });

    it("a failed send does not clobber a newer draft the user is typing", async () => {
        const user = userEvent.setup();
        let rejectPost: (reason?: unknown) => void;
        mockPost.mockImplementation(
            () =>
                new Promise((_resolve, reject) => {
                    rejectPost = reject;
                }),
        );

        render(<RoomChat roomId={1} initialMessages={[]} />);

        const input = screen.getByPlaceholderText("پیام خود را بنویسید...");
        await user.type(input, "پیام شکست‌خورده");
        await user.click(screen.getByRole("button", { name: "ارسال پیام" }));

        // The user fully types a new message while the failed one is still
        // in flight; the rollback must restore the failed body only if the
        // draft is empty, never overwrite what is being typed.
        await user.type(input, "پیام جدید");

        await act(async () => {
            rejectPost!(new Error("network"));
        });

        await waitFor(() => {
            expect(
                screen.queryByText("پیام شکست‌خورده"),
            ).not.toBeInTheDocument();
        });
        expect(input).toHaveValue("پیام جدید");
    });

    it("keeps the optimistic message when a poll lands mid-send", async () => {
        const user = userEvent.setup();
        let resolvePost: (v: { data: unknown }) => void;
        mockPost.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolvePost = resolve;
                }),
        );
        mockGet.mockResolvedValue({
            data: [makeMessage({ id: 1, body: "قبلی" })],
        });

        render(<RoomChat roomId={1} initialMessages={[]} />);

        const input = screen.getByPlaceholderText("پیام خود را بنویسید...");
        await user.type(input, "در حال ارسال");
        await user.click(screen.getByRole("button", { name: "ارسال پیام" }));
        expect(screen.getByText("در حال ارسال")).toBeInTheDocument();

        // A poll (visibility restore) delivers the server list while the
        // POST is still in flight — the optimistic row must survive.
        await act(async () => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await waitFor(() => {
            expect(mockGet).toHaveBeenCalled();
        });
        await act(async () => {});

        expect(screen.getByText("قبلی")).toBeInTheDocument();
        expect(screen.getByText("در حال ارسال")).toBeInTheDocument();

        await act(async () => {
            resolvePost!({
                data: makeMessage({ id: 21, body: "در حال ارسال" }),
            });
        });
        expect(screen.getAllByText("در حال ارسال")).toHaveLength(1);
    });

    it("slows the poll to the safety-net cadence while push is healthy", async () => {
        vi.useFakeTimers();

        render(<RoomChat roomId={1} initialMessages={[]} />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(mockGet).toHaveBeenCalledTimes(1);

        await act(async () => {
            fakeEcho.fireConnected();
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        // The healthy transition performs one catch-up fetch.
        expect(mockGet).toHaveBeenCalledTimes(2);
        mockGet.mockClear();

        // Under the 20s safety-net window: no further polls.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(18000);
        });
        expect(mockGet).not.toHaveBeenCalled();

        // Past the window: exactly one safety-net poll.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(mockGet).toHaveBeenCalledTimes(1);
    });
});
