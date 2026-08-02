import { Button } from "@/Components/ui/button";
import { Copy, PlayCircle, Share2, X } from "lucide-react";

interface RoomOnboardingProps {
    onCopyInvite: () => void;
    onAddVideo: () => void;
    onDismiss: () => void;
}

export function RoomOnboarding({
    onCopyInvite,
    onAddVideo,
    onDismiss,
}: RoomOnboardingProps) {
    return (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-sm font-bold mb-3">راه‌اندازی اتاق</h3>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                            <PlayCircle className="h-4 w-4 text-primary shrink-0" />
                            یک ویدیو اضافه کنید
                        </li>
                        <li className="flex items-center gap-2">
                            <Share2 className="h-4 w-4 text-primary shrink-0" />
                            لینک دعوت را برای دوستان بفرستید
                        </li>
                        <li className="flex items-center gap-2">
                            <Copy className="h-4 w-4 text-primary shrink-0" />
                            همه هم‌زمان تماشا کنید
                        </li>
                    </ol>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={onAddVideo}>
                            <PlayCircle className="h-4 w-4" />
                            افزودن ویدیو
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCopyInvite}
                        >
                            <Copy className="h-4 w-4" />
                            کپی لینک دعوت
                        </Button>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDismiss}
                    aria-label="بستن راهنما"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
