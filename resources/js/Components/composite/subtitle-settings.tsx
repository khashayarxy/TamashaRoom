import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { useSubtitleStore } from "@/stores/subtitle";
import { Subtitles, ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState } from "react";
import type { SubtitlePosition } from "@/lib/types/subtitle";

interface SubtitleSettingsProps {
    open: boolean;
    onClose: () => void;
}

const COLORS = [
    { label: "سفید", value: "#ffffff" },
    { label: "زرد", value: "#fbbf24" },
    { label: "سبز", value: "#4ade80" },
    { label: "آبی", value: "#60a5fa" },
    { label: "صورتی", value: "#f472b6" },
];

const FONTS = [
    { label: "وزیرمتن", value: "Vazirmatn-Medium" },
    { label: "ایرانسنس X", value: "IRANSansXFaNum-Medium" },
];

const POSITIONS: { label: string; value: SubtitlePosition }[] = [
    { label: "پایین", value: "bottom" },
    { label: "بالا", value: "top" },
];

export function SubtitleSettingsDialog({
    open,
    onClose,
}: SubtitleSettingsProps) {
    const settings = useSubtitleStore((s) => s.settings);
    const update = useSubtitleStore((s) => s.update);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const currentFont =
        settings.fontFamily === "IRANSansXFaNum-Medium"
            ? "IRANSansXFaNum-Medium"
            : "Vazirmatn-Medium";

    return (
        <Dialog ref={dialogRef} open={open} onClose={onClose}>
            <DialogContent className="max-w-xs sm:max-w-sm w-full p-4 font-sans">
                <DialogHeader className="pb-2 mb-2 border-b border-border">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Subtitles className="h-4 w-4 text-primary" />
                        تنظیمات زیرنویس
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* 1. Font Family Selector */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5 text-foreground">
                            قلم زیرنویس
                        </label>
                        {FONTS.length > 6 ? (
                            <select
                                value={currentFont}
                                onChange={(e) =>
                                    update({ fontFamily: e.target.value })
                                }
                                className="w-full rounded-lg border border-input bg-secondary px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                            >
                                {FONTS.map((f) => (
                                    <option
                                        key={f.value}
                                        value={f.value}
                                        style={{
                                            fontFamily: `'${f.value}', sans-serif`,
                                        }}
                                    >
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        ) : (
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
                        )}
                    </div>

                    {/* 2. Text Size */}
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
                                کوچک
                            </span>
                            <input
                                type="range"
                                min={14}
                                max={36}
                                value={settings.size}
                                onChange={(e) =>
                                    update({ size: parseInt(e.target.value) })
                                }
                                className="flex-1 h-1.5 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
                                style={{ direction: "ltr" }}
                            />
                            <span className="text-[10px] text-muted-foreground shrink-0">
                                بزرگ
                            </span>
                        </div>
                    </div>

                    {/* 3. Text Color */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5 text-foreground">
                            رنگ متن
                        </label>
                        <div className="flex gap-2 justify-between">
                            {COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => update({ color: c.value })}
                                    className={`h-7 w-7 rounded-full border-2 transition-all shrink-0 ${
                                        settings.color === c.value
                                            ? "border-primary scale-110 shadow-sm"
                                            : "border-transparent"
                                    }`}
                                    style={{ backgroundColor: c.value }}
                                    title={c.label}
                                    aria-label={c.label}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Advanced Collapsible Section */}
                    <div className="pt-2 border-t border-border">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced((prev) => !prev)}
                            className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                        >
                            <span>سایر تنظیمات (تأخیر، پس‌زمینه، موقعیت)</span>
                            {showAdvanced ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                            )}
                        </button>

                        {showAdvanced && (
                            <div className="space-y-3.5 pt-3 animate-in fade-in-0 slide-in-from-top-1">
                                {/* Background Opacity */}
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
                                            شفاف
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
                                            تیره
                                        </span>
                                    </div>
                                </div>

                                {/* Subtitle Offset / Timing */}
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
                                            دیرتر
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
                                            زودتر
                                        </span>
                                    </div>
                                    {settings.offset !== 0 && (
                                        <div className="text-end mt-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    update({ offset: 0 })
                                                }
                                                className="text-[10px] text-primary underline underline-offset-2"
                                            >
                                                بازنشانی هم‌زمانی
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Position */}
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

                                {/* Toggle Enabled */}
                                <div className="flex items-center justify-between pt-1">
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
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                            settings.enabled
                                                ? "bg-primary"
                                                : "bg-secondary"
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                settings.enabled
                                                    ? "translate-x-[18px]"
                                                    : "translate-x-[2px]"
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Live Preview Container */}
                    <div
                        className="bg-muted rounded-lg p-2.5 text-center transition-all overflow-hidden"
                        dir="auto"
                        style={{
                            backgroundColor: `rgba(0,0,0,${
                                settings.bgOpacity / 100
                            })`,
                        }}
                    >
                        <span
                            style={{
                                fontFamily: `'${currentFont}', sans-serif`,
                                fontSize: `${Math.min(settings.size, 24)}px`,
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
}
