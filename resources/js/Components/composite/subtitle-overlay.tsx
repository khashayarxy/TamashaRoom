import { useFullscreenTarget } from "@/Hooks/use-fullscreen-target";
import { useSubtitleStore } from "@/stores/subtitle";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SubtitleCue, SubtitleSettings } from "@/lib/types/subtitle";

export type { SubtitleCue, SubtitleSettings };

export function sanitizeText(text: string): string {
    return text
        .replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

/**
 * Basic SRT parser: converts raw SRT string into array of SubtitleCue
 */
export function parseSrt(srtText: string): SubtitleCue[] {
    const blocks = srtText.trim().replace(/\r\n/g, "\n").split("\n\n");
    const cues: SubtitleCue[] = [];

    for (const block of blocks) {
        const lines = block.split("\n");
        if (lines.length < 2) continue;

        let timeLineIdx = 1;
        if (!lines[0].includes("-->") && lines[1] && lines[1].includes("-->")) {
            timeLineIdx = 1;
        } else if (lines[0].includes("-->")) {
            timeLineIdx = 0;
        } else {
            continue;
        }

        const [startStr, endStr] = lines[timeLineIdx].split(" --> ");
        if (!startStr || !endStr) continue;

        const textLines = lines.slice(timeLineIdx + 1);
        const rawText = textLines.join("\n").trim();
        const text = sanitizeText(rawText);
        if (!text) continue;

        const start = parseTimestamp(startStr.trim());
        const end = parseTimestamp(endStr.trim());

        if (start !== null && end !== null && end > start) {
            cues.push({ start, end, text });
        }
    }

    return cues;
}

/**
 * Basic WebVTT parser: converts raw WebVTT string into array of SubtitleCue
 */
export function parseVtt(vttText: string): SubtitleCue[] {
    const cleanText = vttText.replace(/^WEBVTT[^\n]*\n/, "").trim();
    return parseSrt(cleanText);
}

function parseTimestamp(ts: string): number | null {
    const normalized = ts.replace(",", ".");
    const parts = normalized.split(":");

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 3) {
        hours = parseFloat(parts[0]);
        minutes = parseFloat(parts[1]);
        seconds = parseFloat(parts[2]);
    } else if (parts.length === 2) {
        minutes = parseFloat(parts[0]);
        seconds = parseFloat(parts[1]);
    } else {
        return null;
    }

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;

    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

export function parseSubtitle(text: string): SubtitleCue[] {
    return text.includes("WEBVTT") ? parseVtt(text) : parseSrt(text);
}

export function useSubtitleSettings() {
    const settings = useSubtitleStore((s) => s.settings);
    const update = useSubtitleStore((s) => s.update);
    return { settings, update };
}

interface SubtitleOverlayProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    cues: SubtitleCue[];
    settings: SubtitleSettings;
    loading?: boolean;
    error?: string | null;
    className?: string;
}

export function SubtitleOverlay({
    videoRef,
    cues,
    settings,
    loading,
    error,
    className,
}: SubtitleOverlayProps) {
    const [currentText, setCurrentText] = useState<string | null>(null);
    const fullscreenElement = useFullscreenTarget();
    const rafRef = useRef<number>(0);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || cues.length === 0) return;

        const tick = () => {
            const timeMs = video.currentTime * 1000 + settings.offset;
            const active = cues.find(
                (c) => timeMs >= c.start && timeMs < c.end,
            );
            setCurrentText(active ? active.text : null);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [cues, videoRef, settings.offset]);

    if (error) {
        const errorContent = (
            <div
                className={cn(
                    "absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none px-4 z-[9999]",
                    className,
                )}
            >
                <div className="bg-red-900/80 text-red-100 text-sm rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    {error}
                </div>
            </div>
        );
        return fullscreenElement
            ? createPortal(errorContent, fullscreenElement)
            : errorContent;
    }

    if (loading) {
        const loadingContent = (
            <div
                className={cn(
                    "absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none px-4 z-[9999]",
                    className,
                )}
            >
                <div className="bg-black/60 text-white/85 text-sm rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    در حال بارگذاری زیرنویس...
                </div>
            </div>
        );
        return fullscreenElement
            ? createPortal(loadingContent, fullscreenElement)
            : loadingContent;
    }

    if (!settings.enabled || !currentText) return null;

    const vOffsetPx = settings.vOffset ?? 0;
    const verticalStyle =
        settings.position === "top"
            ? { top: `calc(5rem + ${vOffsetPx}px)` }
            : { bottom: `calc(4rem + ${vOffsetPx}px)` };

    const overlayContent = (
        <div
            className={cn(
                "absolute left-0 right-0 flex justify-center pointer-events-none px-4 z-[9999]",
                className,
            )}
            style={verticalStyle}
        >
            <div
                style={{
                    fontFamily: `'${
                        settings.fontFamily === "IRANSansXFaNum-Regular" ||
                        settings.fontFamily === "IRANSansXFaNum-Medium"
                            ? "IRANSansXFaNum-Regular"
                            : "Vazirmatn-Medium"
                    }', var(--font-sans)`,
                    fontSize: `clamp(12px, ${(settings.size * 0.09).toFixed(2)}cqw, 72px)`,
                    color: settings.color,
                    backgroundColor: `rgba(0,0,0,${settings.bgOpacity / 100})`,
                    textShadow:
                        "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6), 0 0 12px rgba(0,0,0,0.4)",
                    lineHeight: 1.5,
                }}
                className={`max-w-[90%] text-center px-4 py-2 backdrop-blur-sm ${
                    settings.borderRadius === "sharp"
                        ? "rounded-none"
                        : "rounded-xl"
                }`}
                dir="rtl"
            >
                {currentText.split("\n").map((line, i) => (
                    <span key={i}>
                        {i > 0 && <br />}
                        {sanitizeText(line)}
                    </span>
                ))}
            </div>
        </div>
    );

    return fullscreenElement
        ? createPortal(overlayContent, fullscreenElement)
        : overlayContent;
}

function cn(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(" ");
}
