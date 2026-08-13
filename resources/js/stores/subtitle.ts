import { create } from "zustand";
import type { SubtitleSettings } from "@/lib/types/subtitle";
import { subtitleSettingsSchema } from "@/lib/validation";

const SETTINGS_KEY = "tamasharoom-subtitle-settings";

const DEFAULT_SETTINGS: SubtitleSettings = {
    size: 20,
    color: "#ffffff",
    enabled: true,
    bgOpacity: 40,
    position: "bottom",
    offset: 0,
    fontFamily: "Vazirmatn-Medium",
};

function loadSettings(): SubtitleSettings {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            const parsed = subtitleSettingsSchema.parse(JSON.parse(raw));
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch {
        /* invalid or malformed stored settings — fall through to defaults */
    }
    return DEFAULT_SETTINGS;
}

function persistSettings(settings: SubtitleSettings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

interface SubtitleState {
    settings: SubtitleSettings;
    update: (partial: Partial<SubtitleSettings>) => void;
}

export const useSubtitleStore = create<SubtitleState>((set) => ({
    settings: loadSettings(),
    update: (partial) =>
        set((state) => {
            const next = { ...state.settings, ...partial };
            persistSettings(next);
            return { settings: next };
        }),
}));
