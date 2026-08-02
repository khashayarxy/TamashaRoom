import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "@/Pages/Dashboard";
import { usePage } from "@inertiajs/react";
import { CREATE_ROOM_INTENT_KEY } from "@/lib/utils";

vi.mock("@inertiajs/react", () => ({
    usePage: vi.fn(),
    router: {
        post: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        visit: vi.fn(),
    },
    Link: ({ href, children }: { href: string; children?: unknown }) =>
        `[Link:${href}:${String(children ?? "")}]`,
}));

const usePageMock = vi.mocked(usePage);
type UsePageReturn = ReturnType<typeof usePage>;

function mockPage(errors: Record<string, string> = {}) {
    usePageMock.mockReturnValue({
        props: {
            auth: {
                user: { id: 1, name: "Test", email: "test@example.com" },
            },
            errors,
        },
    } as unknown as UsePageReturn);
}

describe("Dashboard", () => {
    beforeEach(() => {
        sessionStorage.clear();
        mockPage();
    });

    it("renders an empty state when the user has no rooms", () => {
        render(<Dashboard rooms={[]} />);
        expect(screen.getByText("هنوز اتاقی ندارید")).toBeInTheDocument();
    });

    it("shows the join error returned from the server", () => {
        mockPage({ invite_code: "این اتاق پر است." });
        render(<Dashboard rooms={[]} />);
        expect(screen.getByText("این اتاق پر است.")).toBeInTheDocument();
    });

    it("opens the create room form when arriving from the header button", () => {
        sessionStorage.setItem(CREATE_ROOM_INTENT_KEY, "1");
        render(<Dashboard rooms={[]} />);
        expect(screen.getByText("ساخت اتاق جدید")).toBeInTheDocument();
        expect(sessionStorage.getItem(CREATE_ROOM_INTENT_KEY)).toBeNull();
    });

    it("does not open the create form without an intent flag", () => {
        render(<Dashboard rooms={[]} />);
        expect(screen.queryByText("ساخت اتاق جدید")).not.toBeInTheDocument();
    });
});
