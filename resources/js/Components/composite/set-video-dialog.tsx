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
import { Tv } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SetVideoDialogProps {
    open: boolean;
    onClose: () => void;
    onSetVideo: (url: string) => Promise<void>;
    loading?: boolean;
    initialUrl?: string | null;
}

export function SetVideoDialog({
    open,
    onClose,
    onSetVideo,
    loading = false,
    initialUrl = "",
}: SetVideoDialogProps) {
    const [videoUrl, setVideoUrl] = useState(initialUrl ?? "");
    const [error, setError] = useState<string | null>(null);
    const prevOpenRef = useRef(false);

    useEffect(() => {
        if (open && !prevOpenRef.current) {
            setVideoUrl(initialUrl ?? "");
            setError(null);
        }
        prevOpenRef.current = open;
    }, [open, initialUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoUrl.trim() || loading) return;
        setError(null);
        try {
            await onSetVideo(videoUrl.trim());
        } catch (err: unknown) {
            setError(
                err instanceof Error && err.message
                    ? err.message
                    : "خطایی رخ داد.",
            );
        }
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Tv className="h-5 w-5 text-primary" />
                        تنظیم ویدیو
                    </DialogTitle>
                    <DialogDescription>
                        آدرس مستقیم فایل ویدیویی (MP4, WebM, ...) را برای پخش
                        وارد کنید.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {error && (
                        <div
                            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                            dir="rtl"
                        >
                            {error}
                        </div>
                    )}
                    <Input
                        label="آدرس ویدیو"
                        placeholder="https://example.com/video.mp4"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onDoubleClick={(e) => e.currentTarget.select()}
                        dir="ltr"
                        autoFocus
                    />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                        >
                            انصراف
                        </Button>
                        <Button
                            type="submit"
                            loading={loading}
                            disabled={!videoUrl.trim() || loading}
                        >
                            تنظیم ویدیو
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
