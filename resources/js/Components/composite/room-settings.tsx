import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { copyToClipboard } from "@/lib/utils";
import api from "@/lib/api";
import { Copy, Key, LinkIcon, Loader2, Lock, Unlock } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

interface RoomSettingsProps {
    open: boolean;
    onClose: () => void;
    room: {
        id: number;
        name: string;
        invite_code: string;
        is_locked: boolean;
    };
    onUpdate: (data: {
        name?: string;
        invite_code?: string;
        is_locked?: boolean;
    }) => void;
}

export function RoomSettingsDialog({
    open,
    onClose,
    room,
    onUpdate,
}: RoomSettingsProps) {
    const [name, setName] = useState(room.name);
    const [inviteCode, setInviteCode] = useState(room.invite_code);
    const [isLocked, setIsLocked] = useState(room.is_locked);
    const [saving, setSaving] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    useEffect(() => {
        setName(room.name);
        setInviteCode(room.invite_code);
        setIsLocked(room.is_locked);
    }, [room.name, room.invite_code, room.is_locked]);

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim() || saving) return;
        setSaving(true);
        try {
            const { data } = await api.patch(`/rooms/${room.id}`, { name });
            onUpdate(data.room);
            toast.success("نام اتاق با موفقیت تغییر کرد");
            onClose();
        } catch {
            toast.error("خطا در ذخیره تغییرات");
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerate = async () => {
        setRegenerating(true);
        try {
            const { data } = await api.post(
                `/rooms/${room.id}/regenerate-invite`,
            );
            setInviteCode(data.invite_code);
            onUpdate({ invite_code: data.invite_code });
            toast.success("لینک دعوت جدید ساخته شد");
        } catch {
            toast.error("خطا در ساخت لینک دعوت جدید");
        } finally {
            setRegenerating(false);
        }
    };

    const handleToggleLock = async () => {
        try {
            const { data } = await api.post(`/rooms/${room.id}/toggle-lock`);
            setIsLocked(data.is_locked);
            onUpdate({ is_locked: data.is_locked });
            toast.success(data.is_locked ? "اتاق قفل شد" : "اتاق باز شد");
        } catch {
            toast.error("خطا در تغییر وضعیت قفل");
        }
    };

    const handleCopy = () => {
        copyToClipboard(inviteCode);
        toast.success("کد دعوت کپی شد");
    };

    const handleCopyLink = () => {
        copyToClipboard(route("rooms.join", inviteCode));
        toast.success("لینک دعوت کپی شد");
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>تنظیمات اتاق</DialogTitle>
                    <DialogDescription>
                        مدیریت تنظیمات و دسترسی اتاق
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-5">
                    <Input
                        label="نام اتاق"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={255}
                    />

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            کد و لینک دعوت
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1 flex items-center h-10 rounded-xl border border-input bg-transparent px-3 text-sm font-mono text-foreground ltr">
                                {inviteCode}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                                title="کپی"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCopyLink}
                                title="کپی لینک"
                            >
                                <LinkIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleRegenerate}
                                disabled={regenerating}
                                title="ساخت کد جدید"
                            >
                                {regenerating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Key className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-input p-3">
                        <div>
                            <div className="text-sm font-medium">
                                {isLocked ? "اتاق قفل است" : "اتاق باز است"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {isLocked
                                    ? "اعضای جدید نمی‌توانند بپیوندند"
                                    : "هر کسی با کد دعوت می‌تواند بپیوندد"}
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant={isLocked ? "destructive" : "secondary"}
                            size="sm"
                            onClick={handleToggleLock}
                        >
                            {isLocked ? (
                                <Lock className="h-4 w-4" />
                            ) : (
                                <Unlock className="h-4 w-4" />
                            )}
                            {isLocked ? "قفل" : "باز"}
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose}>
                            انصراف
                        </Button>
                        <Button type="submit" disabled={saving || !name.trim()}>
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            ذخیره
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
