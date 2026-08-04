import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * Catches render-time exceptions anywhere below it and shows a recoverable
 * fallback instead of a blank page. Reloading the page (or navigating) resets
 * it, since the boundary remounts on a fresh render.
 */
export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error): void {
        console.error("Unhandled render error:", error);
    }

    render(): ReactNode {
        if (this.state.hasError) {
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
