import type { PropsWithChildren } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Welcome from "@/Pages/Welcome";
import { useThemeStore } from "@/stores/theme";

vi.mock("@inertiajs/react", () => ({
    Head: ({ children }: PropsWithChildren) => <>{children}</>,
    Link: ({
        children,
        href,
        ...props
    }: PropsWithChildren<{ href: string }>) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

describe("Welcome", () => {
    beforeEach(() => {
        vi.stubGlobal("route", (name: string) => `/${name}`);
        useThemeStore.setState({ dark: true });
    });

    it("keeps registration and the working theme control together in navigation", async () => {
        render(
            <Welcome
                auth={{ user: null }}
                canonicalUrl="https://example.com/"
            />,
        );
        const navigation = screen.getByRole("navigation", {
            name: "ناوبری اصلی",
        });
        expect(
            within(navigation).getByRole("link", { name: "ثبت‌نام" }),
        ).toHaveAttribute("href", "/register");
        await userEvent.click(
            within(navigation).getByRole("button", { name: "حالت روشن" }),
        );
        expect(
            within(navigation).getByRole("button", { name: "حالت تاریک" }),
        ).toBeInTheDocument();
        expect(document.querySelector('a[href="#"]')).toBeNull();
    });

    it("publishes configured canonical, description and Open Graph metadata", () => {
        render(
            <Welcome
                auth={{ user: null }}
                canonicalUrl="https://example.com/"
            />,
        );
        expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
            "href",
            "https://example.com/",
        );
        expect(
            document
                .querySelector('meta[name="description"]')
                ?.getAttribute("content"),
        ).toContain("همزمان");
        expect(
            document.querySelector('meta[property="og:url"]'),
        ).toHaveAttribute("content", "https://example.com/");
        expect(
            document.querySelector('meta[property="og:type"]'),
        ).toHaveAttribute("content", "website");
    });
});
