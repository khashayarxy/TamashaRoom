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
import { useEffect, useState } from "react";

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

    useEffect(() => {
        if (open) {
            setVideoUrl(initialUrl ?? "");
        }
    }, [open, initialUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoUrl.trim() || loading) return;
        await onSetVideo(videoUrl.trim());
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
                    <Input
                        label="آدرس ویدیو"
                        placeholder="https://example.com/video.mp4"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
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
