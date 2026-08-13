import { sanitizeText } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useSubtitleStore } from "@/stores/subtitle";
import type { SubtitleCue, SubtitleSettings } from "@/lib/types/subtitle";

export { type SubtitleCue, type SubtitleSettings };

export const DEFAULT_SETTINGS: SubtitleSettings = {
    size: 20,
    color: "#ffffff",
    enabled: true,
    bgOpacity: 40,
    position: "bottom",
    offset: 0,
    fontFamily: "Vazirmatn-Medium",
};

export function parseVtt(text: string): SubtitleCue[] {
    const normalized = text.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const cues: SubtitleCue[] = [];
    let i = 0;

    while (
        i < lines.length &&
        lines[i].trim() !== "WEBVTT" &&
        lines[i].trim() !== ""
    ) {
        i++;
    }
    if (i < lines.length && lines[i].trim() === "WEBVTT") i++;

    while (i < lines.length) {
        const line = lines[i].trim();
        if (line === "" || /^\d+$/.test(line)) {
            i++;
            continue;
        }
        const timeMatch = line.match(
            /^(\d{2}:)?(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})[.,](\d{1,3})/,
        );
        if (!timeMatch) {
            i++;
            continue;
        }
        const toMs = (h: string, m: string, s: string, ms: string) =>
            (parseInt(h || "0") * 3600 + parseInt(m) * 60 + parseInt(s)) *
                1000 +
            parseInt(ms.padEnd(3, "0"));
        const start = toMs(
            timeMatch[1] || "00",
            timeMatch[2],
            timeMatch[3],
            timeMatch[4],
        );
        const end = toMs(
            timeMatch[5] || "00",
            timeMatch[6],
            timeMatch[7],
            timeMatch[8],
        );
        i++;
        const cueLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== "") {
            if (!/^NOTE\s/.test(lines[i])) {
                cueLines.push(sanitizeText(lines[i]));
            }
            i++;
        }
        if (cueLines.length > 0) {
            cues.push({ start, end, text: cueLines.join("\n") });
        }
        i++;
    }
    return cues;
}

export function parseSrt(text: string): SubtitleCue[] {
    const normalized = text.replace(/\r\n/g, "\n");
    const blocks = normalized.trim().split(/\n\n+/);
    const cues: SubtitleCue[] = [];

    for (const block of blocks) {
        const lines = block.split("\n");
        if (lines.length < 2) continue;
        const timeLine = lines.find((l) => l.includes("-->"));
        if (!timeLine) continue;
        const timeMatch = timeLine.match(
            /(\d{2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{1,3})/,
        );
        if (!timeMatch) continue;
        const toMs = (h: string, m: string, s: string, ms: string) =>
            (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 +
            parseInt(ms.padEnd(3, "0"));
        const start = toMs(
            timeMatch[1],
            timeMatch[2],
            timeMatch[3],
            timeMatch[4],
        );
        const end = toMs(
            timeMatch[5],
            timeMatch[6],
            timeMatch[7],
            timeMatch[8],
        );
        const textLines = lines.filter(
            (l) => !l.includes("-->") && !/^\d+$/.test(l.trim()),
        );
        if (textLines.length > 0) {
            cues.push({
                start,
                end,
                text: textLines.map(sanitizeText).join("\n"),
            });
        }
    }
    return cues;
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
        return (
            <div
                className={cn(
                    "absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none px-4",
                    className,
                )}
            >
                <div className="bg-red-900/80 text-red-100 text-sm rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    {error}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div
                className={cn(
                    "absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none px-4",
                    className,
                )}
            >
                <div className="bg-black/60 text-white/85 text-sm rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    در حال بارگذاری زیرنویس...
                </div>
            </div>
        );
    }

    if (!settings.enabled || !currentText) return null;

    const positionClass = settings.position === "top" ? "top-20" : "bottom-16";

    return (
        <div
            className={cn(
                "absolute left-0 right-0 flex justify-center pointer-events-none px-4",
                positionClass,
                className,
            )}
        >
            <div
                style={{
                    fontFamily: `'${
                        settings.fontFamily && !["Vazirmatn", "sans-serif", "serif", "monospace"].includes(settings.fontFamily)
                            ? settings.fontFamily
                            : "Vazirmatn-Medium"
                    }', var(--font-sans)`,
                    fontSize: `${settings.size}px`,
                    color: settings.color,
                    backgroundColor: `rgba(0,0,0,${settings.bgOpacity / 100})`,
                    textShadow:
                        "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6), 0 0 12px rgba(0,0,0,0.4)",
                    lineHeight: 1.5,
                }}
                className="max-w-[90%] text-center rounded-xl px-4 py-2 backdrop-blur-sm"
                dir="auto"
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
}

function cn(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(" ");
}
