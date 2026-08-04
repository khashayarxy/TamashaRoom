import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { ConfirmDialog } from "@/Components/composite/confirm-dialog";
import { Input } from "@/Components/ui/input";
import { ToastContainer } from "@/Components/composite/toast";
import { toast } from "@/Hooks/use-toast";
import AppLayout from "@/Layouts/AppLayout";
import {
    CREATE_ROOM_INTENT_KEY,
    extractInviteCode,
    safeCopyToClipboard,
    timeAgo,
} from "@/lib/utils";
import { Link, router, usePage } from "@inertiajs/react";
import { Copy, Link2, Plus, RotateCcw, Trash2, Tv, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

interface Room {
    id: number;
    name: string;
    invite_code: string;
    owner: { id: number; name: string };
    members_count: number;
    max_members: number;
    is_playing: boolean;
    video_url: string | null;
    last_activity_at: string | null;
    user_id: number;
}

interface DashboardProps {
    rooms: Room[];
}

export default function Dashboard({ rooms }: DashboardProps) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [roomName, setRoomName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [creating, setCreating] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
    const [deleting, setDeleting] = useState(false);
    const { errors: pageErrors } = usePage().props;

    useEffect(() => {
        if (sessionStorage.getItem(CREATE_ROOM_INTENT_KEY) === "1") {
            sessionStorage.removeItem(CREATE_ROOM_INTENT_KEY);
            setShowCreateForm(true);
        }
    }, []);

    const createRoom = async (e: FormEvent) => {
        e.preventDefault();
        if (!roomName.trim() || creating) return;
        setCreating(true);
        setErrors({});
        router.post(
            route("rooms.store"),
            { name: roomName },
            {
                onSuccess: () => {
                    setRoomName("");
                    setShowCreateForm(false);
                    setCreating(false);
                },
                onError: (errs) => {
                    setErrors(errs);
                    setCreating(false);
                },
            },
        );
    };

    const joinRoom = (e: FormEvent) => {
        e.preventDefault();
        const code = extractInviteCode(joinCode);
        if (!code.trim()) return;
        router.post(route("rooms.join.submit", code.trim()));
    };

    const handleCopy = async (code: string) => {
        const ok = await safeCopyToClipboard(code);
        if (ok) {
            toast.success("کد دعوت کپی شد.");
        } else {
            toast.error("کپی شدن کد ممکن نشد. لطفاً به‌صورت دستی کپی کنید.");
        }
    };

    const deleteRoom = () => {
        if (!roomToDelete) return;
        setDeleting(true);
        router.delete(route("rooms.destroy", roomToDelete.id), {
            onSuccess: () => {
                setDeleting(false);
                setRoomToDelete(null);
            },
            onError: () => {
                setDeleting(false);
                setRoomToDelete(null);
                toast.error("خطا در حذف اتاق");
            },
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">اتاق‌های من</h1>
                <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                    <Plus className="h-4 w-4" />
                    اتاق جدید
                </Button>
            </div>

            {showCreateForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>ساخت اتاق جدید</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={createRoom} className="flex gap-3">
                            <div className="flex-1">
                                <Input
                                    placeholder="نام اتاق"
                                    value={roomName}
                                    onChange={(e) =>
                                        setRoomName(e.target.value)
                                    }
                                    maxLength={255}
                                />
                                {errors.name && (
                                    <p className="text-sm text-destructive mt-1">
                                        {errors.name}
                                    </p>
                                )}
                            </div>
                            <Button type="submit" disabled={creating}>
                                {creating ? "در حال ساخت..." : "ساخت اتاق"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>پیوستن به اتاق</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={joinRoom} className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                placeholder="کد یا لینک دعوت را وارد کنید"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                aria-invalid={
                                    Boolean(pageErrors?.invite_code) ||
                                    undefined
                                }
                            />
                            {pageErrors?.invite_code && (
                                <p
                                    className="text-sm text-destructive mt-1"
                                    role="alert"
                                >
                                    {pageErrors.invite_code}
                                </p>
                            )}
                        </div>
                        <Button type="submit" variant="secondary">
                            <Link2 className="h-4 w-4" />
                            پیوستن
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {rooms.length === 0 ? (
                <div className="text-center py-16">
                    <Tv className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
                    <h2 className="text-xl font-semibold mb-2">
                        هنوز اتاقی ندارید
                    </h2>
                    <p className="text-muted-foreground mb-6">
                        یک اتاق بسازید یا با کد دعوت به اتاق دوستان خود بپیوندید
                    </p>
                    <Button onClick={() => setShowCreateForm(true)}>
                        <Plus className="h-4 w-4" />
                        اولین اتاق را بسازید
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((room) => (
                        <div
                            key={room.id}
                            className="relative h-full focus-within:shadow-md hover:shadow-md transition-shadow"
                        >
                            {/* Stretched overlay link: the whole card is
                                navigable, but it must not nest the action
                                buttons (a11y: interactive elements must be
                                siblings, not descendants of a link). */}
                            <Link
                                href={route("rooms.show", room.id)}
                                className="absolute inset-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`ورود به اتاق ${room.name}`}
                            >
                                <span className="sr-only">
                                    ورود به اتاق {room.name}
                                </span>
                            </Link>
                            <Card className="h-full cursor-pointer group pointer-events-none">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-base">
                                            {room.name}
                                        </CardTitle>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Users className="h-3.5 w-3.5" />
                                            {room.members_count}/
                                            {room.max_members}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <span>
                                                ساخته شده توسط {room.owner.name}
                                            </span>
                                        </div>
                                        {room.last_activity_at && (
                                            <div>
                                                آخرین فعالیت:{" "}
                                                {timeAgo(room.last_activity_at)}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="bg-secondary px-2 py-0.5 rounded-full">
                                                {room.is_playing
                                                    ? "در حال پخش"
                                                    : "متوقف"}
                                            </span>
                                            {room.video_url && (
                                                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                    <RotateCcw className="h-3 w-3" />
                                                    دوباره ببینیم
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mt-4 relative z-10">
                                        <button
                                            onClick={() =>
                                                handleCopy(room.invite_code)
                                            }
                                            className="pointer-events-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline min-h-[24px]"
                                        >
                                            <Copy className="h-3 w-3" />
                                            کپی کد دعوت
                                        </button>
                                        <button
                                            onClick={() =>
                                                setRoomToDelete(room)
                                            }
                                            className="pointer-events-auto flex items-center gap-1 text-xs text-destructive hover:underline ms-auto p-1 min-h-[24px]"
                                            aria-label="حذف اتاق"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={roomToDelete !== null}
                onClose={() => {
                    if (!deleting) setRoomToDelete(null);
                }}
                onConfirm={deleteRoom}
                title={`حذف ${roomToDelete?.name ?? ""}`}
                description={`آیا از حذف "${roomToDelete?.name ?? ""}" مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
                confirmLabel="حذف شود"
                confirmVariant="destructive"
                loading={deleting}
            />

            <ToastContainer />
        </div>
    );
}

Dashboard.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
