import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import type { SubtitleTrack } from "@/lib/types/subtitle";
import { Star, Subtitles, Trash2, Upload, X } from "lucide-react";
import { useRef } from "react";

interface SubtitleManagerDialogProps {
    open: boolean;
    onClose: () => void;
    isOwner: boolean;
    tracks: SubtitleTrack[];
    activeTrackId: number | null;
    roomDefaultId: number | null;
    tracksError: boolean;
    onUploadTrack: (file: File) => Promise<void>;
    onSelectTrack: (trackId: number | null) => void;
    onFollowDefault: () => void;
    onSetDefault: (trackId: number | null) => void;
    onRequestDelete: (trackId: number) => void;
}

export function SubtitleManagerDialog({
    open,
    onClose,
    isOwner,
    tracks,
    activeTrackId,
    roomDefaultId,
    tracksError,
    onUploadTrack,
    onSelectTrack,
    onFollowDefault,
    onSetDefault,
    onRequestDelete,
}: SubtitleManagerDialogProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent className="max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="pb-3 border-b border-border shrink-0 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <Subtitles className="h-5 w-5 text-primary" />
                            مدیریت زیرنویس‌ها
                        </DialogTitle>
                        <DialogDescription className="mt-1">
                            زیرنویس مورد نظر را انتخاب یا فایل جدید آپلود کنید.
                        </DialogDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-8 w-8 p-0 rounded-lg shrink-0"
                        aria-label="بستن"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </DialogHeader>

                {isOwner && (
                    <div className="py-2 shrink-0">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".srt,.vtt"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void onUploadTrack(file);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = "";
                                }
                            }}
                            className="hidden"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-center gap-2"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-4 w-4" />
                            آپلود زیرنویس جدید (.srt, .vtt)
                        </Button>
                    </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pe-1 py-1">
                    {tracks.length > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={() => onSelectTrack(null)}
                                className={`w-full text-end px-3 py-2 rounded-xl text-sm transition-colors ${
                                    activeTrackId === null
                                        ? "bg-primary/20 text-accent-foreground font-medium"
                                        : "text-muted-foreground hover:bg-secondary"
                                }`}
                            >
                                بدون زیرنویس
                            </button>

                            {roomDefaultId !== null &&
                                activeTrackId !== roomDefaultId && (
                                    <button
                                        type="button"
                                        onClick={onFollowDefault}
                                        className={`w-full text-end px-3 py-2 rounded-xl text-sm transition-colors ${
                                            activeTrackId === roomDefaultId
                                                ? "bg-primary/20 text-accent-foreground font-medium"
                                                : "text-muted-foreground hover:bg-secondary"
                                        }`}
                                    >
                                        پیش‌فرض اتاق
                                    </button>
                                )}

                            {tracks.map((track) => (
                                <div
                                    key={track.id}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                                        activeTrackId === track.id
                                            ? "bg-primary/20 text-accent-foreground font-medium"
                                            : "text-muted-foreground hover:bg-secondary"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelectTrack(track.id)}
                                        className="flex-1 text-end truncate"
                                    >
                                        {track.label}
                                        <span className="text-xs text-muted-foreground me-2">
                                            .{track.original_extension}
                                        </span>
                                        {roomDefaultId === track.id && (
                                            <span className="text-xs text-accent-foreground ms-1">
                                                (پیش‌فرض)
                                            </span>
                                        )}
                                    </button>
                                    {isOwner && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onSetDefault(
                                                        roomDefaultId ===
                                                            track.id
                                                            ? null
                                                            : track.id,
                                                    )
                                                }
                                                className="p-1 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                                                title={
                                                    roomDefaultId === track.id
                                                        ? "حذف پیش‌فرض"
                                                        : "تنظیم به‌عنوان پیش‌فرض"
                                                }
                                                aria-label={
                                                    roomDefaultId === track.id
                                                        ? "حذف پیش‌فرض"
                                                        : "تنظیم به‌عنوان پیش‌فرض"
                                                }
                                            >
                                                <Star
                                                    className={`h-4 w-4 ${
                                                        roomDefaultId ===
                                                        track.id
                                                            ? "fill-current text-primary"
                                                            : ""
                                                    }`}
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onRequestDelete(track.id)
                                                }
                                                className="p-1 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                                                title="حذف"
                                                aria-label="حذف"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}

                    {tracksError && tracks.length === 0 && (
                        <p className="text-xs text-destructive-text p-3 text-center">
                            خطا در دریافت لیست زیرنویس‌ها
                        </p>
                    )}

                    {!tracksError && tracks.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">
                            هنوز زیرنویسی آپلود نشده است
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
