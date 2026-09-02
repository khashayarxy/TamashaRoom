import { create } from "zustand";

/**
 * UI-only state for the room page (Zustand).
 * Holds only ephemeral view state — active tab for chat/members.
 * Server state (members, messages, playback) lives in Inertia props / hooks.
 */
interface RoomUiState {
    /** Active sidebar tab on the watch page. */
    activeTab: "chat" | "members";

    setActiveTab: (tab: "chat" | "members") => void;
}

export const useRoomUiStore = create<RoomUiState>((set) => ({
    activeTab: "chat",

    setActiveTab: (activeTab) => set({ activeTab }),
}));
