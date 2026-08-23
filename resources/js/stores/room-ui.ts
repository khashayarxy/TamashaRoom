import { create } from "zustand";

interface RoomUiState {
    activeTab: "chat" | "members";
    showSetVideo: boolean;
    showSubSettings: boolean;
    showSubManager: boolean;
    showRoomSettings: boolean;
    roomName: string;
    roomInviteCode: string;
    roomIsLocked: boolean;
    ownerId: number;

    setActiveTab: (tab: "chat" | "members") => void;
    setShowSetVideo: (v: boolean) => void;
    setShowSubSettings: (v: boolean) => void;
    setShowSubManager: (v: boolean) => void;
    setShowRoomSettings: (v: boolean) => void;
    setRoomName: (v: string) => void;
    setRoomInviteCode: (v: string) => void;
    setRoomIsLocked: (v: boolean) => void;
    setOwnerId: (v: number) => void;
}

export const useRoomUiStore = create<RoomUiState>((set) => ({
    activeTab: "chat",
    showSetVideo: false,
    showSubSettings: false,
    showSubManager: false,
    showRoomSettings: false,
    roomName: "",
    roomInviteCode: "",
    roomIsLocked: false,
    ownerId: 0,

    setActiveTab: (activeTab) => set({ activeTab }),
    setShowSetVideo: (showSetVideo) => set({ showSetVideo }),
    setShowSubSettings: (showSubSettings) => set({ showSubSettings }),
    setShowSubManager: (showSubManager) => set({ showSubManager }),
    setShowRoomSettings: (showRoomSettings) => set({ showRoomSettings }),
    setRoomName: (roomName) => set({ roomName }),
    setRoomInviteCode: (roomInviteCode) => set({ roomInviteCode }),
    setRoomIsLocked: (roomIsLocked) => set({ roomIsLocked }),
    setOwnerId: (ownerId) => set({ ownerId }),
}));
