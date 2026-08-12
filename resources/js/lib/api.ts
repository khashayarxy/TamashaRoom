import axios from "axios";
import { isPollingSuspended } from "./polling-controller";

const api = axios.create({
    headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
    },
});

api.interceptors.request.use((config) => {
    // Same-tab protection: abort in-flight room polling requests if the user
    // initiated a same-tab navigation or form submission.
    if (
        isPollingSuspended() &&
        (config.url?.includes("/playback/") ||
            config.url?.includes("/presence/") ||
            config.url?.includes("/chat/"))
    ) {
        const controller = new AbortController();
        controller.abort("polling_suspended");
        config.signal = controller.signal;
    }
    return config;
});

export default api;
