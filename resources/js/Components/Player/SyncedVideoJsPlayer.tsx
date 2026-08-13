import {
    VideoJsPlayer,
    type VideoJsPlayerHandle,
} from "@/Components/Player/VideoJsPlayer";
import { SubtitleOverlay } from "@/Components/composite/subtitle-overlay";
import { Button } from "@/Components/ui/button";
import { usePlaybackSync } from "@/Hooks/use-playback-sync";
import { computeExpectedPosition } from "@/lib/types/playback";
import type { SubtitleCue, SubtitleSettings } from "@/lib/types/subtitle";
import { cn } from "@/lib/utils";
import { Play, RotateCcw, Send, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DRIFT_THRESHOLD = 2;

export interface SyncedVideoJsPlayerSubtitles {
    cues: SubtitleCue[];
    settings: SubtitleSettings;
    loading?: boolean;
    error?: string | null;
}

interface SyncedVideoJsPlayerProps {
    roomId: number;
    canControl?: boolean;
    initialVideoUrl?: string | null;
    className?: string;
    onSuggestNext?: () => void;
    onOpenSubtitleSettings?: () => void;
    subtitles?: SyncedVideoJsPlayerSubtitles;
    /**
     * Bumped after a video mutation (set/remove) so the host reconciles its
     * playback state from the authoritative GET instead of waiting on a
     * broadcast that may be delayed or undelivered.
     */
    refreshKey?: number;
}

function proxyUrl(roomId: number): string {
    return `/proxy/video/${roomId}`;
}

export function SyncedVideoJsPlayer({
    roomId,
    canControl = false,
    initialVideoUrl,
    className,
    onSuggestNext,
    onOpenSubtitleSettings,
    subtitles,
    refreshKey,
}: SyncedVideoJsPlayerProps) {
    const { state, sync, syncImmediate, loading, error } = usePlaybackSync({
        roomId,
        isHost: canControl,
        refreshKey,
    });
    const playerRef = useRef<VideoJsPlayerHandle>(null);
    const lastTimeupdateSyncRef = useRef(0);
    const endedAtRef = useRef(0);
    // Set while the apply effect drives play()/pause() programmatically. The
    // native media events those calls trigger must not be mistaken for a user
    // gesture, or the host loops: play → sync → poll → apply → play → …
    const applyingRef = useRef(false);
    const [ready, setReady] = useState(false);
    const [ended, setEnded] = useState(false);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    const [proxyFailed, setProxyFailed] = useState(false);

    useEffect(() => {
        setProxyFailed(false);
    }, [state.videoUrl]);

    const sourceUrl: string | undefined =
        state.playbackMode === "direct" || proxyFailed
            ? state.videoUrl || initialVideoUrl || undefined
            : proxyUrl(roomId);

    const videoUrl = state.videoUrl ?? initialVideoUrl ?? null;

    const handleVideoError = useCallback(() => {
        if (!proxyFailed && state.videoUrl) {
            setProxyFailed(true);
        }
    }, [proxyFailed, state.videoUrl]);

    // Apply the authoritative room state to this client. The host is
    // authoritative for its own playback — it never gets yanked backwards on
    // a poll response. Guests receive drift corrections toward the expected
    // position and an autoplay-blocked overlay when the browser rejects the
    // programmatic play.
    useEffect(() => {
        const player = playerRef.current;
        if (!player || !ready || !sourceUrl) return;

        if (state.isPlaying) {
            if (
                ended &&
                state.positionSeconds >= endedAtRef.current - DRIFT_THRESHOLD
            ) {
                return;
            }

            if (!canControl) {
                const expected = computeExpectedPosition(
                    state,
                    Date.now() / 1000,
                );
                const diff = Math.abs(player.getCurrentTime() - expected);
                if (diff > DRIFT_THRESHOLD) {
                    player.seekTo(expected);
                }
            }

            const playResult = (() => {
                applyingRef.current = true;
                try {
                    return player.play();
                } finally {
                    // The native events fire in a later task; keep the guard
                    // up briefly so they can't re-enter sync.
                    setTimeout(() => {
                        applyingRef.current = false;
                    }, 100);
                }
            })();
            if (!canControl && playResult && "catch" in playResult) {
                playResult.catch((err: unknown) => {
                    // Only a genuine autoplay-policy rejection (NotAllowedError)
                    // means the guest must tap to start. Media-load errors must
                    // NOT re-surface the tap-to-play overlay — the proxy→direct
                    // fallback keeps the guest on a working stream instead.
                    if ((err as DOMException)?.name === "NotAllowedError") {
                        setAutoplayBlocked(true);
                    }
                });
            }
            if (ended) {
                setEnded(false);
            }
        } else {
            if (!canControl) {
                const diff = Math.abs(
                    player.getCurrentTime() - state.positionSeconds,
                );
                if (diff > DRIFT_THRESHOLD) {
                    player.seekTo(state.positionSeconds);
                }
            }
            applyingRef.current = true;
            try {
                player.pause();
            } finally {
                setTimeout(() => {
                    applyingRef.current = false;
                }, 100);
            }
        }
    }, [canControl, ended, ready, sourceUrl, state]);

    const handleReady = useCallback(() => {
        setReady(true);
    }, []);

    const handlePlay = useCallback(() => {
        setAutoplayBlocked(false);
        setEnded(false);
        if (!canControl) return;
        if (applyingRef.current) return;
        syncImmediate({
            isPlaying: true,
            positionSeconds: playerRef.current?.getCurrentTime() ?? 0,
        });
    }, [canControl, syncImmediate]);

    const handlePause = useCallback(() => {
        if (!canControl) return;
        if (applyingRef.current) return;
        syncImmediate({
            isPlaying: false,
            positionSeconds: playerRef.current?.getCurrentTime() ?? 0,
        });
    }, [canControl, syncImmediate]);

    const handleSeeked = useCallback(() => {
        if (!canControl) return;
        syncImmediate({
            positionSeconds: playerRef.current?.getCurrentTime() ?? 0,
        });
    }, [canControl, syncImmediate]);

    const handleTimeUpdate = useCallback(
        (currentTime: number) => {
            if (!canControl) return;
            const now = Date.now();
            if (now - lastTimeupdateSyncRef.current < 1000) return;
            lastTimeupdateSyncRef.current = now;
            sync({
                positionSeconds: currentTime,
                durationSeconds: playerRef.current?.getDuration() ?? 0,
            });
        },
        [canControl, sync],
    );

    const handleEnded = useCallback(() => {
        endedAtRef.current =
            playerRef.current?.getCurrentTime() ?? state.positionSeconds;
        setEnded(true);
    }, [state.positionSeconds]);

    const handleReplay = useCallback(() => {
        if (!canControl) return;
        setEnded(false);
        syncImmediate({ isPlaying: true, positionSeconds: 0 });
    }, [canControl, syncImmediate]);

    const handleResumeBlockedPlay = useCallback(() => {
        const player = playerRef.current;
        if (!player) return;
        setAutoplayBlocked(false);
        const playResult = player.play();
        if (playResult && "catch" in playResult) {
            playResult.catch((err: unknown) => {
                // Same rule as the sync loop: only a real autoplay block
                // re-shows the overlay; media errors fall through to the
                // proxy→direct fallback.
                if ((err as DOMException)?.name === "NotAllowedError") {
                    setAutoplayBlocked(true);
                }
            });
        }
    }, []);

    // Live ref for the cue overlay: reading `.current` resolves to the actual
    // media element owned by the player. loadSource() mutates the same element
    // in place, so a getter that reads through the imperative handle stays
    // current across source changes.
    const subtitleVideoRef = useMemo<React.RefObject<HTMLVideoElement | null>>(
        () => ({
            get current(): HTMLVideoElement | null {
                return playerRef.current?.getVideoElement() ?? null;
            },
        }),
        [],
    );

    const effectiveUrl = state.videoUrl || initialVideoUrl;

    return (
        <div
            dir="ltr"
            style={{ containerType: "inline-size" }}
            className={cn(
                "relative group overflow-hidden rounded-2xl bg-black",
                className,
            )}
        >
            {error && (
                <div className="absolute top-0 left-0 right-0 z-10 bg-destructive/90 text-destructive-foreground text-xs text-center py-1.5 px-4">
                    خطا در همگام‌سازی &mdash; در حال تلاش مجدد
                </div>
            )}

            {effectiveUrl ? (
                <VideoJsPlayer
                    ref={playerRef}
                    src={sourceUrl ?? effectiveUrl}
                    videoUrl={videoUrl}
                    className="w-full h-full"
                    onOpenSubtitleSettings={onOpenSubtitleSettings}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeeked={handleSeeked}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                    onReady={handleReady}
                    onError={handleVideoError}
                />
            ) : (
                <div className="flex items-center justify-center h-full bg-muted rounded-2xl">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            <p className="text-muted-foreground">
                                در حال بارگذاری ویدیو...
                            </p>
                        </div>
                    ) : (
                        <div className="text-center p-4">
                            {error ? (
                                <>
                                    <p className="text-destructive-text mb-2">
                                        خطا در دریافت اطلاعات ویدیو
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        {error}
                                    </p>
                                </>
                            ) : (
                                <p className="text-muted-foreground">
                                    هنوز ویدیویی تنظیم نشده است
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {ended && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                    <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-card/90 backdrop-blur-sm">
                        <p className="text-sm font-medium">
                            ویدیو به پایان رسید
                        </p>
                        <div className="flex gap-2">
                            {canControl && (
                                <Button size="sm" onClick={handleReplay}>
                                    <RotateCcw className="h-4 w-4" />
                                    دوباره ببینیم
                                </Button>
                            )}
                            {onSuggestNext && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={onSuggestNext}
                                >
                                    <Send className="h-4 w-4" />
                                    پیشنهاد بعدی
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {!canControl && !ended && autoplayBlocked && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
                    <Button size="lg" onClick={handleResumeBlockedPlay}>
                        <Play className="h-5 w-5" />
                        شروع پخش
                    </Button>
                </div>
            )}

            {subtitles && (
                <SubtitleOverlay
                    videoRef={subtitleVideoRef}
                    cues={subtitles.cues}
                    settings={subtitles.settings}
                    loading={subtitles.loading}
                    error={subtitles.error}
                />
            )}
        </div>
    );
}
