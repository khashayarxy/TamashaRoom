import { MemberList } from '@/Components/composite/member-list';
import { RoomChat } from '@/Components/composite/room-chat';
import { RoomSettingsDialog } from '@/Components/composite/room-settings';
import { SubtitleOverlay, useSubtitleSettings } from '@/Components/composite/subtitle-overlay';
import { SubtitleSettingsDialog } from '@/Components/composite/subtitle-settings';
import { ToastContainer } from '@/Components/composite/toast';
import { VideoPlayer } from '@/Components/composite/video-player';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { usePresence } from '@/Hooks/use-presence';
import AppLayout from '@/Layouts/AppLayout';
import { copyToClipboard } from '@/lib/utils';
import api from '@/lib/api';
import type { SubtitleTrack, SubtitleCue } from '@/lib/types/subtitle';
import { Copy, MessageSquare, Subtitles, Trash2, Tv, Upload, Users, X } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

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
    owner: { id: number; name: string };
    members: Member[];
    chat_messages: ChatMessage[];
}

interface ShowRoomProps {
    room: Room;
}

const ACTIVE_TRACK_KEY = 'tamasharoom-active-track';

function loadActiveTrackId(roomId: number): number | null {
    try {
        const raw = localStorage.getItem(`${ACTIVE_TRACK_KEY}-${roomId}`);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
}

function saveActiveTrackId(roomId: number, trackId: number | null) {
    localStorage.setItem(`${ACTIVE_TRACK_KEY}-${roomId}`, JSON.stringify(trackId));
}

export default function ShowRoom({ room }: ShowRoomProps) {
    const [activeTab, setActiveTab] = useState<'chat' | 'members'>('chat');
    const [showSetVideo, setShowSetVideo] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');
    const [showSubSettings, setShowSubSettings] = useState(false);
    const [showSubManager, setShowSubManager] = useState(false);
    const [showRoomSettings, setShowRoomSettings] = useState(false);
    const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
    const [activeTrackId, setActiveTrackId] = useState<number | null>(() => loadActiveTrackId(room.id));
    const [cues, setCues] = useState<SubtitleCue[]>([]);
    const [subLoading, setSubLoading] = useState(false);
    const [subError, setSubError] = useState<string | null>(null);
    const [roomName, setRoomName] = useState(room.name);
    const [roomInviteCode, setRoomInviteCode] = useState(room.invite_code);
    const [roomIsLocked, setRoomIsLocked] = useState(room.is_locked);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { members: presenceMembers, connected } = usePresence(room.id);
    const { settings } = useSubtitleSettings();
    const { auth } = usePage().props;
    const isOwner = auth.user.id === room.user_id;

    const setVideo = async () => {
        if (!videoUrl.trim()) return;
        try {
            await api.post(`/playback/${room.id}/set-video`, { video_url: videoUrl });
            setShowSetVideo(false);
            setVideoUrl('');
        } catch { /* silently fail */ }
    };

    useEffect(() => {
        let cancelled = false;
        api.get(`/subtitles/${room.id}`)
            .then((res) => {
                if (cancelled) return;
                setTracks(res.data);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [room.id]);

    useEffect(() => {
        saveActiveTrackId(room.id, activeTrackId);
    }, [room.id, activeTrackId]);

    useEffect(() => {
        if (!activeTrackId) {
            setCues([]);
            setSubError(null);
            return;
        }

        let cancelled = false;
        setSubLoading(true);
        setSubError(null);

        api.get(`/subtitles/${room.id}/${activeTrackId}/cues`)
            .then((res) => {
                if (cancelled) return;
                setCues(res.data.cues ?? []);
                setSubLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setCues([]);
                setSubError('خطا در بارگذاری زیرنویس');
                setSubLoading(false);
            });

        return () => { cancelled = true; };
    }, [room.id, activeTrackId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post(`/subtitles/${room.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setTracks((prev) => [res.data, ...prev]);
            setActiveTrackId(res.data.id);
        } catch {
            setSubError('خطا در آپلود فایل');
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeleteTrack = async (trackId: number) => {
        try {
            await api.delete(`/subtitles/${room.id}/${trackId}`);
            setTracks((prev) => prev.filter((t) => t.id !== trackId));
            if (activeTrackId === trackId) {
                setActiveTrackId(null);
                setCues([]);
            }
        } catch {
            setSubError('خطا در حذف زیرنویس');
        }
    };

    const activeTrack = tracks.find((t) => t.id === activeTrackId);

    const handleRoomUpdate = (data: { name?: string; invite_code?: string; is_locked?: boolean }) => {
        if (data.name) setRoomName(data.name);
        if (data.invite_code) setRoomInviteCode(data.invite_code);
        if (data.is_locked !== undefined) setRoomIsLocked(data.is_locked);
    };

    const handleKick = (_userId: number) => {
        setActiveTab('members');
    };

    const handleTransfer = (_userId: number) => {
        setActiveTab('members');
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
            <div className="flex-1 flex flex-col gap-4 min-w-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">{roomName}</h1>
                        <p className="text-sm text-muted-foreground">
                            ساخته شده توسط {room.owner.name}
                            {roomIsLocked && <span className="mr-2 text-yellow-500">(قفل)</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(roomInviteCode)}
                        >
                            <Copy className="h-4 w-4" />
                            کپی کد دعوت
                        </Button>
                    </div>
                </div>

                <div className="flex-1 relative">
                    <VideoPlayer
                        roomId={room.id}
                        canControl={isOwner}
                        initialVideoUrl={room.video_url}
                        className="h-full"
                        videoRef={videoRef}
                    >
                        <SubtitleOverlay
                            videoRef={videoRef}
                            cues={cues}
                            settings={settings}
                            loading={subLoading}
                            error={subError}
                        />
                    </VideoPlayer>
                </div>

                {isOwner && (
                    <div className="flex flex-wrap gap-2">
                        {showSetVideo ? (
                            <div className="flex gap-2 flex-1 min-w-0">
                                <div className="flex-1">
                                    <Input
                                        placeholder="آدرس ویدیو (YouTube, MP4, ...)"
                                        value={videoUrl}
                                        onChange={(e) => setVideoUrl(e.target.value)}
                                        dir="ltr"
                                    />
                                </div>
                                <Button onClick={setVideo} size="sm">
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
                        ) : (
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
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".srt,.vtt"
                                        onChange={handleUpload}
                                        className="hidden"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="h-4 w-4" />
                                        آپلود فایل
                                    </Button>
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
                                            onClick={() => setActiveTrackId(null)}
                                            className={`w-full text-right px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                activeTrackId === null
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'text-muted-foreground hover:bg-secondary'
                                            }`}
                                        >
                                            بدون زیرنویس
                                        </button>
                                        {tracks.map((track) => (
                                            <div
                                                key={track.id}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                    activeTrackId === track.id
                                                        ? 'bg-primary/20 text-primary'
                                                        : 'text-muted-foreground hover:bg-secondary'
                                                }`}
                                            >
                                                <button
                                                    onClick={() => setActiveTrackId(track.id)}
                                                    className="flex-1 text-right truncate"
                                                >
                                                    {track.label}
                                                    <span className="text-xs mr-2 opacity-60">
                                                        .{track.original_extension}
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTrack(track.id)}
                                                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                                    title="حذف"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {tracks.length === 0 && (
                                    <p className="text-xs text-muted-foreground w-full px-1">
                                        هنوز زیرنویسی آپلود نشده است
                                    </p>
                                )}
                            </div>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowSubManager(true)}
                                >
                                    <Subtitles className="h-4 w-4" />
                                    زیرنویس
                                </Button>
                                {activeTrack && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowSubSettings(true)}
                                    >
                                        <Subtitles className="h-4 w-4" />
                                        تنظیمات
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {!isOwner && activeTrack && (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSubSettings(true)}
                        >
                            <Subtitles className="h-4 w-4" />
                            تنظیمات زیرنویس
                        </Button>
                    </div>
                )}
            </div>

            <div className="lg:w-80 flex flex-col">
                <div className="flex rounded-xl bg-secondary p-1 mb-3">
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'chat'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <MessageSquare className="h-4 w-4" />
                        چت
                    </button>
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'members'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Users className="h-4 w-4" />
                        اعضا
                    </button>
                </div>

                <Card className="flex-1 overflow-hidden">
                    {activeTab === 'chat' ? (
                        <RoomChat
                            roomId={room.id}
                            initialMessages={room.chat_messages}
                        />
                    ) : (
                        <CardContent className="p-4">
                            <MemberList
                                members={presenceMembers}
                                roomId={room.id}
                                ownerId={room.owner.id}
                                connected={connected}
                                currentUserId={auth.user.id}
                                isLocked={roomIsLocked}
                                onOpenSettings={() => setShowRoomSettings(true)}
                                onKick={handleKick}
                                onTransfer={handleTransfer}
                            />
                        </CardContent>
                    )}
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

            <ToastContainer />
        </div>
    );
}

ShowRoom.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
