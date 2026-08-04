import { usePlaybackSync } from "@/Hooks/use-playback-sync";
import { computeExpectedPosition } from "@/lib/types/playback";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/Components/ui/button";
import {
    Maximize,
    Minimize,
    Pause,
    Play,
    RotateCcw,
    Send,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
} from "lucide-react";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";

const DRIFT_THRESHOLD = 2;

interface VideoPlayerProps {
    roomId: number;
    canControl?: boolean;
    initialVideoUrl?: string | null;
    className?: string;
    videoRef?: RefObject<HTMLVideoElement | null>;
    children?: React.ReactNode;
    onSuggestNext?: () => void;
}

function proxyUrl(roomId: number): string {
    return `/proxy/video/${roomId}`;
}

export function VideoPlayer({
    roomId,
    canControl = false,
    initialVideoUrl,
    className,
    videoRef: externalRef,
    children,
    onSuggestNext,
}: VideoPlayerProps) {
    const { state, sync, syncImmediate, loading, error } = usePlaybackSync({
        roomId,
        isHost: canControl,
    });
    const internalRef = useRef<HTMLVideoElement>(null);
    const videoRef = externalRef || internalRef;
    const lastTimeupdateSync = useRef(0);
    const endedAtRef = useRef(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [ended, setEnded] = useState(false);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    const [displayTime, setDisplayTime] = useState(0);
    const [proxyFailed, setProxyFailed] = useState(false);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const isMuted = muted || volume === 0;

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        // eslint-disable-next-line react-compiler/react-compiler
        video.volume = volume;
        video.muted = muted;
    }, [volume, muted, videoRef]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () =>
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange,
            );
    }, []);

    const toggleMute = useCallback(() => {
        setMuted((prev) => !prev);
        setVolume((prevVolume) =>
            muted && prevVolume === 0 ? 0.5 : prevVolume,
        );
    }, [muted]);

    const handleVolumeChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const next = Number(e.target.value);
            setVolume(next);
            setMuted(next === 0);
        },
        [],
    );

    const toggleFullscreen = useCallback(() => {
        const video = videoRef.current;
        if (!video || typeof video.requestFullscreen !== "function") return;

        if (document.fullscreenElement) {
            void document.exitFullscreen();
        } else {
            void video.requestFullscreen();
        }
    }, [videoRef]);

    const sourceUrl: string | undefined =
        state.playbackMode === "direct" || proxyFailed
            ? state.videoUrl || initialVideoUrl || undefined
            : proxyUrl(roomId);

    const handleVideoError = useCallback(() => {
        if (!proxyFailed && state.videoUrl) {
            setProxyFailed(true);
        }
    }, [proxyFailed, state.videoUrl]);

    useEffect(() => {
        setProxyFailed(false);
    }, [state.videoUrl]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !sourceUrl) return;

        const updateDisplay = () => {
            setDisplayTime(video.currentTime);
        };

        const handleSeeked = () => {
            setIsSeeking(false);
            updateDisplay();
        };

        video.addEventListener("timeupdate", updateDisplay);
        video.addEventListener("seeked", handleSeeked);
        return () => {
            video.removeEventListener("timeupdate", updateDisplay);
            video.removeEventListener("seeked", handleSeeked);
        };
    }, [sourceUrl, videoRef]);

    useEffect(() => {
        if (isSeeking) return;

        const video = videoRef.current;
        if (!video || !sourceUrl) return;

        if (state.isPlaying) {
            if (
                ended &&
                state.positionSeconds >= endedAtRef.current - DRIFT_THRESHOLD
            ) {
                return;
            }
            const expected = computeExpectedPosition(state, Date.now() / 1000);
            const diff = Math.abs(video.currentTime - expected);
            if (diff > DRIFT_THRESHOLD) {
                video.currentTime = expected;
            }
            video.play().catch(() => {
                // Autoplay is blocked by the browser (no prior user gesture).
                // Don't leave the guest on a silently-frozen video — surface
                // the tap-to-play overlay instead.
                if (!canControl) {
                    setAutoplayBlocked(true);
                }
            });
            if (ended) {
                setEnded(false);
            }
        } else {
            const targetTime = state.positionSeconds;
            const diff = Math.abs(video.currentTime - targetTime);
            if (diff > DRIFT_THRESHOLD) {
                video.currentTime = targetTime;
            }
            video.pause();
        }
    }, [state, sourceUrl, videoRef, isSeeking, ended, canControl]);

    const handleLocalPlay = useCallback(() => {
        const video = videoRef.current;
        if (!video || !sourceUrl) return;

        setAutoplayBlocked(false);
        video.play().catch(() => {
            setAutoplayBlocked(true);
        });
    }, [sourceUrl, videoRef]);

    const handleEnded = useCallback(() => {
        const video = videoRef.current;
        endedAtRef.current = video ? video.currentTime : state.positionSeconds;
        setEnded(true);
    }, [state.positionSeconds, videoRef]);

    const handlePlay = useCallback(() => {
        setEnded(false);
        setAutoplayBlocked(false);
    }, []);

    const handleReplay = useCallback(() => {
        if (!canControl) return;
        setEnded(false);
        syncImmediate({ isPlaying: true, positionSeconds: 0 });
    }, [canControl, syncImmediate]);

    const handlePlayPause = useCallback(() => {
        if (!canControl) return;
        const nextPlaying = !state.isPlaying;
        syncImmediate({ isPlaying: nextPlaying });
    }, [canControl, state.isPlaying, syncImmediate]);

    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video || !canControl) return;

        const now = Date.now();
        if (now - lastTimeupdateSync.current < 1000) return;
        lastTimeupdateSync.current = now;

        sync({
            positionSeconds: video.currentTime,
            durationSeconds: video.duration || 0,
        });
    }, [canControl, sync, videoRef]);

    const handleSeek = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!canControl) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = x / rect.width;
            const newTime = pct * (state.durationSeconds || 1);
            if (videoRef.current) {
                videoRef.current.currentTime = newTime;
            }
            setIsSeeking(true);
            syncImmediate({ positionSeconds: newTime });
        },
        [canControl, state.durationSeconds, syncImmediate, videoRef],
    );

    const seekTo = useCallback(
        (newTime: number) => {
            const duration = state.durationSeconds || 0;
            const clamped = Math.max(0, Math.min(newTime, duration));
            if (videoRef.current) {
                videoRef.current.currentTime = clamped;
            }
            setIsSeeking(true);
            syncImmediate({ positionSeconds: clamped });
        },
        [state.durationSeconds, syncImmediate, videoRef],
    );

    const handleSeekKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (!canControl) return;
            const current = videoRef.current?.currentTime ?? displayTime;
            const duration = state.durationSeconds || 0;
            const step = duration > 0 ? duration / 100 : 5;

            switch (e.key) {
                case "ArrowRight":
                    e.preventDefault();
                    seekTo(current + step);
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    seekTo(current - step);
                    break;
                case "Home":
                    e.preventDefault();
                    seekTo(0);
                    break;
                case "End":
                    e.preventDefault();
                    seekTo(duration);
                    break;
                default:
                    break;
            }
        },
        [canControl, displayTime, seekTo, state.durationSeconds, videoRef],
    );

    const skip = useCallback(
        (seconds: number) => {
            if (!canControl || !videoRef.current) return;
            const video = videoRef.current;
            const newTime = Math.max(
                0,
                Math.min(
                    video.currentTime + seconds,
                    state.durationSeconds || Infinity,
                ),
            );
            video.currentTime = newTime;
            setIsSeeking(true);
            syncImmediate({ positionSeconds: newTime });
        },
        [canControl, state.durationSeconds, syncImmediate, videoRef],
    );

    const effectiveUrl = state.videoUrl || initialVideoUrl;

    if (!effectiveUrl) {
        if (loading) {
            return (
                <div
                    className={cn(
                        "flex items-center justify-center h-full bg-muted rounded-2xl",
                        className,
                    )}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <p className="text-muted-foreground">
                            در حال بارگذاری ویدیو...
                        </p>
                    </div>
                </div>
            );
        }
        return (
            <div
                className={cn(
                    "flex items-center justify-center h-full bg-muted rounded-2xl",
                    className,
                )}
            >
                {error ? (
                    <div className="text-center">
                        <p className="text-destructive mb-2">
                            خطا در دریافت اطلاعات ویدیو
                        </p>
                        <p className="text-muted-foreground text-sm">{error}</p>
                    </div>
                ) : (
                    <p className="text-muted-foreground">
                        هنوز ویدیویی تنظیم نشده است
                    </p>
                )}
            </div>
        );
    }

    const progress =
        state.durationSeconds > 0
            ? (displayTime / state.durationSeconds) * 100
            : 0;

    return (
        <div
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
            <video
                ref={videoRef}
                key={sourceUrl}
                src={sourceUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onClick={handlePlayPause}
                onError={handleVideoError}
                onEnded={handleEnded}
                onPlay={handlePlay}
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
            />

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
                    <Button size="lg" onClick={handleLocalPlay}>
                        <Play className="h-5 w-5" />
                        شروع پخش
                    </Button>
                </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12 transition-opacity group-focus-within:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
                <div
                    role="slider"
                    tabIndex={canControl ? 0 : -1}
                    aria-label="موقعیت پخش"
                    aria-valuemin={0}
                    aria-valuemax={state.durationSeconds || 0}
                    aria-valuenow={Math.round(
                        displayTime || state.positionSeconds,
                    )}
                    aria-valuetext={`${formatDuration(displayTime || state.positionSeconds)} از ${formatDuration(state.durationSeconds)}`}
                    onClick={handleSeek}
                    onKeyDown={handleSeekKeyDown}
                    className="h-1 bg-white/30 rounded-full cursor-pointer mb-3 py-3 -my-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                        {canControl && (
                            <>
                                <button
                                    onClick={() => skip(-10)}
                                    className="p-1 hover:text-primary transition-colors"
                                    aria-label="پرش ۱۰ ثانیه به عقب"
                                >
                                    <SkipBack className="h-6 w-6" />
                                </button>
                                <button
                                    onClick={handlePlayPause}
                                    className="p-1 hover:text-primary transition-colors"
                                    aria-label="پخش یا مکث"
                                >
                                    {state.isPlaying ? (
                                        <Pause className="h-6 w-6" />
                                    ) : (
                                        <Play className="h-6 w-6" />
                                    )}
                                </button>
                                <button
                                    onClick={() => skip(10)}
                                    className="p-1 hover:text-primary transition-colors"
                                    aria-label="پرش ۱۰ ثانیه به جلو"
                                >
                                    <SkipForward className="h-6 w-6" />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <button
                            onClick={toggleMute}
                            className="p-1 hover:text-primary transition-colors"
                            aria-label={
                                isMuted ? "باز کردن صدا" : "بی‌صدا کردن"
                            }
                        >
                            {isMuted ? (
                                <VolumeX className="h-5 w-5" />
                            ) : (
                                <Volume2 className="h-5 w-5" />
                            )}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            aria-label="صدا"
                            className="w-16 sm:w-24 accent-primary"
                        />
                        <span>{formatDuration(displayTime)}</span>
                        <span>/</span>
                        <span>{formatDuration(state.durationSeconds)}</span>
                        <button
                            onClick={toggleFullscreen}
                            className="p-1 hover:text-primary transition-colors"
                            aria-label={
                                isFullscreen ? "خروج از تمام صفحه" : "تمام صفحه"
                            }
                        >
                            {isFullscreen ? (
                                <Minimize className="h-5 w-5" />
                            ) : (
                                <Maximize className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {children}
        </div>
    );
}
