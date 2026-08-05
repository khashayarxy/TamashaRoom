import { Link } from "@inertiajs/react";

import { Copy, Lock, Play, RotateCcw, Trash2, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { timeAgo, toPersianDigits } from "@/lib/utils";

export interface RoomCardRoom {
    id: number;
    name: string;
    invite_code: string;
    owner: { id: number; name: string };
    members_count: number;
    max_members: number;
    is_playing: boolean;
    is_locked: boolean;
    video_url: string | null;
    last_activity_at: string | null;
}

interface RoomCardProps {
    room: RoomCardRoom;
    onCopyInvite: (code: string) => void;
    onDelete: (room: RoomCardRoom) => void;
}

export function RoomCard({ room, onCopyInvite, onDelete }: RoomCardProps) {
    return (
        <div className="group relative h-full focus-within:shadow-md hover:shadow-md transition-shadow">
            {/* Stretched overlay link: the whole card is navigable, but it
                must not nest the action buttons (a11y: interactive elements
                must be siblings, not descendants of a link). */}
            <Link
                href={route("rooms.show", room.id)}
                className="absolute inset-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`ورود به اتاق ${room.name}`}
            />
            <Card className="pointer-events-none h-full cursor-pointer">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <CardTitle className="line-clamp-2 text-lg leading-snug">
                            {room.name}
                        </CardTitle>
                        {room.is_playing ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                <Play className="h-3 w-3" />
                                در حال پخش
                            </span>
                        ) : (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
                                متوقف
                            </span>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            {toPersianDigits(room.members_count)} از{" "}
                            {toPersianDigits(room.max_members)} نفر
                        </span>
                        {room.is_locked && (
                            <span className="inline-flex items-center gap-1.5">
                                <Lock className="h-4 w-4" />
                                قفل
                            </span>
                        )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="truncate">
                            ساخته شده توسط {room.owner.name}
                        </p>
                        {room.last_activity_at && (
                            <p>
                                آخرین فعالیت: {timeAgo(room.last_activity_at)}
                            </p>
                        )}
                    </div>

                    {room.video_url && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <RotateCcw className="h-3 w-3" />
                            دوباره ببینیم
                        </span>
                    )}

                    <div className="flex items-center gap-2 border-t border-border pt-3">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                                کد دعوت
                            </span>
                            <span
                                dir="ltr"
                                className="truncate rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground"
                            >
                                {room.invite_code}
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={() => onCopyInvite(room.invite_code)}
                            className="pointer-events-auto relative z-10 inline-flex min-h-[24px] items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            کپی
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(room)}
                            className="pointer-events-auto relative z-10 ms-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`حذف اتاق ${room.name}`}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
