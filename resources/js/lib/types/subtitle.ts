export interface SubtitleTrack {
    id: number;
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

export interface SubtitleSettings {
    size: number;
    color: string;
    enabled: boolean;
    bgOpacity: number;
    position: SubtitlePosition;
}
