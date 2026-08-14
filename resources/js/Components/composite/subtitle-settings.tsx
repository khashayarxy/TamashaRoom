import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { useSubtitleStore } from "@/stores/subtitle";
import { Subtitles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
    SubtitleBorderRadius,
    SubtitlePosition,
} from "@/lib/types/subtitle";

interface SubtitleSettingsProps {
    open: boolean;
    onClose: () => void;
}

const COLORS = [
    { label: "سفید", value: "#FFFFFF" },
    { label: "زرد", value: "#FFFF00" },
];

const FONTS = [
    { label: "وزیرمتن", value: "Vazirmatn-Medium" },
    { label: "ایران سنس", value: "IRANSansXFaNum-Regular" },
];

const POSITIONS: { label: string; value: SubtitlePosition }[] = [
    { label: "پایین", value: "bottom" },
    { label: "بالا", value: "top" },
];

const CORNERS: { label: string; value: SubtitleBorderRadius }[] = [
    { label: "گرد", value: "rounded" },
    { label: "تیز", value: "sharp" },
];

export function SubtitleSettingsDialog({
    open,
    onClose,
}: SubtitleSettingsProps) {
    const settings = useSubtitleStore((s) => s.settings);
    const update = useSubtitleStore((s) => s.update);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic");
    const [fullscreenElement, setFullscreenElement] = useState<Element | null>(
        null,
    );

    useEffect(() => {
        const updateFs = () => {
            const fsEl =
                document.fullscreenElement ||
                (document as unknown as { webkitFullscreenElement?: Element })
                    .webkitFullscreenElement ||
                null;
            setFullscreenElement(fsEl);
        };
        updateFs();

        document.addEventListener("fullscreenchange", updateFs);
        document.addEventListener("webkitfullscreenchange", updateFs);

        return () => {
            document.removeEventListener("fullscreenchange", updateFs);
            document.removeEventListener("webkitfullscreenchange", updateFs);
        };
    }, []);

    const currentFont =
        settings.fontFamily === "IRANSansXFaNum-Regular" ||
        settings.fontFamily === "IRANSansXFaNum-Medium"
            ? "IRANSansXFaNum-Regular"
            : "Vazirmatn-Medium";

    const dialogContent = (
        <Dialog
            ref={dialogRef}
            open={open}
            onClose={onClose}
            disableBackdropBlur
            className="max-w-[310px] my-auto"
        >
            <DialogContent className="w-full p-4 font-sans max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="pb-2 mb-2 border-b border-border shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Subtitles className="h-4 w-4 text-primary" />
                        تنظیمات زیرنویس
                    </DialogTitle>
                </DialogHeader>

                {/* Tab Switcher */}
                <div className="flex rounded-xl bg-secondary p-1 mb-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab("basic")}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors text-center ${
                            activeTab === "basic"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        پایه
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("advanced")}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors text-center ${
                            activeTab === "advanced"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        پیشرفته
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pe-1">
                    {activeTab === "basic" ? (
                        <>
                            {/* Font Family Selector */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-foreground">
                                    فونت زیرنویس
                                </label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {FONTS.map((f) => (
                                        <button
                                            key={f.value}
                                            type="button"
                                            onClick={() =>
                                                update({ fontFamily: f.value })
                                            }
                                            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all text-center truncate ${
                                                currentFont === f.value
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "bg-secondary text-muted-foreground hover:text-foreground"
                                            }`}
                                            style={{
                                                fontFamily: `'${f.value}', sans-serif`,
                                            }}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Text Size Slider */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-medium text-foreground">
                                        اندازه متن
                                    </label>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {settings.size}px
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        بزرگ
                                    </span>
                                    <input
                                        type="range"
                                        min={14}
                                        max={36}
                                        value={settings.size}
                                        onChange={(e) =>
                                            update({
                                                size: parseInt(e.target.value),
                                            })
                                        }
                                        className="flex-1 h-1.5 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
                                        style={{ direction: "ltr" }}
                                    />
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        کوچک
                                    </span>
                                </div>
                            </div>

                            {/* Text Color Palette */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-foreground">
                                    رنگ متن
                                </label>
                                <div className="flex gap-2">
                                    {COLORS.map((c) => {
                                        const isSelected =
                                            settings.color.toUpperCase() ===
                                            c.value;
                                        return (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() =>
                                                    update({ color: c.value })
                                                }
                                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground shadow-sm"
                                                        : "bg-secondary text-muted-foreground hover:text-foreground"
                                                }`}
                                                title={c.label}
                                                aria-label={c.label}
                                            >
                                                <span
                                                    className="h-3 w-3 rounded-full border border-black/30 shrink-0"
                                                    style={{
                                                        backgroundColor:
                                                            c.value,
                                                    }}
                                                />
                                                <span>{c.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Corner Style Buttons */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-foreground">
                                    حاشیه پس‌زمینه
                                </label>
                                <div className="flex gap-2">
                                    {CORNERS.map((c) => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() =>
                                                update({
                                                    borderRadius: c.value,
                                                })
                                            }
                                            className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all text-center ${
                                                settings.borderRadius ===
                                                c.value
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "bg-secondary text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Toggle Enabled */}
                            <div className="flex items-center justify-between py-1 border-b border-border/50 pb-2.5">
                                <span className="text-xs font-medium text-foreground">
                                    نمایش زیرنویس
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={settings.enabled}
                                    aria-label="نمایش زیرنویس"
                                    onClick={() =>
                                        update({
                                            enabled: !settings.enabled,
                                        })
                                    }
                                    style={{ direction: "ltr" }}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        settings.enabled
                                            ? "bg-primary"
                                            : "bg-muted"
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                            settings.enabled
                                                ? "translate-x-4"
                                                : "translate-x-0"
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Background Opacity Slider */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-medium text-foreground">
                                        شفافیت پس‌زمینه
                                    </label>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {settings.bgOpacity}%
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        تیره
                                    </span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={settings.bgOpacity}
                                        onChange={(e) =>
                                            update({
                                                bgOpacity: parseInt(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                        className="flex-1 h-1.5 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
                                        style={{ direction: "ltr" }}
                                    />
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        شفاف
                                    </span>
                                </div>
                            </div>

                            {/* Subtitle Offset / Timing Slider */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-medium text-foreground">
                                        هم‌زمانی زیرنویس
                                    </label>
                                    <span className="text-xs text-muted-foreground">
                                        {settings.offset === 0
                                            ? "بدون تأخیر"
                                            : `${
                                                  settings.offset > 0
                                                      ? "+"
                                                      : "−"
                                              }${(
                                                  Math.abs(settings.offset) /
                                                  1000
                                              ).toFixed(1)} ثانیه`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        زودتر
                                    </span>
                                    <input
                                        type="range"
                                        min={-5000}
                                        max={5000}
                                        step={250}
                                        value={settings.offset}
                                        onChange={(e) =>
                                            update({
                                                offset: parseInt(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                        className="flex-1 h-1.5 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
                                        style={{ direction: "ltr" }}
                                    />
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        دیرتر
                                    </span>
                                </div>
                                {settings.offset !== 0 && (
                                    <div className="text-end mt-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                update({ offset: 0 })
                                            }
                                            className="text-[10px] text-accent-foreground underline underline-offset-2"
                                        >
                                            بازنشانی هم‌زمانی
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Position Buttons */}
                            <div>
                                <label className="block text-xs font-medium mb-1 text-foreground">
                                    موقعیت روی صفحه
                                </label>
                                <div className="flex gap-2">
                                    {POSITIONS.map((p) => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            onClick={() =>
                                                update({ position: p.value })
                                            }
                                            className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all text-center ${
                                                settings.position === p.value
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "bg-secondary text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Vertical Position Offset Slider */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-medium text-foreground">
                                        فاصله عمودی (ارتفاع)
                                    </label>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {settings.vOffset ?? 0}px
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        بالاتر
                                    </span>
                                    <input
                                        type="range"
                                        min={-25}
                                        max={75}
                                        step={5}
                                        value={settings.vOffset ?? 0}
                                        onChange={(e) =>
                                            update({
                                                vOffset: parseInt(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                        className="flex-1 h-1.5 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
                                        style={{ direction: "ltr" }}
                                    />
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        پایین‌تر
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Live Preview Container (Always Visible) */}
                    <div
                        className="bg-muted rounded-lg p-2.5 text-center transition-all overflow-hidden mt-3"
                        dir="rtl"
                        style={{
                            containerType: "inline-size",
                            backgroundColor: `rgba(0,0,0,${
                                settings.bgOpacity / 100
                            })`,
                        }}
                    >
                        <span
                            className={`inline-block px-3 py-1 ${
                                settings.borderRadius === "sharp"
                                    ? "rounded-none"
                                    : "rounded-xl"
                            }`}
                            style={{
                                fontFamily: `'${currentFont}', sans-serif`,
                                fontSize: `clamp(12px, ${(settings.size * 0.2).toFixed(2)}cqw, 28px)`,
                                color: settings.color,
                                textShadow:
                                    "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6)",
                            }}
                        >
                            پیش‌نمایش زیرنویس TamashaRoom
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );

    if (fullscreenElement) {
        return createPortal(dialogContent, fullscreenElement);
    }

    return dialogContent;
}
