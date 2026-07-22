import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoPlayer } from '@/Components/composite/video-player';
import { usePlaybackSync } from '@/Hooks/use-playback-sync';
import type { PlaybackState, PlaybackMode } from '@/lib/types/playback';

const mockSync = vi.fn();
const mockSyncImmediate = vi.fn();

vi.mock('@/Hooks/use-playback-sync', () => ({
    usePlaybackSync: vi.fn(() => ({
        state: {
            isPlaying: false,
            positionSeconds: 0,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: 'https://example.com/video.mp4',
            playbackMode: 'direct' as const,
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        } satisfies PlaybackState,
        sync: mockSync,
        syncImmediate: mockSyncImmediate,
        loading: false,
        error: null,
    })),
}));

vi.mock('@/lib/types/playback', () => ({
    computeExpectedPosition: vi.fn(() => 0),
    toPlaybackState: vi.fn(),
}));

describe('VideoPlayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows empty state when no video URL is set', () => {
        const emptyState: PlaybackState = {
            isPlaying: false,
            positionSeconds: 0,
            durationSeconds: 0,
            playbackRate: 1,
            videoUrl: null,
            playbackMode: 'direct' as PlaybackMode,
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };
        vi.mocked(usePlaybackSync).mockReturnValueOnce({
            state: emptyState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        render(<VideoPlayer roomId={1} />);
        expect(screen.getByText('هنوز ویدیویی تنظیم نشده است')).toBeInTheDocument();
    });

    it('renders video element with source URL', () => {
        const { container } = render(
            <VideoPlayer roomId={1} initialVideoUrl="https://example.com/video.mp4" />,
        );
        const video = container.querySelector('video');
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
    });

    it('renders controls overlay with play/pause button when canControl is true', () => {
        render(<VideoPlayer roomId={1} initialVideoUrl="https://example.com/video.mp4" canControl />);
        expect(screen.getByLabelText('پخش یا مکث')).toBeInTheDocument();
    });

    it('hides play/pause button when canControl is false', () => {
        render(<VideoPlayer roomId={1} initialVideoUrl="https://example.com/video.mp4" canControl={false} />);
        expect(screen.queryByLabelText('پخش یا مکث')).not.toBeInTheDocument();
    });

    it('shows skip buttons when canControl is true', () => {
        render(<VideoPlayer roomId={1} initialVideoUrl="https://example.com/video.mp4" canControl />);
        expect(screen.getByLabelText('پرش ۱۰ ثانیه به عقب')).toBeInTheDocument();
        expect(screen.getByLabelText('پرش ۱۰ ثانیه به جلو')).toBeInTheDocument();
    });

    it('hides skip buttons when canControl is false', () => {
        render(<VideoPlayer roomId={1} initialVideoUrl="https://example.com/video.mp4" canControl={false} />);
        expect(screen.queryByLabelText('پرش ۱۰ ثانیه به عقب')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('پرش ۱۰ ثانیه به جلو')).not.toBeInTheDocument();
    });

    it('calls syncImmediate on play/pause click', () => {
        render(<VideoPlayer roomId={1} initialVideoUrl="https://example.com/video.mp4" canControl />);

        fireEvent.click(screen.getByLabelText('پخش یا مکث'));

        expect(mockSyncImmediate).toHaveBeenCalledWith({ isPlaying: true });
    });

    it('renders duration display', () => {
        render(<VideoPlayer roomId={1} initialVideoUrl="https://example.com/video.mp4" />);
        expect(screen.getByText('0:00')).toBeInTheDocument();
        expect(screen.getByText('5:00')).toBeInTheDocument();
    });

    it('renders children inside the player', () => {
        render(
            <VideoPlayer roomId={1} initialVideoUrl="https://example.com/video.mp4">
                <div data-testid="child">Child content</div>
            </VideoPlayer>,
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('uses proxy URL when playbackMode is proxy', () => {
        const proxyState: PlaybackState = {
            isPlaying: false,
            positionSeconds: 0,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: 'https://example.com/video.mp4',
            playbackMode: 'proxy',
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };
        vi.mocked(usePlaybackSync).mockReturnValueOnce({
            state: proxyState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        const { container } = render(<VideoPlayer roomId={1} />);
        const video = container.querySelector('video');
        expect(video).toHaveAttribute('src', '/proxy/video/1');
    });

    it('falls back to direct URL when proxy fails', () => {
        const proxyState: PlaybackState = {
            isPlaying: false,
            positionSeconds: 0,
            durationSeconds: 300,
            playbackRate: 1,
            videoUrl: 'https://example.com/backup.mp4',
            playbackMode: 'proxy',
            stateVersion: 1,
            serverTimestamp: Date.now() / 1000,
            updatedAt: new Date().toISOString(),
        };

        vi.mocked(usePlaybackSync).mockReturnValue({
            state: proxyState,
            sync: mockSync,
            syncImmediate: mockSyncImmediate,
            loading: false,
            error: null,
        });

        const { container } = render(<VideoPlayer roomId={1} />);
        const video = container.querySelector('video');

        fireEvent.error(video!);

        const newVideo = container.querySelector('video');
        expect(newVideo).toHaveAttribute('src', 'https://example.com/backup.mp4');
    });
});
