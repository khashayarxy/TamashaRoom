import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/stores/theme';

describe('useThemeStore', () => {
    beforeEach(() => {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem('theme');
        useThemeStore.setState({ dark: false });
    });

    it('initializes with dark=false when html has no dark class', () => {
        expect(useThemeStore.getState().dark).toBe(false);
    });

    it('initializes with dark=true when html has dark class', () => {
        document.documentElement.classList.add('dark');
        useThemeStore.setState({ dark: document.documentElement.classList.contains('dark') });
        expect(useThemeStore.getState().dark).toBe(true);
    });

    it('toggle flips dark from false to true', () => {
        useThemeStore.getState().toggle();
        const state = useThemeStore.getState();
        expect(state.dark).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('toggle flips dark from true to false', () => {
        useThemeStore.setState({ dark: true });
        document.documentElement.classList.add('dark');
        useThemeStore.getState().toggle();
        const state = useThemeStore.getState();
        expect(state.dark).toBe(false);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(localStorage.getItem('theme')).toBe('light');
    });

    it('toggle is idempotent when called twice', () => {
        useThemeStore.getState().toggle();
        useThemeStore.getState().toggle();
        expect(useThemeStore.getState().dark).toBe(false);
    });
});
