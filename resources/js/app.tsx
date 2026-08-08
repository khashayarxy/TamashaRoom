import "../css/app.css";
import "./bootstrap";

import { InertiaProgress } from "@/Components/ui/inertia-progress";
import { Toaster } from "@/Components/ui/sonner";
import { ErrorBoundary } from "@/Components/ui/error-boundary";
import { createInertiaApp } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { createRoot } from "react-dom/client";

const appName = import.meta.env.VITE_APP_NAME || "Laravel";

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
    },
    progress: false,
});
