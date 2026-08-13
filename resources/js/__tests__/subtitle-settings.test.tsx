import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubtitleSettingsDialog } from "@/Components/composite/subtitle-settings";

const mockUpdate = vi.fn();

const defaultSettings = {
    size: 20,
    color: "#ffffff",
    enabled: true,
    bgOpacity: 40,
    position: "bottom" as const,
    offset: 0,
    fontFamily: "Vazirmatn-Medium",
    borderRadius: "rounded" as const,
    vOffset: 0,
};

vi.mock("@/stores/subtitle", () => ({
    useSubtitleStore: (
        selector: (s: {
            settings: typeof defaultSettings;
            update: typeof mockUpdate;
        }) => unknown,
    ) => selector({ settings: currentSettings, update: mockUpdate }),
}));

let currentSettings = defaultSettings;

describe("SubtitleSettingsDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentSettings = { ...defaultSettings };
    });

    it("renders default settings when open", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        expect(screen.getByText("تنظیمات زیرنویس")).toBeInTheDocument();
        expect(screen.getByText("20px")).toBeInTheDocument();
        expect(screen.getByText("وزیرمتن")).toBeInTheDocument();
        expect(screen.getByText("ایران سنس")).toBeInTheDocument();
    });

    it("has dialog closed when not open", () => {
        render(<SubtitleSettingsDialog open={false} onClose={() => {}} />);
        const dialog = document.querySelector("dialog");
        expect(dialog).not.toBeNull();
        expect(dialog!.open).toBe(false);
    });

    it("updates font family when font choice button changes", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const iranSansBtn = screen.getByText("ایران سنس");
        fireEvent.click(iranSansBtn);
        expect(mockUpdate).toHaveBeenCalledWith({ fontFamily: "IRANSansXFaNum-Medium" });
    });

    it("updates corner style when corner button changes", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const sharpBtn = screen.getByText("تیز");
        fireEvent.click(sharpBtn);
        expect(mockUpdate).toHaveBeenCalledWith({ borderRadius: "sharp" });
    });

    it("updates vertical offset when vertical slider changes in advanced tab", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const advancedTab = screen.getByText("پیشرفته");
        fireEvent.click(advancedTab);
        const sliders = screen.getAllByRole("slider");
        const vOffsetSlider = sliders[2]; // opacity is 0, offset is 1, vOffset is 2
        fireEvent.change(vOffsetSlider, { target: { value: "30" } });
        expect(mockUpdate).toHaveBeenCalledWith({ vOffset: 30 });
    });

    it("updates size when slider changes", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const sliders = screen.getAllByRole("slider");
        const sizeSlider = sliders[0];
        fireEvent.change(sizeSlider, { target: { value: "28" } });
        expect(mockUpdate).toHaveBeenCalledWith({ size: 28 });
    });

    it("selects a color when clicked", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const yellowBtn = screen.getByLabelText("زرد");
        fireEvent.click(yellowBtn);
        expect(mockUpdate).toHaveBeenCalledWith({ color: "#FFFF00" });
    });

    it("switches to advanced tab when advanced tab button is clicked", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const advancedTab = screen.getByText("پیشرفته");
        fireEvent.click(advancedTab);

        expect(screen.getByText("40%")).toBeInTheDocument();
        expect(screen.getByText("بدون تأخیر")).toBeInTheDocument();
    });

    it("updates background opacity in advanced tab", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const advancedTab = screen.getByText("پیشرفته");
        fireEvent.click(advancedTab);

        const sliders = screen.getAllByRole("slider");
        const opacitySlider = sliders[0];
        fireEvent.change(opacitySlider, { target: { value: "60" } });
        expect(mockUpdate).toHaveBeenCalledWith({ bgOpacity: 60 });
    });

    it("updates offset in advanced tab", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const advancedTab = screen.getByText("پیشرفته");
        fireEvent.click(advancedTab);

        const sliders = screen.getAllByRole("slider");
        const offsetSlider = sliders[1];
        fireEvent.change(offsetSlider, { target: { value: "1500" } });
        expect(mockUpdate).toHaveBeenCalledWith({ offset: 1500 });
    });

    it("shows formatted offset and reset button when offset is non-zero in advanced tab", () => {
        currentSettings = { ...defaultSettings, offset: 1500 };
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const advancedTab = screen.getByText("پیشرفته");
        fireEvent.click(advancedTab);

        expect(screen.getByText("+1.5 ثانیه")).toBeInTheDocument();
        const reset = screen.getByText("بازنشانی هم‌زمانی");
        fireEvent.click(reset);
        expect(mockUpdate).toHaveBeenCalledWith({ offset: 0 });
    });

    it("selects top position in advanced tab", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const advancedTab = screen.getByText("پیشرفته");
        fireEvent.click(advancedTab);

        const topBtn = screen.getByText("بالا");
        fireEvent.click(topBtn);
        expect(mockUpdate).toHaveBeenCalledWith({ position: "top" });
    });

    it("toggles enabled state in advanced tab", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        const advancedTab = screen.getByText("پیشرفته");
        fireEvent.click(advancedTab);

        const toggle = screen.getByLabelText("نمایش زیرنویس");
        fireEvent.click(toggle);
        expect(mockUpdate).toHaveBeenCalledWith({ enabled: false });
    });

    it("renders preview with current settings", () => {
        render(<SubtitleSettingsDialog open onClose={() => {}} />);
        expect(screen.getByText("پیش‌نمایش زیرنویس TamashaRoom")).toBeInTheDocument();
    });

    it("calls onClose when dialog background is clicked", () => {
        const onClose = vi.fn();
        render(<SubtitleSettingsDialog open onClose={onClose} />);

        const dialog = document.querySelector("dialog");
        expect(dialog).toBeInTheDocument();

        fireEvent.click(dialog!);
        expect(onClose).toHaveBeenCalled();
    });
});
