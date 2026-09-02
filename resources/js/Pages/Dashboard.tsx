import { FormEvent, useEffect, useRef, useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";

import { Link2, Plus, Tv } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/Components/composite/confirm-dialog";
import { RoomCard, type RoomCardRoom } from "@/Components/composite/room-card";
import { PageErrorFallback } from "@/Components/composite/page-error-fallback";
import { Button } from "@/Components/ui/button";
import { ErrorBoundary } from "@/Components/ui/error-boundary";
import { Input } from "@/Components/ui/input";
import AppLayout from "@/Layouts/AppLayout";
import {
    CREATE_ROOM_INTENT_KEY,
    extractInviteCode,
    safeCopyToClipboard,
} from "@/lib/utils";

import type { PageProps } from "@/types";

type DashboardPageProps = PageProps<{ rooms: RoomCardRoom[] }>;

export default function Dashboard({ rooms }: { rooms: RoomCardRoom[] }) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [roomName, setRoomName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [roomToDelete, setRoomToDelete] = useState<RoomCardRoom | null>(null);
    const [deleting, setDeleting] = useState(false);
    const { errors: pageErrors } = usePage<DashboardPageProps>().props;
    const joinInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (sessionStorage.getItem(CREATE_ROOM_INTENT_KEY) === "1") {
            sessionStorage.removeItem(CREATE_ROOM_INTENT_KEY);
            setShowCreateForm(true);
        }
    }, []);

    const focusJoinInput = () => {
        setJoinCode("");
        joinInputRef.current?.focus();
    };

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
        if (!code.trim() || joining) return;
        setJoining(true);
        router.post(
            route("rooms.join.submit", code.trim()),
            {},
            {
                onFinish: () => setJoining(false),
            },
        );
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
        <ErrorBoundary fallback={<PageErrorFallback />}>
            <div className="space-y-8 lg:space-y-10">
                <Head title="داشبورد" />

                <header className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">
                        اتاق‌های من
                    </h1>
                    <p className="text-base text-muted-foreground">
                        یک اتاق بساز، دوستانت را دعوت کن و با هم فیلم ببین.
                    </p>
                </header>

                <section
                    aria-label="ایجاد یا پیوستن به اتاق"
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
                >
                    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                        <div>
                            <h2 className="text-xl font-bold">
                                ساخت اتاق جدید
                            </h2>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                فقط یک نام کافی است؛ اتاقت در چند ثانیه آماده
                                می‌شود.
                            </p>
                            <div className="mt-4">
                                {showCreateForm ? (
                                    <form
                                        onSubmit={createRoom}
                                        noValidate
                                        className="space-y-3"
                                    >
                                        <Input
                                            label="نام اتاق"
                                            placeholder="مثلاً فیلم شب جمعه"
                                            value={roomName}
                                            onChange={(e) =>
                                                setRoomName(e.target.value)
                                            }
                                            maxLength={255}
                                            autoFocus
                                            aria-invalid={
                                                Boolean(errors.name) ||
                                                undefined
                                            }
                                            aria-describedby={
                                                errors.name
                                                    ? "create-room-error"
                                                    : undefined
                                            }
                                        />
                                        {errors.name && (
                                            <p
                                                id="create-room-error"
                                                role="alert"
                                                className="text-sm text-destructive-text"
                                            >
                                                {errors.name}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="submit"
                                                loading={creating}
                                            >
                                                {creating
                                                    ? "در حال ساخت..."
                                                    : "ساخت اتاق"}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() =>
                                                    setShowCreateForm(false)
                                                }
                                            >
                                                انصراف
                                            </Button>
                                        </div>
                                    </form>
                                ) : (
                                    <Button
                                        size="lg"
                                        onClick={() => setShowCreateForm(true)}
                                    >
                                        <Plus className="h-5 w-5" />
                                        اتاق جدید بساز
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="lg:border-s lg:border-border lg:ps-8">
                            <h2 className="text-xl font-bold">کد دعوت داری؟</h2>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                با کد یا لینک دعوت، به اتاق دوستانت بپیوند.
                            </p>
                            <form
                                onSubmit={joinRoom}
                                noValidate
                                className="mt-4 space-y-3"
                            >
                                <Input
                                    ref={joinInputRef}
                                    label="کد یا لینک دعوت"
                                    placeholder="کد یا لینک دعوت را وارد کنید"
                                    value={joinCode}
                                    onChange={(e) =>
                                        setJoinCode(e.target.value)
                                    }
                                    aria-invalid={
                                        Boolean(pageErrors?.invite_code) ||
                                        undefined
                                    }
                                    aria-describedby={
                                        pageErrors?.invite_code
                                            ? "join-error"
                                            : undefined
                                    }
                                />
                                {pageErrors?.invite_code && (
                                    <p
                                        id="join-error"
                                        role="alert"
                                        className="text-sm text-destructive-text"
                                    >
                                        {pageErrors.invite_code}
                                    </p>
                                )}
                                <Button
                                    type="submit"
                                    variant="secondary"
                                    loading={joining}
                                >
                                    <Link2 className="h-4 w-4" />
                                    پیوستن به اتاق
                                </Button>
                            </form>
                        </div>
                    </div>
                </section>

                {rooms.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Tv className="h-7 w-7" />
                        </div>
                        <h2 className="mt-4 text-xl font-bold">
                            هنوز اتاقی ندارید
                        </h2>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                            اولین اتاق را بسازید و کد دعوتش را برای دوستانتان
                            بفرستید؛ در چند ثانیه آماده می‌شود.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <Button onClick={() => setShowCreateForm(true)}>
                                <Plus className="h-4 w-4" />
                                اولین اتاق را بسازید
                            </Button>
                            <Button variant="outline" onClick={focusJoinInput}>
                                <Link2 className="h-4 w-4" />
                                پیوستن با کد دعوت
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {rooms.map((room) => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                onCopyInvite={handleCopy}
                                onDelete={setRoomToDelete}
                            />
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
            </div>
        </ErrorBoundary>
    );
}

Dashboard.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
