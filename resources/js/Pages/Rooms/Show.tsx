import { MemberList } from "@/Components/composite/member-list";
import { RoomChat } from "@/Components/composite/room-chat";
import { RoomOnboarding } from "@/Components/composite/room-onboarding";
import { useSubtitleSettings } from "@/Components/composite/subtitle-overlay";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

const SyncedVideoJsPlayer = lazy(() =>
    import("@/Components/Player/SyncedVideoJsPlayer").then((m) => ({
        default: m.SyncedVideoJsPlayer,
    })),
);
const RoomSettingsDialog = lazy(() =>
    import("@/Components/composite/room-settings").then((m) => ({
        default: m.RoomSettingsDialog,
    })),
);
const SetVideoDialog = lazy(() =>
    import("@/Components/composite/set-video-dialog").then((m) => ({
        default: m.SetVideoDialog,
    })),
);
const SubtitleManagerDialog = lazy(() =>
    import("@/Components/composite/subtitle-manager-dialog").then((m) => ({
        default: m.SubtitleManagerDialog,
    })),
);
const SubtitleSettingsDialog = lazy(() =>
    import("@/Components/composite/subtitle-settings").then((m) => ({
        default: m.SubtitleSettingsDialog,
    })),
);
const ConfirmDialog = lazy(() =>
    import("@/Components/composite/confirm-dialog").then((m) => ({
        default: m.ConfirmDialog,
    })),
);
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { usePresence } from "@/Hooks/use-presence";
import { useRoomOwnership } from "@/Hooks/use-room-ownership";
import { useSuggestNext } from "@/Hooks/use-suggest-next";
import { useSubtitles } from "@/Hooks/use-subtitles";
import AppLayout from "@/Layouts/AppLayout";
import type { PlaybackAction } from "@/lib/playback-actions";
import {
    formatDuration,
    safeCopyToClipboard,
    toPersianDigits,
} from "@/lib/utils";
import api from "@/lib/api";
import { useRoomUiStore } from "@/stores/room-ui";
import {
    MessageSquare,
    LogOut,
    Settings,
    Subtitles,
    Tv,
    Users,
} from "lucide-react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";

interface ChatMessage {
    id: number;
    user_id: number;
    body: string;
    user: { id: number; name: string };
    created_at: string;
}

interface Member {
    id: number;
    user: { id: number; name: string };
    last_seen_at: string;
}

interface Room {
    id: number;
    name: string;
    invite_code: string;
    video_url: string | null;
    is_playing: boolean;
    user_id: number;
    max_members: number;
    is_locked: boolean;
    active_subtitle_track_id: number | null;
    owner: { id: number; name: string };
    members: Member[];
    chat_messages: ChatMessage[];
}

interface ShowRoomProps {
    room: Room;
}

