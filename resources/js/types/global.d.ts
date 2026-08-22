import { PageProps as InertiaPageProps } from "@inertiajs/core";
import { AxiosInstance } from "axios";
import { route as ziggyRoute } from "ziggy-js";
import { PageProps as AppPageProps } from "./";

declare global {
    interface Window {
        axios: AxiosInstance;
        /** Set at app.tsx module-eval: the entry bundle executed. */
        __TAMASHAROOM_APP_BOOTED?: boolean;
        /** Set after the React root renders. */
        __TAMASHA_MOUNTED__?: boolean;
        __tamashaClearFallbackTimer?: () => void;
    }

    var route: typeof ziggyRoute;
}

declare module "@inertiajs/core" {
    interface PageProps extends InertiaPageProps, AppPageProps {}
}
