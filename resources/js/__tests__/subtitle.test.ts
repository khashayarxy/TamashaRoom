import { describe, it, expect, beforeEach } from 'vitest';
import { useSubtitleStore } from '@/stores/subtitle';

const SETTINGS_KEY = 'tamasharoom-subtitle-settings';

const defaults = {
    size: 20,
    color: '#ffffff',
    enabled: true,
    bgOpacity: 40,
    position: 'bottom' as const,
};

describe('useSubtitleStore', () => {
    beforeEach(() => {
        localStorage.clear();
        useSubtitleStore.setState({ settings: { ...defaults } });
    });

    it('initializes with default settings when localStorage is empty', () => {
        const fresh = useSubtitleStore.getState();
        expect(fresh.settings).toEqual(defaults);
    });

    it('loads persisted settings from localStorage', () => {
        const persisted = { ...defaults, size: 28, color: '#ffff00' };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(persisted));
        useSubtitleStore.setState({ settings: { ...persisted } });
        const state = useSubtitleStore.getState();
        expect(state.settings.size).toBe(28);
        expect(state.settings.color).toBe('#ffff00');
    });

    it('update changes a single field', () => {
        useSubtitleStore.getState().update({ size: 32 });
        expect(useSubtitleStore.getState().settings.size).toBe(32);
        expect(useSubtitleStore.getState().settings.color).toBe('#ffffff');
    });

    it('update changes multiple fields at once', () => {
        useSubtitleStore.getState().update({ color: '#ff0000', bgOpacity: 60 });
        const state = useSubtitleStore.getState();
        expect(state.settings.color).toBe('#ff0000');
        expect(state.settings.bgOpacity).toBe(60);
        expect(state.settings.size).toBe(20);
    });

    it('update persists to localStorage', () => {
        useSubtitleStore.getState().update({ enabled: false });
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
        expect(stored.enabled).toBe(false);
    });

    it('update toggles enabled off and on', () => {
        useSubtitleStore.getState().update({ enabled: false });
        expect(useSubtitleStore.getState().settings.enabled).toBe(false);
        useSubtitleStore.getState().update({ enabled: true });
        expect(useSubtitleStore.getState().settings.enabled).toBe(true);
    });

    it('update does not leak fields from partial', () => {
        useSubtitleStore.getState().update({ size: 99 });
        const state = useSubtitleStore.getState();
        expect(Object.keys(state.settings).sort()).toEqual(Object.keys(defaults).sort());
    });
});
