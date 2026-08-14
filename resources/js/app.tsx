import "../css/app.css";
import "./bootstrap";

import { InertiaProgress } from "@/Components/ui/inertia-progress";
import { Toaster } from "@/Components/ui/sonner";
import { ErrorBoundary } from "@/Components/ui/error-boundary";
import { createInertiaApp } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { createRoot } from "react-dom/client";

import { router } from "@inertiajs/react";
import { suspendPolling, resumePolling } from "@/lib/polling-controller";

const appName = import.meta.env.VITE_APP_NAME || "Laravel";

router.on("start", () => {
    suspendPolling();
});

router.on("finish", () => {
    resumePolling();
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob("./Pages/**/*.tsx"),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ErrorBoundary>
                <App {...props} />
                <InertiaProgress />
                <Toaster />
            </ErrorBoundary>,
        );

        window.__TAMASHA_MOUNTED__ = true;
        document.documentElement.setAttribute("data-app-mounted", "true");
        if (typeof window.__tamashaClearFallbackTimer === "function") {
            window.__tamashaClearFallbackTimer();
        }
    },
    progress: false,
});