export default function ShowRoom({ room }: ShowRoomProps) {
    const activeTab = useRoomUiStore((s) => s.activeTab);
    const setActiveTab = useRoomUiStore((s) => s.setActiveTab);
    const [showSetVideo, setShowSetVideo] = useState(false);
    const [showSubSettings, setShowSubSettings] = useState(false);
    const [showSubManager, setShowSubManager] = useState(false);
    const [showRoomSettings, setShowRoomSettings] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(
        room.video_url,
    );
    const [settingVideo, setSettingVideo] = useState(false);
    const [videoRefreshKey, setVideoRefreshKey] = useState(0);
    const [chatUnread, setChatUnread] = useState(0);
    const [showOnboarding, setShowOnboarding] = useState(true);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [leavingRoom, setLeavingRoom] = useState(false);

    const {
        tracks,
        tracksError,
        activeTrackId,
        roomDefaultId,
        cues,
        subLoading,
        subError,
        trackToDelete,
        deletingTrack,
        setTrackToDelete,
        selectTrack,
        followRoomDefault,
        setRoomDefault,
        uploadTrack,
        deleteTrack,
    } = useSubtitles(room.id, room.active_subtitle_track_id);

    const {
        members: presenceMembers,
        connected,
        moments: presenceMoments,
    } = usePresence(room.id, {
        onRemoved: () => {
            toast.error("شما از اتاق حذف شده‌اید.");
            router.visit(route("dashboard"));
        },
    });
    const { settings } = useSubtitleSettings();
    const { auth } = usePage().props;
    const { ownerId, isOwner, transferOwnership } = useRoomOwnership({
        initialOwnerId: room.user_id,
        currentUserId: auth.user.id,
        presenceMembers,
    });
    const { suggestNext } = useSuggestNext(room.id);

    const handleCopy = async (text: string) => {
        const ok = await safeCopyToClipboard(text);
        if (ok) {
            toast.success("لینک دعوت کپی شد.");
        } else {
            toast.error("کپی شدن لینک ممکن نشد. لطفاً به‌صورت دستی کپی کنید.");
        }
    };

    useEffect(() => {
        setShowOnboarding(true);
    }, [room.id]);

    const handleSetVideo = async (url: string) => {
        if (!url.trim() || settingVideo) return;
        setSettingVideo(true);
        try {
            await api.post(`/playback/${room.id}/set-video`, {
                video_url: url.trim(),
            });
            setCurrentVideoUrl(url.trim());
            setShowSetVideo(false);
            setVideoRefreshKey((key) => key + 1);
            toast.success("ویدیو تنظیم شد.");
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    .response?.data?.message ||
                "تنظیم ویدیو ناموفق بود. لطفاً دوباره تلاش کنید.";
            toast.error(message);
            throw new Error(message);
        } finally {
            setSettingVideo(false);
        }
    };

    const handleKick = (_userId: number) => {
        setActiveTab("members");
    };

    const handleTransfer = (userId: number) => {
        transferOwnership(userId);
        setActiveTab("members");
    };

    const handleLeaveRoom = async () => {
        if (leavingRoom) return;
        setLeavingRoom(true);
        try {
            await api.post(`/rooms/${room.id}/leave`);
            toast.success("از اتاق خارج شدید.");
            router.visit(route("dashboard"));
        } catch {
            toast.error("خروج از اتاق ناموفق بود. لطفاً دوباره تلاش کنید.");
            setLeavingRoom(false);
        }
    };

    // Remote members' play/pause/seek actions arrive as coalesced broadcast
    // actions (see usePlaybackSync); surface each as one toast. The actor is
    // the room's controlling member — prefer the live roster's name (covers
    // ownership transfers) with the initial owner as fallback.
    const handlePlaybackAction = useCallback(
        (action: PlaybackAction) => {
            const actor = presenceMembers.find(
                (m) => m.user_id === action.actorId,
            );
            const name = actor?.name ?? room.owner.name;
            if (action.type === "play") {
                toast.message(`${name} ویدیو را پخش کرد`);
            } else if (action.type === "pause") {
                toast.message(`${name} ویدیو را متوقف کرد`);
            } else {
                toast.message(
                    `${name} به دقیقه ${toPersianDigits(formatDuration(action.positionSeconds ?? 0))} رفت`,
                );
            }
        },
        [presenceMembers, room.owner.name],
    );

    // dvh (where supported) tracks the mobile visual viewport so the fixed
    // room height never extends under the browser chrome during scroll —
    // vh alone overflows on mobile browsers.
    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8.5rem)] supports-[height:100dvh]:h-[calc(100dvh-8.5rem)]">
            <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">{room.name}</h1>
                        <p className="text-sm text-muted-foreground">
                            ساخته شده توسط {room.owner.name}
                            {room.is_locked && (
                                <span className="ms-2 text-warning">(قفل)</span>
                            )}
                        </p>
                    </div>
                    {isOwner && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowRoomSettings(true)}
                        >
                            <Settings className="h-4 w-4" />
                            تنظیمات اتاق
                        </Button>
                    )}
                    {!isOwner && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmLeave(true)}
                        >
                            <LogOut className="h-4 w-4" />
                            خروج از اتاق
                        </Button>
                    )}
                </div>

                {isOwner &&
                    room.video_url === null &&
                    room.members.length <= 1 &&
                    showOnboarding && (
                        <RoomOnboarding
                            onCopyInvite={() =>
                                handleCopy(route("rooms.join", room.invite_code))
                            }
                            onAddVideo={() => setShowSetVideo(true)}
                            onDismiss={() => setShowOnboarding(false)}
                        />
                    )}

                <div className="flex-1 relative min-h-0">
                    {room.video_url || currentVideoUrl ? (
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center h-full bg-muted rounded-2xl">
                                    <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                </div>
                            }
                        >
                            <SyncedVideoJsPlayer
                                roomId={room.id}
                                canControl={isOwner}
                                currentUserId={auth.user.id}
                                onPlaybackAction={handlePlaybackAction}
                                initialVideoUrl={room.video_url}
                                className="h-full"
                                onSuggestNext={suggestNext}
                                onOpenSubtitleSettings={() =>
                                    setShowSubSettings(true)
                                }
                                refreshKey={videoRefreshKey}
                                subtitles={{
                                    cues,
                                    settings,
                                    loading: subLoading,
                                    error: subError,
                                }}
                            />
                        </Suspense>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-muted rounded-2xl">
                            <div className="text-center p-4">
                                <p className="text-muted-foreground">
                                    هنوز ویدیویی تنظیم نشده است
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {isOwner && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSetVideo(true)}
                        >
                            <Tv className="h-4 w-4" />
                            ویدیو
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSubManager(true)}
                    >
                        <Subtitles className="h-4 w-4" />
                        زیرنویس
                    </Button>
                </div>
            </div>

            {/* On mobile the room stacks: without flex-1 + min-h-0 this column
                takes its full content height, so the chat card spills below
                the room container and the page scrolls under the chat's own
                scroll. lg:flex-none keeps the desktop row layout at w-80. */}
            <div className="flex-1 min-h-0 lg:w-80 lg:flex-none flex flex-col">
                <div className="flex rounded-xl bg-secondary p-1 mb-3">
                    <button
                        onClick={() => {
                            setActiveTab("chat");
                            setChatUnread(0);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            activeTab === "chat"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <MessageSquare className="h-4 w-4" />
                        چت
                        {chatUnread > 0 && activeTab !== "chat" && (
                            <span className="h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                                {chatUnread}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("members")}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            activeTab === "members"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Users className="h-4 w-4" />
                        اعضا
                    </button>
                </div>

                <Card className="flex-1 overflow-hidden">
                    <div className={activeTab === "chat" ? "h-full" : "hidden"}>
                        <RoomChat
                            roomId={room.id}
                            initialMessages={room.chat_messages}
                            onUnreadCountChange={setChatUnread}
                            presenceMoments={presenceMoments}
                        />
                    </div>
                    <div
                        className={
                            activeTab === "members" ? "h-full" : "hidden"
                        }
                    >
                        <CardContent className="p-4">
                            <MemberList
                                members={presenceMembers}
                                roomId={room.id}
                                ownerId={ownerId}
                                connected={connected}
                                currentUserId={auth.user.id}
                                onKick={handleKick}
                                onTransfer={handleTransfer}
                            />
                        </CardContent>
                    </div>
                </Card>
            </div>

            {showSetVideo && (
                <Suspense fallback={null}>
                    <SetVideoDialog
                        open={true}
                        onClose={() => setShowSetVideo(false)}
                        onSetVideo={handleSetVideo}
                        loading={settingVideo}
                        initialUrl={currentVideoUrl}
                    />
                </Suspense>
            )}

            {showSubManager && (
                <Suspense fallback={null}>
                    <SubtitleManagerDialog
                        open={true}
                        onClose={() => setShowSubManager(false)}
                        isOwner={isOwner}
                        tracks={tracks}
                        activeTrackId={activeTrackId}
                        roomDefaultId={roomDefaultId}
                        tracksError={tracksError}
                        onUploadTrack={uploadTrack}
                        onSelectTrack={selectTrack}
                        onFollowDefault={followRoomDefault}
                        onSetDefault={setRoomDefault}
                        onRequestDelete={(id) => {
                            setShowSubManager(false);
                            setTrackToDelete(id);
                        }}
                    />
                </Suspense>
            )}

            {showSubSettings && (
                <Suspense fallback={null}>
                    <SubtitleSettingsDialog
                        open={true}
                        onClose={() => setShowSubSettings(false)}
                    />
                </Suspense>
            )}

            {showRoomSettings && (
                <Suspense fallback={null}>
                    <RoomSettingsDialog
                        open={true}
                        onClose={() => setShowRoomSettings(false)}
                        room={{
                            id: room.id,
                            name: room.name,
                            invite_code: room.invite_code,
                            is_locked: room.is_locked,
                        }}
                    />
                </Suspense>
            )}

            {trackToDelete !== null && (
                <Suspense fallback={null}>
                    <ConfirmDialog
                        open={true}
                        onClose={() => {
                            if (!deletingTrack) setTrackToDelete(null);
                        }}
                        onConfirm={() =>
                            trackToDelete !== null && deleteTrack(trackToDelete)
                        }
                        title="حذف زیرنویس"
                        description="آیا از حذف این زیرنویس اطمینان دارید؟ این عمل قابل بازگشت نیست."
                        confirmLabel="حذف شود"
                        confirmVariant="destructive"
                        loading={deletingTrack}
                    />
                </Suspense>
            )}

            {confirmLeave && (
                <Suspense fallback={null}>
                    <ConfirmDialog
                        open={true}
                        onClose={() => {
                            if (!leavingRoom) setConfirmLeave(false);
                        }}
                        onConfirm={handleLeaveRoom}
                        title="خروج از اتاق"
                        description="آیا مطمئن هستید که می‌خواهید از این اتاق خارج شوید؟ برای بازگشت می‌توانید دوباره از لینک دعوت استفاده کنید."
                        confirmLabel="خروج"
                        confirmVariant="destructive"
                        loading={leavingRoom}
                    />
                </Suspense>
            )}
        </div>
    );
}

ShowRoom.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
