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
import { Loader2, Tv } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SetVideoDialogProps {
    open: boolean;
    onClose: () => void;
    onSetVideo: (url: string) => Promise<void>;
    loading?: boolean;
    initialUrl?: string | null;
}

/**
 * Staged status lines shown while the set-video POST is in flight.
 * Purely presentational (local timers only): the request itself gives no
 * progress events, so the stages cycle until it resolves. No backend,
 * no polling, no extra requests.
 */
const STATUS_MESSAGES = [
    "در حال بررسی لینک...",
    "در حال اتصال به سرور...",
    "در حال تحلیل فرمت ویدیو...",
    "در حال بررسی کدک...",
];

const STATUS_INTERVAL_MS = 800;

export function SetVideoDialog({
    open,
    onClose,
    onSetVideo,
    loading = false,
    initialUrl = "",
}: SetVideoDialogProps) {
    const [videoUrl, setVideoUrl] = useState(initialUrl ?? "");
    const [error, setError] = useState<string | null>(null);
    const [statusStage, setStatusStage] = useState(0);
    const prevOpenRef = useRef(false);

    useEffect(() => {
        if (open && !prevOpenRef.current) {
            setVideoUrl(initialUrl ?? "");
            setError(null);
            setStatusStage(0);
        }
        prevOpenRef.current = open;
    }, [open, initialUrl]);

    useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => {
            setStatusStage((prev) => (prev + 1) % STATUS_MESSAGES.length);
        }, STATUS_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [loading]);

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
                        لینک ویدیو با فرمت MKV یا MP4 و انکود x264 رو وارد کنید.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {loading && (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-xl border border-border">
                            <div className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                <span className="text-sm font-medium">
                                    {STATUS_MESSAGES[statusStage]}
                                </span>
                            </div>
                            <div
                                role="progressbar"
                                aria-label="در حال بررسی ویدیو"
                                className="relative h-2 bg-muted rounded-full overflow-hidden"
                            >
                                <div className="absolute top-0 h-full bg-primary animate-indeterminate" />
                            </div>
                        </div>
                    )}
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
