import { create } from "zustand";

/**
 * UI-only theme store (Zustand).
 * Persists `dark` to localStorage and mirrors to `document.documentElement`.
 * No server state — theme is a pure client preference.
 */
interface ThemeState {
    dark: boolean;
    toggle: () => void;
}

function getInitialDark(): boolean {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return true; // default to dark
}

export const useThemeStore = create<ThemeState>((set) => ({
    dark: getInitialDark(),
    toggle: () =>
        set((state) => {
            const next = !state.dark;
            document.documentElement.classList.toggle("dark", next);
            localStorage.setItem("theme", next ? "dark" : "light");
            return { dark: next };
        }),
}));

if (typeof document !== "undefined") {
    document.documentElement.classList.toggle(
        "dark",
        useThemeStore.getState().dark,
    );
}
