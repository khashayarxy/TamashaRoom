import { createPlayer, I18nProvider } from "@videojs/react";
import "@videojs/react/i18n/locales/fa/register";
import { Video, VideoSkin, videoFeatures } from "@videojs/react/video";
import { shouldPreservePositionOnSourceChange } from "@/lib/player-source";
import { cn } from "@/lib/utils";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const Player = createPlayer({ features: videoFeatures });

export interface VideoJsPlayerHandle {
    getCurrentTime: () => number;
    getDuration: () => number;
    getVolume: () => number;
    isPlaying: () => boolean;
    seekTo: (time: number) => void;
    play: () => Promise<void> | void;
    pause: () => void;
    toggleMuted: () => void;
    toggleCaptions: () => void;
    enterFullscreen: () => void;
    getVideoElement: () => HTMLVideoElement | null;
}

export interface VideoJsPlayerProps {
    src: string;
    /** Content identity of `src`. Used to detect proxy→direct transport
     * fallbacks for the same video (preserve position) vs. a genuinely new
     * video (reset to 0). */
    videoUrl?: string | null;
    poster?: string | null;
    className?: string;
    subtitleSrc?: string | null;
    subtitleLang?: string | null;
    subtitleLabel?: string | null;
    onPlay?: () => void;
    onPause?: () => void;
    onSeeked?: () => void;
    onTimeUpdate?: (currentTime: number) => void;
    onEnded?: () => void;
    onReady?: () => void;
    onError?: () => void;
}

interface PlayerCallbacks {
    onPlay?: () => void;
    onPause?: () => void;
    onSeeked?: () => void;
    onTimeUpdate?: (currentTime: number) => void;
    onEnded?: () => void;
    onReady?: () => void;
    onError?: () => void;
}

interface PlayerBridgeProps extends PlayerCallbacks {
    ref: React.Ref<VideoJsPlayerHandle>;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    src?: string;
    videoUrl?: string | null;
}

/**
 * Lives inside the Player.Provider so it can reach the store. Owns the
 * imperative handle the sync shell drives, binds the media element's native
 * events, and routes source changes through the store's `loadSource`.
 */
