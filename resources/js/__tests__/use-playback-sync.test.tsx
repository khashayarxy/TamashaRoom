import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlaybackSync } from '@/Hooks/use-playback-sync';

const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock('@/lib/api', () => ({
    default: {
        get: (...args: unknown[]) => mockGet(...args),
        patch: (...args: unknown[]) => mockPatch(...args),
    },
}));

function makeResponse(overrides: Record<string, unknown> = {}) {
    return {
        is_playing: false,
        position_seconds: 0,
        duration_seconds: 300,
        playback_rate: 1,
        video_url: 'https://example.com/v.mp4',
        playback_mode: 'direct',
        state_version: 1,
        server_timestamp: Date.now() / 1000,
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

describe('usePlaybackSync', () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockPatch.mockReset();
        mockGet.mockResolvedValue({ data: makeResponse() });
    });

    it('fetches initial state on mount', async () => {
        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1 }),
        );

        expect(result.current.loading).toBe(true);
        expect(mockGet).toHaveBeenCalledWith('/playback/1/state');

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.state.isPlaying).toBe(false);
        expect(result.current.state.stateVersion).toBe(1);
    });

    it('does not allow non-host to sync', async () => {
        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: false }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.sync({ isPlaying: true });
        });

        expect(mockPatch).not.toHaveBeenCalled();
    });

    it('debounces host sync then sends patch', async () => {
        mockPatch.mockResolvedValue({ data: { status: 'ok', state_version: 2, server_timestamp: 2000 } });

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.sync({ isPlaying: true, positionSeconds: 50 });
        });

        expect(mockPatch).not.toHaveBeenCalled();

        await waitFor(() => expect(mockPatch).toHaveBeenCalled(), { timeout: 3000 });

        expect(mockPatch).toHaveBeenCalledWith('/playback/1', expect.objectContaining({
            is_playing: true,
            position_seconds: 50,
        }));
    });

    it('syncImmediate calls patch then refetches state', async () => {
        mockPatch.mockResolvedValue({ data: { status: 'ok', state_version: 3, server_timestamp: 3000 } });

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1, isHost: true }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        mockGet.mockClear();

        await act(async () => {
            await result.current.syncImmediate({ isPlaying: true });
        });

        expect(mockPatch).toHaveBeenCalled();
        expect(mockGet).toHaveBeenCalled();
    });

    it('sets error state on fetch failure', async () => {
        mockGet.mockReset();
        mockGet.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() =>
            usePlaybackSync({ roomId: 1 }),
        );

        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });
        expect(result.current.error).toBe('Failed to sync playback');
    });

    it('calls onRemoteChange when new state arrives', async () => {
        const onRemoteChange = vi.fn();

        renderHook(() =>
            usePlaybackSync({ roomId: 1, onRemoteChange }),
        );

        await waitFor(() => {
            expect(onRemoteChange).toHaveBeenCalledWith(
                expect.objectContaining({ stateVersion: 1 }),
            );
        });
    });
});
