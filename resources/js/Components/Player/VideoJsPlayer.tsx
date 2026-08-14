import {
    createPlayer,
    I18nProvider,
    useTranslator,
    usePlayer,
    Container,
    Poster,
    BufferingIndicator,
    ErrorDialog,
    AlertDialog,
    Controls,
    PlayButton,
    MuteButton,
    Popover,
    VolumeSlider,
    Time,
    TimeSlider,
    Slider,
    CaptionsButton,
    AirPlayButton,
    FullscreenButton,
    Hotkey,
    Gesture,
    StatusAnnouncer,
    Menu,
    useQualityOptions,
    useAudioTrackOptions,
    useCaptionsOptions,
} from "@videojs/react";
import "@videojs/react/i18n/locales/fa/register";
import { Video, videoFeatures } from "@videojs/react/video";
import { playbackRateFeature, remotePlaybackFeature } from "@videojs/core/dom";
import {
    AirPlayEnterIcon,
    AirPlayExitIcon,
    CaptionsOffIcon,
    CaptionsOnIcon,
    CheckIcon,
    ChevronIcon,
    FullscreenEnterIcon,
    FullscreenExitIcon,
    GearIcon,
    PauseIcon,
    PlayIcon,
    QualityIcon,
    RestartIcon,
    SpeechIcon,
    SpinnerIcon,
    VolumeHighIcon,
    VolumeLowIcon,
    VolumeOffIcon,
} from "@videojs/react/icons";
import {
    audioText,
    captionsText,
    qualityText,
    settingsText,
} from "@videojs/core/i18n/text/menu";
import { shouldPreservePositionOnSourceChange } from "@/lib/player-source";
import { cn } from "@/lib/utils";
import { Subtitles } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Exclude playbackRateFeature and remotePlaybackFeature so Video.js never registers or renders playback speed or cast options
const customVideoFeatures = videoFeatures.filter(
    (f) => f !== playbackRateFeature && f !== remotePlaybackFeature,
);

const Player = createPlayer({ features: customVideoFeatures });

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
    videoUrl?: string | null;
    poster?: string | null;
    className?: string;
    subtitleSrc?: string | null;
    subtitleLang?: string | null;
    subtitleLabel?: string | null;
    onOpenSubtitleSettings?: () => void;
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

const SEEK_TIME = 10;

const MediaButton = forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(function MediaButton({ className, ...props }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            className={cn(
                "media-button media-button--subtle media-button--icon",
                className,
            )}
            {...props}
        />
    );
});

function MediaVolumePopover() {
    const volumeUnsupported = usePlayer(
        (s) => s.volumeAvailability === "unsupported",
    );
    const muteBtn = (
        <MuteButton className="media-button--mute" render={<MediaButton />}>
            <VolumeOffIcon className="media-icon media-icon--volume-off" />
            <VolumeLowIcon className="media-icon media-icon--volume-low" />
            <VolumeHighIcon className="media-icon media-icon--volume-high" />
        </MuteButton>
    );

    if (volumeUnsupported) return muteBtn;

    return (
        <Popover.Root openOnHover delay={200} closeDelay={100} side="top">
            <Popover.Trigger render={muteBtn} />
            <Popover.Popup className="media-surface media-popover media-popover--volume">
                <VolumeSlider.Root
                    className="media-slider"
                    orientation="vertical"
                    thumbAlignment="edge"
                >
                    <Slider.Track className="media-slider__track">
                        <Slider.Fill className="media-slider__fill" />
                    </Slider.Track>
                    <Slider.Thumb className="media-slider__thumb media-slider__thumb--persistent" />
                </VolumeSlider.Root>
            </Popover.Popup>
        </Popover.Root>
    );
}

function MenuChevron({ flipped = false }: { flipped?: boolean }) {
    return (
        <ChevronIcon
            className={cn(
                "media-icon media-menu__chevron",
                flipped ? "media-icon--flipped" : undefined,
            )}
        />
    );
}

