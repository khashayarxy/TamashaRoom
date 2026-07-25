import { usePlaybackSync } from "@/Hooks/use-playback-sync";
import { computeExpectedPosition } from "@/lib/types/playback";
import { cn, formatDuration } from "@/lib/utils";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";

const DRIFT_THRESHOLD = 2;

interface VideoPlayerProps {
    roomId: number;
    canControl?: boolean;
    initialVideoUrl?: string | null;
    className?: string;
    videoRef?: RefObject<HTMLVideoElement | null>;
    children?: React.ReactNode;
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
}: VideoPlayerProps) {
    const { state, sync, syncImmediate } = usePlaybackSync({
        roomId,
        isHost: canControl,
    });
    const internalRef = useRef<HTMLVideoElement>(null);
    const videoRef = externalRef || internalRef;
    const lastTimeupdateSync = useRef(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [displayTime, setDisplayTime] = useState(0);
    const [proxyFailed, setProxyFailed] = useState(false);

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
            const expected = computeExpectedPosition(state, Date.now() / 1000);
            const diff = Math.abs(video.currentTime - expected);
            if (diff > DRIFT_THRESHOLD) {
                // eslint-disable-next-line react-compiler/react-compiler
                video.currentTime = expected;
            }
            video.play().catch(() => {});
        } else {
            const targetTime = state.positionSeconds;
            const diff = Math.abs(video.currentTime - targetTime);
            if (diff > DRIFT_THRESHOLD) {
                video.currentTime = targetTime;
            }
            video.pause();
        }
    }, [state, sourceUrl, videoRef, isSeeking]);

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
        return (
            <div
                className={cn(
                    "flex items-center justify-center h-full bg-muted rounded-2xl",
                    className,
                )}
            >
                <p className="text-muted-foreground">
                    هنوز ویدیویی تنظیم نشده است
                </p>
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
            <video
                ref={videoRef}
                key={sourceUrl}
                src={sourceUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onClick={handlePlayPause}
                onError={handleVideoError}
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
            />

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12 opacity-0 group-hover:opacity-100 transition-opacity">
                <div
                    className="h-1 bg-white/30 rounded-full cursor-pointer mb-3"
                    onClick={handleSeek}
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
                        <span>{formatDuration(displayTime)}</span>
                        <span>/</span>
                        <span>{formatDuration(state.durationSeconds)}</span>
                    </div>
                </div>
            </div>

            {children}
        </div>
    );
}
