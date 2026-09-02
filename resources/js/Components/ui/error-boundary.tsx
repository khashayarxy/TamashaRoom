import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Custom fallback UI; defaults to Persian reload prompt. */
    fallback?: ReactNode;
    /** Optional error reporter (e.g. Sentry). */
    onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

/**
 * Catches render-time exceptions anywhere below it and shows a recoverable
 * fallback instead of a blank page. Reloading the page (or navigating) resets
 * it, since the boundary remounts on a fresh render.
 * Optionally forwards to `onError` and to `window.Sentry` when available.
 */
export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("Unhandled render error:", error, info.componentStack);

        // Optional explicit reporter.
        this.props.onError?.(error, info);

        // Best-effort Sentry bridge when @sentry/browser is loaded (no hard dep).
        const sentry = (
            window as unknown as {
                Sentry?: { captureException?: (e: unknown) => void };
            }
        ).Sentry;
        sentry?.captureException?.(error);
    }

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div
                    className="flex min-h-screen items-center justify-center bg-background p-6"
                    role="alert"
                >
                    <div className="text-center max-w-sm">
                        <h1 className="text-lg font-bold mb-2">
                            مشکلی پیش آمد
                        </h1>
                        <p className="text-sm text-muted-foreground mb-4">
                            خطایی غیرمنتظره رخ داد. صفحه را مجدداً بارگذاری
                            کنید.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center justify-center h-10 px-4 text-sm rounded-xl bg-primary text-primary-foreground hover:brightness-110"
                        >
                            بارگذاری مجدد
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