function TamashaSettingsMenu({
    onOpenSubtitleSettings,
}: {
    onOpenSubtitleSettings?: () => void;
}) {
    const t = useTranslator();
    const quality = useQualityOptions();
    const audioTrack = useAudioTrackOptions();
    const captions = useCaptionsOptions();

    const hasQuality = quality?.state.availability === "available";
    const hasAudioTrack = audioTrack?.state.availability === "available";
    const hasCaptions = captions?.state.availability === "available";

    return (
        <Menu.Root side="top" align="center">
            <Menu.Trigger
                aria-label={t(settingsText)}
                className="media-button--settings"
                render={<MediaButton />}
            >
                <GearIcon className="media-icon media-icon--settings" />
            </Menu.Trigger>
            <Menu.Content className="media-surface media-popover media-menu media-menu--settings">
                <Menu.View className="media-menu__panel">
                    <div className="media-menu__group">
                        {/* 1. Subtitle Settings Dialog Trigger */}
                        {onOpenSubtitleSettings && (
                            <button
                                type="button"
                                onClick={onOpenSubtitleSettings}
                                className="media-menu__item media-menu__item--submenu w-full flex items-center justify-between text-start cursor-pointer hover:bg-white/10"
                            >
                                <span className="flex items-center gap-2">
                                    <Subtitles className="media-icon text-primary" />
                                    <span>تنظیمات زیرنویس</span>
                                </span>
                            </button>
                        )}

                        {/* 2. Quality options (if present) */}
                        {hasQuality && quality ? (
                            <Menu.Root>
                                <Menu.Trigger
                                    type="quality"
                                    className="media-menu__item media-menu__item--submenu"
                                    render={(props) => (
                                        <div {...props}>
                                            <QualityIcon className="media-icon" />
                                            <span>{t(qualityText)}</span>
                                            <span className="media-menu__hint">
                                                <Menu.ItemValue className="media-menu__hint-label" />
                                                <MenuChevron />
                                            </span>
                                        </div>
                                    )}
                                />
                                <Menu.Content className="media-menu__panel">
                                    <Menu.Back className="media-menu__back">
                                        <MenuChevron flipped />
                                        {t(qualityText)}
                                    </Menu.Back>
                                    <Menu.Separator className="media-menu__separator" />
                                    <Menu.RadioGroup
                                        className="media-menu__group"
                                        value={quality.value}
                                        onValueChange={quality.setValue}
                                        aria-label={t(qualityText)}
                                    >
                                        {quality.options.map((option) => (
                                            <Menu.RadioItem
                                                key={option.value}
                                                className="media-menu__item"
                                                value={option.value}
                                                disabled={option.disabled}
                                            >
                                                <span>
                                                    {option.label}
                                                    {option.tier ? (
                                                        <sup className="media-menu__tier">
                                                            {option.tier}
                                                        </sup>
                                                    ) : null}
                                                </span>
                                                {option.badge ? (
                                                    <span className="media-badge">
                                                        {option.badge}
                                                    </span>
                                                ) : null}
                                                <Menu.ItemIndicator
                                                    checked={
                                                        option.value ===
                                                        quality.value
                                                    }
                                                    forceMount
                                                    className="media-menu__indicator"
                                                >
                                                    <CheckIcon className="media-icon" />
                                                </Menu.ItemIndicator>
                                            </Menu.RadioItem>
                                        ))}
                                    </Menu.RadioGroup>
                                </Menu.Content>
                            </Menu.Root>
                        ) : null}

                        {/* 3. Audio tracks (if present) */}
                        {hasAudioTrack && audioTrack ? (
                            <Menu.Root>
                                <Menu.Trigger
                                    type="audio-track"
                                    className="media-menu__item media-menu__item--submenu"
                                    render={(props) => (
                                        <div {...props}>
                                            <SpeechIcon className="media-icon" />
                                            <span>{t(audioText)}</span>
                                            <span className="media-menu__hint">
                                                <Menu.ItemValue className="media-menu__hint-label" />
                                                <MenuChevron />
                                            </span>
                                        </div>
                                    )}
                                />
                                <Menu.Content className="media-menu__panel">
                                    <Menu.Back className="media-menu__back">
                                        <MenuChevron flipped />
                                        {t(audioText)}
                                    </Menu.Back>
                                    <Menu.Separator className="media-menu__separator" />
                                    <Menu.RadioGroup
                                        className="media-menu__group"
                                        value={audioTrack.value}
                                        onValueChange={audioTrack.setValue}
                                        aria-label={t(audioText)}
                                    >
                                        {audioTrack.options.map((option) => (
                                            <Menu.RadioItem
                                                key={option.value}
                                                className="media-menu__item"
                                                value={option.value}
                                                disabled={option.disabled}
                                            >
                                                <span>{option.label}</span>
                                                <Menu.ItemIndicator
                                                    checked={
                                                        option.value ===
                                                        audioTrack.value
                                                    }
                                                    forceMount
                                                    className="media-menu__indicator"
                                                >
                                                    <CheckIcon className="media-icon" />
                                                </Menu.ItemIndicator>
                                            </Menu.RadioItem>
                                        ))}
                                    </Menu.RadioGroup>
                                </Menu.Content>
                            </Menu.Root>
                        ) : null}

                        {/* 4. Captions tracks (if present) */}
                        {hasCaptions && captions ? (
                            <Menu.Root>
                                <Menu.Trigger
                                    type="captions"
                                    className="media-menu__item media-menu__item--submenu"
                                    render={(props) => (
                                        <div {...props}>
                                            <CaptionsOffIcon className="media-icon" />
                                            <span>{t(captionsText)}</span>
                                            <span className="media-menu__hint">
                                                <Menu.ItemValue className="media-menu__hint-label" />
                                                <MenuChevron />
                                            </span>
                                        </div>
                                    )}
                                />
                                <Menu.Content className="media-menu__panel">
                                    <Menu.Back className="media-menu__back">
                                        <MenuChevron flipped />
                                        {t(captionsText)}
                                    </Menu.Back>
                                    <Menu.Separator className="media-menu__separator" />
                                    <Menu.RadioGroup
                                        className="media-menu__group"
                                        value={captions.value}
                                        onValueChange={captions.setValue}
                                        aria-label={t(captionsText)}
                                    >
                                        {captions.options.map((option) => (
                                            <Menu.RadioItem
                                                key={option.value}
                                                className="media-menu__item"
                                                value={option.value}
                                                disabled={option.disabled}
                                            >
                                                <span>{option.label}</span>
                                                <Menu.ItemIndicator
                                                    checked={
                                                        option.value ===
                                                        captions.value
                                                    }
                                                    forceMount
                                                    className="media-menu__indicator"
                                                >
                                                    <CheckIcon className="media-icon" />
                                                </Menu.ItemIndicator>
                                            </Menu.RadioItem>
                                        ))}
                                    </Menu.RadioGroup>
                                </Menu.Content>
                            </Menu.Root>
                        ) : null}
                    </div>
                </Menu.View>
            </Menu.Content>
        </Menu.Root>
    );
}

