import { create } from 'zustand';
import type { SubtitleSettings } from '@/lib/types/subtitle';

const SETTINGS_KEY = 'tamasharoom-subtitle-settings';

const DEFAULT_SETTINGS: SubtitleSettings = {
    size: 20,
    color: '#ffffff',
    enabled: true,
    bgOpacity: 40,
    position: 'bottom',
};

function loadSettings(): SubtitleSettings {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SubtitleSettings>) };
    } catch { /* ignore */ }
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
