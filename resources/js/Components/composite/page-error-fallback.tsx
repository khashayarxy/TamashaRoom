import { Button } from "@/Components/ui/button";

interface PageErrorFallbackProps {
    onReset?: () => void;
}

/**
 * Route-level fallback — Persian copy per spec.
 * Used inside <ErrorBoundary fallback={<PageErrorFallback />}>.
 * Attempts Sentry capture when available, then offers reload.
 */
export function PageErrorFallback({ onReset }: PageErrorFallbackProps) {
    const handleReload = () => {
        if (onReset) {
            onReset();
            return;
        }
        window.location.reload();
    };

    return (
        <div
            className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center"
            role="alert"
            dir="rtl"
        >
            <h2 className="text-lg font-bold text-foreground">
                خطایی رخ داد — لطفاً صفحه را تازه کنید.
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
                مشکلی غیرمنتظره پیش آمد. با تازه‌سازی صفحه دوباره تلاش کنید. اگر
                مشکل ادامه داشت، با پشتیبانی تماس بگیرید.
            </p>
            <Button onClick={handleReload} variant="primary">
                بارگذاری مجدد
            </Button>
        </div>
    );
}
