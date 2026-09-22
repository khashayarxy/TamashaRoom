/**
 * Uploaded tracks carry a converted VTT file; embedded tracks reference a
 * subtitle stream inside the room's video container (file-less) and are
 * rendered through the browser's native TextTracks instead of the custom
 * cue overlay — so overlay-only settings (time offset, position) don't
 * apply to them.
 */
export interface SubtitleTrack {
    id: number;
    kind: "upload" | "embedded";
    track_index: number | null;
    label: string;
    language: string;
    original_extension: string;
    created_at: string;
}

export interface SubtitleCue {
    start: number;
    end: number;
    text: string;
}

export type SubtitlePosition = "bottom" | "top";

export type SubtitleBorderRadius = "rounded" | "sharp";

export interface SubtitleSettings {
    size: number;
    color: string;
    enabled: boolean;
    bgOpacity: number;
    position: SubtitlePosition;
    offset: number;
    fontFamily: string;
    borderRadius: SubtitleBorderRadius;
    vOffset: number;
}
