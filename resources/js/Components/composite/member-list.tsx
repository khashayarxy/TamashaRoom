import type { PresenceMember } from "@/Hooks/use-presence";
import api from "@/lib/api";
import { toast } from "sonner";
import {
    Crown,
    LogOut,
    User as UserIcon,
    UserMinus,
    Wifi,
    WifiOff,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";

interface MemberListProps {
    members: PresenceMember[];
    roomId: number;
    ownerId: number;
    connected: boolean;
    currentUserId?: number;
    onKick?: (userId: number) => void;
    onTransfer?: (userId: number) => void;
}

function timeAgo(dateStr: string): string {
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now.getTime() - past.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return "همین الان";
    if (diffMinutes < 60) return `${diffMinutes} دقیقه پیش`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ساعت پیش`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} روز پیش`;
}

function StatusIndicator({
    status,
}: {
    status: "online" | "offline" | "away";
}) {
    const colors = {
        online: "bg-green-500",
        away: "bg-yellow-500",
        offline: "bg-gray-400",
    };

    return (
        <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${colors[status]}`}
            title={
                status === "online"
                    ? "آنلاین"
                    : status === "away"
                      ? "غایب"
                      : "آفلاین"
            }
        >
            <span className="sr-only">
                {status === "online"
                    ? "آنلاین"
                    : status === "away"
                      ? "غایب"
                      : "آفلاین"}
            </span>
        </span>
    );
}

export function MemberList({
    members,
    roomId,
    ownerId,
    connected,
    currentUserId,
    onKick,
    onTransfer,
}: MemberListProps) {
    const onlineCount = members.filter(
        (m) => m.presence_status === "online",
    ).length;
    const isOwner = currentUserId === ownerId;

    const [kickTarget, setKickTarget] = useState<PresenceMember | null>(null);
    const [transferTarget, setTransferTarget] = useState<PresenceMember | null>(
        null,
    );
    const [actionLoading, setActionLoading] = useState(false);

    const handleKick = async () => {
        if (!kickTarget) return;
        setActionLoading(true);
        try {
            await api.post(`/rooms/${roomId}/kick/${kickTarget.user_id}`);
            toast.success(`${kickTarget.name} از اتاق خارج شد`);
            onKick?.(kickTarget.user_id);
        } catch {
            toast.error("خطا در حذف کاربر");
        } finally {
            setActionLoading(false);
            setKickTarget(null);
        }
    };

    const handleTransfer = async () => {
        if (!transferTarget) return;
        setActionLoading(true);
        try {
            await api.post(
                `/rooms/${roomId}/transfer/${transferTarget.user_id}`,
            );
            toast.success(`مالکیت به ${transferTarget.name} منتقل شد`);
            onTransfer?.(transferTarget.user_id);
        } catch {
            toast.error("خطا در انتقال مالکیت");
        } finally {
            setActionLoading(false);
            setTransferTarget(null);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                    اعضای اتاق ({members.length})
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {connected ? (
                        <>
                            <Wifi className="h-3 w-3 text-success" />
                            <span>{onlineCount} آنلاین</span>
                        </>
                    ) : (
                        <>
                            <WifiOff className="h-3 w-3 text-destructive" />
                            <span>قطع ارتباط</span>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                {members.map((member) => (
                    <div
                        key={member.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-accent transition-colors group"
                    >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate flex items-center gap-1">
                                {member.name}
                                {member.is_owner && (
                                    <Crown className="h-3.5 w-3.5 text-warning shrink-0" />
                                )}
                            </div>
                            {member.presence_status === "offline" && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    آخرین بازدید {timeAgo(member.last_seen_at)}
                                </div>
                            )}
                        </div>

                        {isOwner && !member.is_owner && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setTransferTarget(member)}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 focus-visible:text-primary focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                                    title="انتقال مالکیت"
                                    aria-label={`انتقال مالکیت به ${member.name}`}
                                >
                                    <LogOut className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setKickTarget(member)}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:text-destructive focus-visible:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                                    title="حذف از اتاق"
                                    aria-label={`حذف ${member.name} از اتاق`}
                                >
                                    <UserMinus className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        <StatusIndicator status={member.presence_status} />
                    </div>
                ))}
            </div>

            <ConfirmDialog
                open={kickTarget !== null}
                onClose={() => setKickTarget(null)}
                onConfirm={handleKick}
                title={`حذف ${kickTarget?.name ?? ""}`}
                description={`آیا از حذف "${kickTarget?.name ?? ""}" از اتاق مطمئن هستید؟`}
                confirmLabel="حذف"
                confirmVariant="destructive"
                loading={actionLoading}
            />

            <ConfirmDialog
                open={transferTarget !== null}
                onClose={() => setTransferTarget(null)}
                onConfirm={handleTransfer}
                title={`انتقال مالکیت به ${transferTarget?.name ?? ""}`}
                description={`آیا از انتقال مالکیت اتاق به "${transferTarget?.name ?? ""}" مطمئن هستید؟ این عملیات قابل بازگشت نیست.`}
                confirmLabel="انتقال مالکیت"
                confirmVariant="destructive"
                loading={actionLoading}
            />
        </div>
    );
}