function MediaAirPlayControl() {
    return (
        <AirPlayButton
            className="media-button--airplay"
            render={<MediaButton aria-label="پخش بی‌سیم" />}
        >
            <AirPlayEnterIcon className="media-icon media-icon--airplay-enter" />
            <AirPlayExitIcon className="media-icon media-icon--airplay-exit" />
        </AirPlayButton>
    );
}

function MediaFullscreenControl() {
    return (
        <FullscreenButton
            className="media-button--fullscreen"
            render={<MediaButton aria-label="تمام‌صفحه" />}
        >
            <FullscreenEnterIcon className="media-icon media-icon--fullscreen-enter" />
            <FullscreenExitIcon className="media-icon media-icon--fullscreen-exit" />
        </FullscreenButton>
    );
}

interface TamashaVideoSkinProps {
    children?: React.ReactNode;
    className?: string;
    poster?: string | null;
    placeholder?: string;
    style?: React.CSSProperties;
    onOpenSubtitleSettings?: () => void;
}

function TamashaVideoSkin({
    children,
    className,
    poster,
    placeholder,
    style,
    onOpenSubtitleSettings,
    ...rest
}: TamashaVideoSkinProps) {
    const containerStyle: React.CSSProperties = {
        containerType: "inline-size",
        ...(placeholder
            ? {
                  "--media-poster-placeholder": `url(${placeholder})`,
                  ...style,
              }
            : style),
    };

    return (
        <Container
            className={cn(
                "media-default-skin media-default-skin--video",
                className,
            )}
            style={containerStyle}
            {...rest}
        >
            {children}
            {poster && <Poster src={poster} />}
            <BufferingIndicator
                render={(props) => (
                    <div {...props} className="media-buffering-indicator">
                        <SpinnerIcon className="media-icon" />
                    </div>
                )}
            />
            <ErrorDialog.Root>
                <AlertDialog.Popup className="media-error text-center">
                    <div className="media-error__dialog media-surface text-center">
                        <div className="media-error__content text-center">
                            <ErrorDialog.Title className="media-error__title text-center" />
                            <ErrorDialog.Description className="media-error__description text-center" />
                        </div>
                        <div className="media-error__actions flex justify-center">
                            <ErrorDialog.Close className="media-button media-button--primary" />
                        </div>
                    </div>
                </AlertDialog.Popup>
            </ErrorDialog.Root>

            <Controls.Root className="media-surface media-controls media-controls--root">
                <div className="media-surface media-controls media-controls--primary">
                    {/* 1. Left Control Group: Play & Volume */}
                    <div className="media-button-group">
                        <PlayButton
                            className="media-button--play"
                            render={<MediaButton aria-label="پخش" />}
                        >
                            <RestartIcon className="media-icon media-icon--restart" />
                            <PlayIcon className="media-icon media-icon--play" />
                            <PauseIcon className="media-icon media-icon--pause" />
                        </PlayButton>
                        <MediaVolumePopover />
                    </div>

                    {/* 2. Center Control Group: Time & Scrubber Slider */}
                    <div className="media-time-controls">
                        <Time.Value type="current" className="media-time" />
                        <TimeSlider.Root className="media-slider">
                            <Slider.Track className="media-slider__track">
                                <Slider.Fill className="media-slider__fill" />
                                <Slider.Buffer className="media-slider__buffer" />
                            </Slider.Track>
                            <Slider.Thumb className="media-slider__thumb" />
                            <Slider.Preview className="media-slider__preview">
                                <Slider.Value
                                    type="pointer"
                                    className="media-time media-slider__value"
                                />
                            </Slider.Preview>
                        </TimeSlider.Root>
                        <Time.Value
                            toggle
                            type="remaining"
                            className="media-time"
                        />
                    </div>

                    {/* 3. Right Primary Control Group: Captions CC & Gear Menu ⚙️ */}
                    <div className="media-button-group">
                        <CaptionsButton
                            className="media-button--captions"
                            render={<MediaButton aria-label="زیرنویس" />}
                        >
                            <CaptionsOffIcon className="media-icon media-icon--captions-off" />
                            <CaptionsOnIcon className="media-icon media-icon--captions-on" />
                        </CaptionsButton>
                        <TamashaSettingsMenu
                            onOpenSubtitleSettings={onOpenSubtitleSettings}
                        />
                    </div>
                </div>

                {/* 4. Secondary Control Group (Far Right): AirPlay, Fullscreen */}
                <div className="media-surface media-controls media-controls--secondary">
                    <div className="media-button-group">
                        <MediaAirPlayControl />
                        <MediaFullscreenControl />
                    </div>
                </div>
            </Controls.Root>

            <div className="media-overlay" />
            <Hotkey keys="Space" action="togglePaused" />
            <Hotkey keys="k" action="togglePaused" />
            <Hotkey keys="m" action="toggleMuted" />
            <Hotkey keys="f" action="toggleFullscreen" />
            <Hotkey keys="c" action="toggleSubtitles" />
            <Hotkey keys="ArrowRight" action="seekStep" value={SEEK_TIME / 2} />
            <Hotkey keys="ArrowLeft" action="seekStep" value={-5} />
            <Hotkey keys="l" action="seekStep" value={SEEK_TIME} />
            <Hotkey keys="j" action="seekStep" value={-10} />
            <Hotkey keys="ArrowUp" action="volumeStep" value={0.05} />
            <Hotkey keys="ArrowDown" action="volumeStep" value={-0.05} />
            <Hotkey keys="0-9" action="seekToPercent" />
            <Hotkey keys="Home" action="seekToPercent" value={0} />
            <Hotkey keys="End" action="seekToPercent" value={100} />
            <Gesture
                type="tap"
                action="togglePaused"
                pointer="mouse"
                region="center"
            />
            <Gesture type="tap" action="toggleControls" pointer="touch" />
            <Gesture
                type="doubletap"
                action="seekStep"
                value={-10}
                region="left"
            />
            <Gesture
                type="doubletap"
                action="toggleFullscreen"
                region="center"
            />
            <Gesture
                type="doubletap"
                action="seekStep"
                value={SEEK_TIME}
                region="right"
            />
            <StatusAnnouncer className="media-sr-only" />
        </Container>
    );
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
        onOpenSubtitleSettings,
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
                <TamashaVideoSkin
                    className={cn("h-full w-full", className)}
                    poster={poster ?? undefined}
                    onOpenSubtitleSettings={onOpenSubtitleSettings}
                >
                    <Video
                        ref={videoRef}
                        crossOrigin="anonymous"
                        playsInline
                        preload="auto"
                        disablePictureInPicture
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
                </TamashaVideoSkin>
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