function PlayerBridge({
    ref,
    videoRef,
    src,
    videoUrl,
    onPlay,
    onPause,
    onSeeked,
    onTimeUpdate,
    onEnded,
    onReady,
    onError,
}: PlayerBridgeProps) {
    const store = Player.usePlayer();
    const appliedSrcRef = useRef<string | null>(null);
    const appliedVideoUrlRef = useRef<string | null>(null);

    // Latest-callbacks ref: the native events are bound once to the media
    // element (which loadSource() keeps alive), so the handlers read through
    // this ref to always see the current props.
    const callbacksRef = useRef<PlayerCallbacks>({});
    useEffect(() => {
        callbacksRef.current = {
            onPlay,
            onPause,
            onSeeked,
            onTimeUpdate,
            onEnded,
            onReady,
            onError,
        };
    });

    useImperativeHandle(
        ref,
        () => ({
            getCurrentTime: () => videoRef.current?.currentTime ?? 0,
            getDuration: () => {
                const duration = videoRef.current?.duration;
                return Number.isFinite(duration) ? (duration ?? 0) : 0;
            },
            getVolume: () => store.volume,
            isPlaying: () => {
                const el = videoRef.current;
                return el ? !el.paused : false;
            },
            seekTo: (time: number) => {
                void store.seek(time);
            },
            play: () => store.play(),
            pause: () => {
                store.pause();
            },
            toggleMuted: () => {
                store.toggleMuted();
            },
            toggleCaptions: () => {
                store.toggleSubtitles();
            },
            enterFullscreen: () => {
                void store.toggleFullscreen();
            },
            getVideoElement: () => videoRef.current,
        }),
        [store, videoRef],
    );

    // v10 keeps the same <video> element across source changes (loadSource
    // mutates it in place), so listeners bound once here survive every swap —
    // no watchdog re-bind needed, unlike react-aptor's destroy/recreate cycle.
    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        const events: Array<{
            type: string;
            handler: () => void;
        }> = [
            { type: "play", handler: () => callbacksRef.current.onPlay?.() },
            { type: "pause", handler: () => callbacksRef.current.onPause?.() },
            {
                type: "seeked",
                handler: () => callbacksRef.current.onSeeked?.(),
            },
            { type: "ended", handler: () => callbacksRef.current.onEnded?.() },
            {
                type: "timeupdate",
                handler: () =>
                    callbacksRef.current.onTimeUpdate?.(el.currentTime),
            },
            { type: "error", handler: () => callbacksRef.current.onError?.() },
        ];

        for (const event of events) {
            el.addEventListener(event.type, event.handler);
        }

        let readyFired = false;
        const fireReady = () => {
            if (readyFired) return;
            readyFired = true;
            callbacksRef.current.onReady?.();
        };
        if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
            fireReady();
        } else {
            el.addEventListener("loadedmetadata", fireReady, { once: true });
        }

        return () => {
            for (const event of events) {
                el.removeEventListener(event.type, event.handler);
            }
            el.removeEventListener("loadedmetadata", fireReady);
        };
    }, [videoRef]);

    useEffect(() => {
        let cancelled = false;
        let timer = 0;

        const applySource = () => {
            if (cancelled || !src) return;

            const nextVideoUrl: string | null = videoUrl ?? null;
            const needsReload =
                src !== appliedSrcRef.current ||
                nextVideoUrl !== appliedVideoUrlRef.current;
            if (!needsReload) return;

            // loadSource() throws until the store is attached to the media
            // element; the Provider attaches in an effect after first mount.
            if (!store.target) {
                timer = window.setTimeout(applySource, 0);
                return;
            }

            if (
                shouldPreservePositionOnSourceChange({
                    previousSrc: appliedSrcRef.current,
                    nextSrc: src,
                    previousVideoUrl: appliedVideoUrlRef.current,
                    nextVideoUrl,
                })
            ) {
                const el = videoRef.current;
                if (
                    el &&
                    Number.isFinite(el.duration) &&
                    el.duration > 0 &&
                    el.currentTime > 0
                ) {
                    const previousTime = el.currentTime;
                    const restore = () => {
                        if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
                            const max = Number.isFinite(el.duration)
                                ? el.duration
                                : previousTime;
                            el.currentTime = Math.min(previousTime, max);
                        }
                        el.removeEventListener("loadedmetadata", restore);
                    };
                    el.addEventListener("loadedmetadata", restore);
                }
            }

            store.loadSource(src);
            appliedSrcRef.current = src;
            appliedVideoUrlRef.current = nextVideoUrl;
        };

        applySource();

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [src, store, videoUrl, videoRef]);

    return null;
}

export const VideoJsPlayer = forwardRef(function VideoJsPlayer(
    {
        src,
        videoUrl,
        poster,
        className,
        subtitleSrc,
        subtitleLang,
        subtitleLabel,
        onPlay,
        onPause,
        onSeeked,
        onTimeUpdate,
        onEnded,
        onReady,
        onError,
    }: VideoJsPlayerProps,
    ref: React.Ref<VideoJsPlayerHandle>,
) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    return (
        <Player.Provider>
            <I18nProvider locale="fa">
                <VideoSkin
                    className={cn("h-full w-full", className)}
                    poster={poster ?? undefined}
                >
                    <Video
                        ref={videoRef}
                        crossOrigin="anonymous"
                        playsInline
                        preload="auto"
                    >
                        {subtitleSrc ? (
                            <track
                                kind="captions"
                                src={subtitleSrc}
                                srcLang={subtitleLang ?? "fa"}
                                label={subtitleLabel ?? "زیرنویس"}
                                default
                            />
                        ) : null}
                    </Video>
                </VideoSkin>
                <PlayerBridge
                    ref={ref}
                    videoRef={videoRef}
                    src={src}
                    videoUrl={videoUrl}
                    onPlay={onPlay}
                    onPause={onPause}
                    onSeeked={onSeeked}
                    onTimeUpdate={onTimeUpdate}
                    onEnded={onEnded}
                    onReady={onReady}
                    onError={onError}
                />
            </I18nProvider>
        </Player.Provider>
    );
});
