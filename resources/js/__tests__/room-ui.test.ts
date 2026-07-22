import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomUiStore } from '@/stores/room-ui';

describe('useRoomUiStore', () => {
    beforeEach(() => {
        useRoomUiStore.setState({
            activeTab: 'chat',
            showSetVideo: false,
            videoUrl: '',
            showSubSettings: false,
            showSubManager: false,
            showRoomSettings: false,
            roomName: '',
            roomInviteCode: '',
            roomIsLocked: false,
        });
    });

    it('has correct initial state', () => {
        const state = useRoomUiStore.getState();
        expect(state.activeTab).toBe('chat');
        expect(state.showSetVideo).toBe(false);
        expect(state.videoUrl).toBe('');
        expect(state.showSubSettings).toBe(false);
        expect(state.showSubManager).toBe(false);
        expect(state.showRoomSettings).toBe(false);
        expect(state.roomName).toBe('');
        expect(state.roomInviteCode).toBe('');
        expect(state.roomIsLocked).toBe(false);
    });

    it('setActiveTab updates the tab', () => {
        useRoomUiStore.getState().setActiveTab('members');
        expect(useRoomUiStore.getState().activeTab).toBe('members');
    });

    it('setActiveTab switches back to chat', () => {
        useRoomUiStore.getState().setActiveTab('members');
        useRoomUiStore.getState().setActiveTab('chat');
        expect(useRoomUiStore.getState().activeTab).toBe('chat');
    });

    it('setShowSetVideo toggles visibility', () => {
        useRoomUiStore.getState().setShowSetVideo(true);
        expect(useRoomUiStore.getState().showSetVideo).toBe(true);
        useRoomUiStore.getState().setShowSetVideo(false);
        expect(useRoomUiStore.getState().showSetVideo).toBe(false);
    });

    it('setVideoUrl stores the url', () => {
        useRoomUiStore.getState().setVideoUrl('https://example.com/video.mp4');
        expect(useRoomUiStore.getState().videoUrl).toBe('https://example.com/video.mp4');
    });

    it('setShowSubSettings toggles subtitle settings', () => {
        useRoomUiStore.getState().setShowSubSettings(true);
        expect(useRoomUiStore.getState().showSubSettings).toBe(true);
    });

    it('setShowSubManager toggles subtitle manager', () => {
        useRoomUiStore.getState().setShowSubManager(true);
        expect(useRoomUiStore.getState().showSubManager).toBe(true);
    });

    it('setShowRoomSettings toggles room settings', () => {
        useRoomUiStore.getState().setShowRoomSettings(true);
        expect(useRoomUiStore.getState().showRoomSettings).toBe(true);
    });

    it('setRoomName stores the name', () => {
        useRoomUiStore.getState().setRoomName('My Room');
        expect(useRoomUiStore.getState().roomName).toBe('My Room');
    });

    it('setRoomInviteCode stores the code', () => {
        useRoomUiStore.getState().setRoomInviteCode('ABC123');
        expect(useRoomUiStore.getState().roomInviteCode).toBe('ABC123');
    });

    it('setRoomIsLocked stores the lock state', () => {
        useRoomUiStore.getState().setRoomIsLocked(true);
        expect(useRoomUiStore.getState().roomIsLocked).toBe(true);
    });
});
