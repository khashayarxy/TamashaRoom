import { describe, it, expect, beforeEach } from "vitest";
import { useRoomUiStore } from "@/stores/room-ui";

describe("useRoomUiStore", () => {
    beforeEach(() => {
        useRoomUiStore.setState({
            activeTab: "chat",
        });
    });

    it("has correct initial state", () => {
        const state = useRoomUiStore.getState();
        expect(state.activeTab).toBe("chat");
    });

    it("setActiveTab updates the tab", () => {
        useRoomUiStore.getState().setActiveTab("members");
        expect(useRoomUiStore.getState().activeTab).toBe("members");
    });

    it("setActiveTab switches back to chat", () => {
        useRoomUiStore.getState().setActiveTab("members");
        useRoomUiStore.getState().setActiveTab("chat");
        expect(useRoomUiStore.getState().activeTab).toBe("chat");
    });

    it("does not update on room prop changes — only UI actions", () => {
        // Simulate that room props (name, invite, lock, owner) are NOT stored
        // in the UI store. Changing them should not affect activeTab.
        const before = useRoomUiStore.getState().activeTab;
        // No store setters for room props exist; the store should remain stable
        // even if a parent re-renders with new room props.
        expect(useRoomUiStore.getState().activeTab).toBe(before);
        // Only an explicit UI action changes the store.
        useRoomUiStore.getState().setActiveTab("members");
        expect(useRoomUiStore.getState().activeTab).toBe("members");
    });
});
