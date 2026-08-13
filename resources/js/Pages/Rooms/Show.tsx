import { MemberList } from "@/Components/composite/member-list";
import { ConfirmDialog } from "@/Components/composite/confirm-dialog";
import { RoomChat } from "@/Components/composite/room-chat";
import { RoomOnboarding } from "@/Components/composite/room-onboarding";
import { RoomSettingsDialog } from "@/Components/composite/room-settings";
import { useSubtitleSettings } from "@/Components/composite/subtitle-overlay";
import { SubtitleSettingsDialog } from "@/Components/composite/subtitle-settings";
import { SyncedVideoJsPlayer } from "@/Components/Player/SyncedVideoJsPlayer";
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { usePresence } from "@/Hooks/use-presence";
import { useRoomOwnership } from "@/Hooks/use-room-ownership";
import { useSuggestNext } from "@/Hooks/use-suggest-next";
import { useSubtitles } from "@/Hooks/use-subtitles";
import AppLayout from "@/Layouts/AppLayout";
import { safeCopyToClipboard } from "@/lib/utils";
import api from "@/lib/api";
import { useRoomUiStore } from "@/stores/room-ui";
import {
    MessageSquare,
    Settings,
    Star,
    Subtitles,
    Trash2,
    Tv,
    Upload,
    Users,
    X,
} from "lucide-react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

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
    const showSetVideo = useRoomUiStore((s) => s.showSetVideo);
    const setShowSetVideo = useRoomUiStore((s) => s.setShowSetVideo);
    const videoUrl = useRoomUiStore((s) => s.videoUrl);
    const setVideoUrl = useRoomUiStore((s) => s.setVideoUrl);
    const showSubSettings = useRoomUiStore((s) => s.showSubSettings);
    const setShowSubSettings = useRoomUiStore((s) => s.setShowSubSettings);
    const showSubManager = useRoomUiStore((s) => s.showSubManager);
    const setShowSubManager = useRoomUiStore((s) => s.setShowSubManager);
    const showRoomSettings = useRoomUiStore((s) => s.showRoomSettings);
    const setShowRoomSettings = useRoomUiStore((s) => s.setShowRoomSettings);
    const roomName = useRoomUiStore((s) => s.roomName);
    const setRoomName = useRoomUiStore((s) => s.setRoomName);
    const roomInviteCode = useRoomUiStore((s) => s.roomInviteCode);
    const setRoomInviteCode = useRoomUiStore((s) => s.setRoomInviteCode);
    const roomIsLocked = useRoomUiStore((s) => s.roomIsLocked);
    const setRoomIsLocked = useRoomUiStore((s) => s.setRoomIsLocked);
    const setOwnerId = useRoomUiStore((s) => s.setOwnerId);
    const [settingVideo, setSettingVideo] = useState(false);
    const [videoRefreshKey, setVideoRefreshKey] = useState(0);
    const [chatUnread, setChatUnread] = useState(0);
    const [showOnboarding, setShowOnboarding] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        setRoomName(room.name);
        setRoomInviteCode(room.invite_code);
        setRoomIsLocked(room.is_locked);
        setOwnerId(room.owner.id);
        setShowOnboarding(true);
    }, [
        room.id,
        room.name,
        room.invite_code,
        room.is_locked,
        room.owner.id,
        setRoomName,
        setRoomInviteCode,
        setRoomIsLocked,
        setOwnerId,
    ]);

    const setVideo = async () => {
        if (!videoUrl.trim() || settingVideo) return;
        setSettingVideo(true);
        try {
            await api.post(`/playback/${room.id}/set-video`, {
                video_url: videoUrl,
            });
            setShowSetVideo(false);
            setVideoUrl("");
            setVideoRefreshKey((key) => key + 1);
            toast.success("ویدیو تنظیم شد.");
        } catch {
            toast.error("تنظیم ویدیو ناموفق بود. لطفاً دوباره تلاش کنید.");
        } finally {
            setSettingVideo(false);
        }
    };

    const handleRoomUpdate = (data: {
        name?: string;
        invite_code?: string;
        is_locked?: boolean;
    }) => {
        if (data.name) setRoomName(data.name);
        if (data.invite_code) setRoomInviteCode(data.invite_code);
        if (data.is_locked !== undefined) setRoomIsLocked(data.is_locked);
    };

    const handleKick = (_userId: number) => {
        setActiveTab("members");
    };

    const handleTransfer = (userId: number) => {
        transferOwnership(userId);
        setActiveTab("members");
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8.5rem)]">
            <div className="flex-1 flex flex-col gap-4 min-w-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">{roomName}</h1>
                        <p className="text-sm text-muted-foreground">
                            ساخته شده توسط {room.owner.name}
                            {roomIsLocked && (
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
                </div>

                {isOwner &&
                    room.video_url === null &&
                    room.members.length <= 1 &&
                    showOnboarding && (
                        <RoomOnboarding
                            onCopyInvite={() =>
                                handleCopy(route("rooms.join", roomInviteCode))
                            }
                            onAddVideo={() => setShowSetVideo(true)}
                            onDismiss={() => setShowOnboarding(false)}
                        />
                    )}

                <div className="flex-1 relative">
                    <SyncedVideoJsPlayer
                        roomId={room.id}
                        canControl={isOwner}
                        initialVideoUrl={room.video_url}
                        className="h-full"
                        onSuggestNext={suggestNext}
                        onOpenSubtitleSettings={() => setShowSubSettings(true)}
                        refreshKey={videoRefreshKey}
                        subtitles={{
                            cues,
                            settings,
                            loading: subLoading,
                            error: subError,
                        }}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {isOwner && showSetVideo && (
                        <div className="flex gap-2 flex-1 min-w-0">
                            <div className="flex-1">
                                <Input
                                    placeholder="آدرس مستقیم ویدیو (MP4, WebM, ...)"
                                    value={videoUrl}
                                    onChange={(e) =>
                                        setVideoUrl(e.target.value)
                                    }
                                    dir="ltr"
                                />
                            </div>
                            <Button
                                onClick={setVideo}
                                size="sm"
                                loading={settingVideo}
                            >
                                تنظیم
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSetVideo(false)}
                            >
                                انصراف
                            </Button>
                        </div>
                    )}

                    {isOwner && !showSetVideo && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSetVideo(true)}
                        >
                            <Tv className="h-4 w-4" />
                            ویدیو
                        </Button>
                    )}

                    {showSubManager ? (
                        <div className="flex flex-wrap gap-2 flex-1 min-w-0 p-2 bg-secondary/50 rounded-xl">
                            <div className="flex gap-2 items-center w-full">
                                {isOwner && (
                                    <>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".srt,.vtt"
                                            onChange={(e) => {
                                                const file =
                                                    e.target.files?.[0];
                                                if (file)
                                                    void uploadTrack(file);
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.value =
                                                        "";
                                                }
                                            }}
                                            className="hidden"
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                        >
                                            <Upload className="h-4 w-4" />
                                            آپلود فایل
                                        </Button>
                                    </>
                                )}
                                <div className="flex-1" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowSubManager(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            {tracks.length > 0 && (
                                <div className="w-full space-y-1">
                                    <button
                                        onClick={() => selectTrack(null)}
                                        className={`w-full text-end px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                            activeTrackId === null
                                                ? "bg-primary/20 text-accent-foreground"
                                                : "text-muted-foreground hover:bg-secondary"
                                        }`}
                                    >
                                        بدون زیرنویس
                                    </button>
                                    {roomDefaultId !== null &&
                                        activeTrackId !== roomDefaultId && (
                                            <button
                                                onClick={followRoomDefault}
                                                className={`w-full text-end px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                    activeTrackId ===
                                                    roomDefaultId
                                                        ? "bg-primary/20 text-accent-foreground"
                                                        : "text-muted-foreground hover:bg-secondary"
                                                }`}
                                            >
                                                پیش‌فرض اتاق
                                            </button>
                                        )}
                                    {tracks.map((track) => (
                                        <div
                                            key={track.id}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                activeTrackId === track.id
                                                    ? "bg-primary/20 text-accent-foreground"
                                                    : "text-muted-foreground hover:bg-secondary"
                                            }`}
                                        >
                                            <button
                                                onClick={() =>
                                                    selectTrack(track.id)
                                                }
                                                className="flex-1 text-end truncate"
                                            >
                                                {track.label}
                                                <span className="text-xs me-2">
                                                    .{track.original_extension}
                                                </span>
                                                {roomDefaultId === track.id && (
                                                    <span className="text-xs text-accent-foreground ms-1">
                                                        (پیش‌فرض)
                                                    </span>
                                                )}
                                            </button>
                                            {isOwner && (
                                                <>
                                                    <button
                                                        onClick={() =>
                                                            setRoomDefault(
                                                                roomDefaultId ===
                                                                    track.id
                                                                    ? null
                                                                    : track.id,
                                                            )
                                                        }
                                                        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                                                        title={
                                                            roomDefaultId ===
                                                            track.id
                                                                ? "حذف پیش‌فرض"
                                                                : "تنظیم به‌عنوان پیش‌فرض"
                                                        }
                                                    >
                                                        <Star
                                                            className={`h-3.5 w-3.5 ${
                                                                roomDefaultId ===
                                                                track.id
                                                                    ? "fill-current text-primary"
                                                                    : ""
                                                            }`}
                                                        />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setTrackToDelete(
                                                                track.id,
                                                            )
                                                        }
                                                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                                        title="حذف"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {tracksError && tracks.length === 0 && (
                                <p className="text-xs text-destructive-text w-full px-1">
                                    خطا در دریافت لیست زیرنویس‌ها
                                </p>
                            )}
                            {!tracksError && tracks.length === 0 && (
                                <p className="text-xs text-muted-foreground w-full px-1">
                                    هنوز زیرنویسی آپلود نشده است
                                </p>
                            )}
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSubManager(true)}
                        >
                            <Subtitles className="h-4 w-4" />
                            زیرنویس
                        </Button>
                    )}
                </div>
            </div>

            <div className="lg:w-80 flex flex-col">
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

            <SubtitleSettingsDialog
                open={showSubSettings}
                onClose={() => setShowSubSettings(false)}
            />

            <RoomSettingsDialog
                open={showRoomSettings}
                onClose={() => setShowRoomSettings(false)}
                room={{
                    id: room.id,
                    name: roomName,
                    invite_code: roomInviteCode,
                    is_locked: roomIsLocked,
                }}
                onUpdate={handleRoomUpdate}
            />

            <ConfirmDialog
                open={trackToDelete !== null}
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
        </div>
    );
}

ShowRoom.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
