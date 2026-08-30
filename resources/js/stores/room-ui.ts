import { create } from "zustand";

interface RoomUiState {
    activeTab: "chat" | "members";

    setActiveTab: (tab: "chat" | "members") => void;
}

export const useRoomUiStore = create<RoomUiState>((set) => ({
    activeTab: "chat",

    setActiveTab: (activeTab) => set({ activeTab }),
}));
