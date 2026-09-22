/**
 * Native enablement for embedded (in-container) subtitle tracks.
 *
 * Uploaded tracks render through the custom cue overlay (fetched as JSON),
 * but embedded tracks have no server-side cues — the browser already exposes
 * them as native TextTracks, so selection means flipping `mode` flags.
 * Overlay-only settings (time offset, screen position) intentionally do NOT
 * apply to embedded tracks; size/color are approximated by the browser.
 *
 * WebKit-only caveat for the sibling audio feature does not apply here:
 * `video.textTracks` is universal across browsers.
 */

export interface EmbeddedSubtitleSelection {
    /** Raw language code as stored on the track row (e.g. 'per', 'eng'). */
    language: string | null;
    /** 0-based position among subtitle-kind tracks (fallback match). */
    index: number;
}

interface NativeTextTrack {
    kind: string;
    language: string;
    mode: string;
}

interface VideoWithTextTracks {
    readonly textTracks: ArrayLike<NativeTextTrack>;
}

const PERSIAN_ALIASES = new Set(["fa", "fas", "per", "farsi", "parsi"]);

function normalizeLanguage(code: string | null | undefined): string | null {
    if (!code) return null;
    const base = code.toLowerCase().split(/[-_]/)[0];
    if (PERSIAN_ALIASES.has(base)) return "fa";
    return base;
}

/**
 * Show exactly one native subtitle track (or none when `selection` is
 * null), leaving every other track disabled. Matching prefers an exact
 * normalized-language hit, then falls back to the nth subtitle-kind track
 * by `selection.index`, then to the first one. Never throws: worst case is
 * subtitles staying off.
 */
export function applyEmbeddedSubtitle(
    video: VideoWithTextTracks | null | undefined,
    selection: EmbeddedSubtitleSelection | null,
): void {
    if (!video) return;

    let subs: NativeTextTrack[];
    try {
        subs = Array.from(video.textTracks).filter(
            (t) => t.kind === "subtitles" || t.kind === "captions",
        );
    } catch {
        return;
    }

    if (selection === null || subs.length === 0) {
        for (const track of subs) {
            try {
                track.mode = "disabled";
            } catch {
                // Read-only track list (e.g. in tests) — stay off instead.
            }
        }
        return;
    }

    const want = normalizeLanguage(selection.language);
    const byLanguage =
        want !== null
            ? subs.find((t) => normalizeLanguage(t.language) === want)
            : undefined;
    const target =
        byLanguage ?? subs[Math.min(selection.index, subs.length - 1)];

    for (const track of subs) {
        try {
            track.mode = track === target ? "showing" : "disabled";
        } catch {
            // Ignore per-track failures; keep the rest deterministic.
        }
    }
}
