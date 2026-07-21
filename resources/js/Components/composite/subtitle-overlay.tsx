import { useCallback, useEffect, useRef, useState } from 'react';
import type { SubtitleCue, SubtitleSettings } from '@/lib/types/subtitle';

const SETTINGS_KEY = 'tamasharoom-subtitle-settings';

export { type SubtitleCue, type SubtitleSettings };

export const DEFAULT_SETTINGS: SubtitleSettings = {
    size: 20,
    color: '#ffffff',
    enabled: true,
    bgOpacity: 40,
    position: 'bottom',
};

export function parseVtt(text: string): SubtitleCue[] {
    const normalized = text.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const cues: SubtitleCue[] = [];
    let i = 0;

    while (i < lines.length && lines[i].trim() !== 'WEBVTT' && lines[i].trim() !== '') {
        i++;
    }
    if (i < lines.length && lines[i].trim() === 'WEBVTT') i++;

    while (i < lines.length) {
        const line = lines[i].trim();
        if (line === '' || /^\d+$/.test(line)) {
            i++;
            continue;
        }
        const timeMatch = line.match(
            /^(\d{2}:)?(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})[.,](\d{1,3})/
        );
        if (!timeMatch) {
            i++;
            continue;
        }
        const toMs = (h: string, m: string, s: string, ms: string) =>
            (parseInt(h || '0') * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 + parseInt(ms.padEnd(3, '0'));
        const start = toMs(timeMatch[1] || '00', timeMatch[2], timeMatch[3], timeMatch[4]);
        const end = toMs(timeMatch[5] || '00', timeMatch[6], timeMatch[7], timeMatch[8]);
        i++;
        const cueLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
            if (!/^NOTE\s/.test(lines[i])) {
                cueLines.push(lines[i].replace(/<[^>]*>/g, ''));
            }
            i++;
        }
        if (cueLines.length > 0) {
            cues.push({ start, end, text: cueLines.join('\n') });
        }
        i++;
    }
    return cues;
}

export function parseSrt(text: string): SubtitleCue[] {
    const normalized = text.replace(/\r\n/g, '\n');
    const blocks = normalized.trim().split(/\n\n+/);
    const cues: SubtitleCue[] = [];

    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length < 2) continue;
        const timeLine = lines.find((l) => l.includes('-->'));
        if (!timeLine) continue;
        const timeMatch = timeLine.match(
            /(\d{2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{1,3})/
        );
        if (!timeMatch) continue;
        const toMs = (h: string, m: string, s: string, ms: string) =>
            (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 + parseInt(ms.padEnd(3, '0'));
        const start = toMs(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
        const end = toMs(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
        const textLines = lines.filter((l) => !l.includes('-->') && !/^\d+$/.test(l.trim()));
        if (textLines.length > 0) {
            cues.push({ start, end, text: textLines.join('\n') });
        }
    }
    return cues;
}

export function parseSubtitle(text: string): SubtitleCue[] {
    return text.includes('WEBVTT') ? parseVtt(text) : parseSrt(text);
}

function loadSettings(): SubtitleSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_SETTINGS;
}

function saveSettings(s: SubtitleSettings) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function useSubtitleSettings() {
    const [settings, setSettings] = useState<SubtitleSettings>(loadSettings);

    const update = useCallback((partial: Partial<SubtitleSettings>) => {
        setSettings((prev) => {
            const next = { ...prev, ...partial };
            saveSettings(next);
            return next;
        });
    }, []);

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

export function SubtitleOverlay({ videoRef, cues, settings, loading, error, className }: SubtitleOverlayProps) {
    const [currentText, setCurrentText] = useState<string | null>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || cues.length === 0) return;

        const tick = () => {
            const timeMs = video.currentTime * 1000;
            const active = cues.find((c) => timeMs >= c.start && timeMs < c.end);
            setCurrentText(active ? active.text : null);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [cues, videoRef]);

    if (error) {
        return (
            <div className={cn('absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none px-4', className)}>
                <div className="bg-red-900/70 text-red-200 text-sm rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    {error}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={cn('absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none px-4', className)}>
                <div className="bg-black/40 text-white/60 text-sm rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    در حال بارگذاری زیرنویس...
                </div>
            </div>
        );
    }

    if (!settings.enabled || !currentText) return null;

    const positionClass = settings.position === 'top' ? 'top-20' : 'bottom-16';

    return (
        <div
            className={cn(
                'absolute left-0 right-0 flex justify-center pointer-events-none px-4',
                positionClass,
                className
            )}
        >
            <div
                style={{
                    fontSize: `${settings.size}px`,
                    color: settings.color,
                    backgroundColor: `rgba(0,0,0,${settings.bgOpacity / 100})`,
                    textShadow:
                        '0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6), 0 0 12px rgba(0,0,0,0.4)',
                    lineHeight: 1.5,
                }}
                className="max-w-[90%] text-center rounded-xl px-4 py-2 backdrop-blur-sm"
                dir="auto"
            >
                {currentText.split('\n').map((line, i) => (
                    <span key={i}>
                        {i > 0 && <br />}
                        {line}
                    </span>
                ))}
            </div>
        </div>
    );
}

function cn(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(' ');
}
