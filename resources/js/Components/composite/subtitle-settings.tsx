import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { useSubtitleStore } from "@/stores/subtitle";
import { Subtitles } from "lucide-react";
import { useRef } from "react";
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

    return (
        <Dialog ref={dialogRef} open={open} onClose={onClose}>
            <DialogContent className="min-w-[300px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Subtitles className="h-5 w-5" />
                        تنظیمات زیرنویس
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 mt-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            اندازه متن
                        </label>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
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
                                className="flex-1 h-2 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
                                style={{ direction: "ltr" }}
                            />
                            <span className="text-xs text-muted-foreground">
                                بزرگ
                            </span>
                        </div>
                        <div className="text-center text-sm mt-1 text-muted-foreground">
                            {settings.size}px
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            شفافیت پس‌زمینه
                        </label>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                                شفاف
                            </span>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={settings.bgOpacity}
                                onChange={(e) =>
                                    update({
                                        bgOpacity: parseInt(e.target.value),
                                    })
                                }
                                className="flex-1 h-2 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
                                style={{ direction: "ltr" }}
                            />
                            <span className="text-xs text-muted-foreground">
                                تیره
                            </span>
                        </div>
                        <div className="text-center text-sm mt-1 text-muted-foreground">
                            {settings.bgOpacity}%
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            هم‌زمانی زیرنویس
                        </label>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
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
                                        offset: parseInt(e.target.value),
                                    })
                                }
                                className="flex-1 h-2 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
                                style={{ direction: "ltr" }}
                            />
                            <span className="text-xs text-muted-foreground">
                                زودتر
                            </span>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">
                                {settings.offset === 0
                                    ? "بدون تأخیر"
                                    : `${settings.offset > 0 ? "+" : "−"}${(
                                          Math.abs(settings.offset) / 1000
                                      ).toFixed(1)} ثانیه`}
                            </span>
                            {settings.offset !== 0 && (
                                <button
                                    type="button"
                                    onClick={() => update({ offset: 0 })}
                                    className="text-xs text-primary underline underline-offset-2"
                                >
                                    بازنشانی
                                </button>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            رنگ متن
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => update({ color: c.value })}
                                    className={`h-9 w-9 rounded-full border-2 transition-all ${
                                        settings.color === c.value
                                            ? "border-primary scale-110"
                                            : "border-transparent"
                                    }`}
                                    style={{ backgroundColor: c.value }}
                                    title={c.label}
                                    aria-label={c.label}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            موقعیت
                        </label>
                        <div className="flex gap-2">
                            {POSITIONS.map((p) => (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() =>
                                        update({ position: p.value })
                                    }
                                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
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

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-sm">نمایش زیرنویس</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={settings.enabled}
                            aria-label="نمایش زیرنویس"
                            onClick={() =>
                                update({ enabled: !settings.enabled })
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                settings.enabled ? "bg-primary" : "bg-secondary"
                            }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                    settings.enabled
                                        ? "translate-x-[22px]"
                                        : "translate-x-[2px]"
                                }`}
                            />
                        </button>
                    </div>

                    <div
                        className="bg-muted rounded-xl p-3 text-sm text-muted-foreground text-center"
                        dir="auto"
                        style={{
                            backgroundColor: `rgba(0,0,0,${settings.bgOpacity / 100})`,
                        }}
                    >
                        <span
                            style={{
                                fontSize: `${settings.size}px`,
                                color: settings.color,
                                textShadow:
                                    "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6), 0 0 12px rgba(0,0,0,0.4)",
                            }}
                        >
                            پیش‌نمایش متن زیرنویس
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
