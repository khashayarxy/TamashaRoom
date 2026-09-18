import { create } from "zustand";

/**
 * UI-only profile-dialog store (Zustand).
 * Controls the global Profile dialog opened from the app header.
 * No server state — visibility is a pure client preference.
 */
interface ProfileDialogState {
    open: boolean;
    setOpen: (open: boolean) => void;
}

export const useProfileDialogStore = create<ProfileDialogState>((set) => ({
    open: false,
    setOpen: (open) => set({ open }),
}));
