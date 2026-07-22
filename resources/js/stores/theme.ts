import { create } from 'zustand';

interface ThemeState {
    dark: boolean;
    toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
    dark:
        typeof window !== 'undefined'
            ? document.documentElement.classList.contains('dark')
            : false,
    toggle: () =>
        set((state) => {
            const next = !state.dark;
            document.documentElement.classList.toggle('dark', next);
            localStorage.setItem('theme', next ? 'dark' : 'light');
            return { dark: next };
        }),
}));
