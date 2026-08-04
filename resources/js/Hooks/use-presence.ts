import api from "@/lib/api";
import {
    buildPresenceBaseline,
    derivePresenceMoments,
    type PresenceBaseline,
    type PresenceMoment,
} from "@/lib/presence-moments";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PresenceMember {
    id: number;
    user_id: number;
    name: string;
    presence_status: "online" | "offline" | "away";
    last_seen_at: string;
    disconnected_at: string | null;
    joined_at: string;
    is_owner: boolean;
}

const HEARTBEAT_INTERVAL = 30000;
const POLL_INTERVAL = 5000;
const MAX_RETRY_DELAY = 300000;

interface UsePresenceOptions {
    /** Called when the room is no longer accessible (e.g. the member was removed). */
    onRemoved?: () => void;
}

export function usePresence(
    roomId: number | null,
    options: UsePresenceOptions = {},
) {
    const { onRemoved } = options;
    const onRemovedRef = useRef(onRemoved);
    const removedRef = useRef(false);

    useEffect(() => {
        onRemovedRef.current = onRemoved;
    }, [onRemoved]);

    const [members, setMembers] = useState<PresenceMember[]>([]);
    const [connected, setConnected] = useState(false);
    const [moments, setMoments] = useState<PresenceMoment[]>([]);
    const baselineRef = useRef<PresenceBaseline | null>(null);
    const momentIdRef = useRef(0);
    const versionRef = useRef(0);
    const retryRef = useRef(HEARTBEAT_INTERVAL);
    const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const generationRef = useRef(0);
    const roomIdRef = useRef(roomId);
    const documentHiddenRef = useRef(
        typeof document !== "undefined" && document.hidden,
    );

    useEffect(() => {
        baselineRef.current = null;
        setMoments([]);
        removedRef.current = false;
    }, [roomId]);

    useEffect(() => {
        roomIdRef.current = roomId;
    }, [roomId]);

    const scheduleHeartbeat = useCallback((delay: number) => {
        const gen = ++generationRef.current;

        clearTimeout(heartbeatTimerRef.current!);
        heartbeatTimerRef.current = setTimeout(tick, delay);

        async function tick() {
            if (generationRef.current !== gen) return;

            if (documentHiddenRef.current) {
                heartbeatTimerRef.current = setTimeout(tick, retryRef.current);
                return;
            }

            const rid = roomIdRef.current;
            if (!rid) return;
            try {
                const { data } = await api.post(`/presence/${rid}/heartbeat`);
                if (data.heartbeat_version > versionRef.current) {
                    versionRef.current = data.heartbeat_version;
                }
                retryRef.current = HEARTBEAT_INTERVAL;
                setConnected(true);
            } catch (error) {
                if (isRemovalError(error) && !removedRef.current) {
                    removedRef.current = true;
                    setConnected(false);
                    onRemovedRef.current?.();
                    return;
                }
                retryRef.current = Math.min(
                    retryRef.current * 2,
                    MAX_RETRY_DELAY,
                );
                setConnected(false);
            }

            if (generationRef.current === gen) {
                heartbeatTimerRef.current = setTimeout(tick, retryRef.current);
            }
        }
    }, []);

    const fetchPresence = useCallback(async () => {
        if (!roomId || documentHiddenRef.current) return;
        try {
            const { data } = await api.get<PresenceMember[]>(
                `/presence/${roomId}`,
            );

            const derived = derivePresenceMoments(
                baselineRef.current,
                data,
                Date.now(),
            );
            if (derived.length > 0) {
                setMoments((prev) => [
                    ...prev,
                    ...derived.map((moment) => ({
                        ...moment,
                        id: `moment-${++momentIdRef.current}`,
                    })),
                ]);
            }

            baselineRef.current = buildPresenceBaseline(data);
            setMembers(data);
        } catch (error) {
            // A 403/404 means the room is no longer accessible to this user —
            // typically they were removed/kicked. Surface that distinctly from
            // a transient network failure so the page can redirect away.
            if (isRemovalError(error) && !removedRef.current) {
                removedRef.current = true;
                setConnected(false);
                onRemovedRef.current?.();
                return;
            }
            // The presence poll only updates member data; `connected` is owned
            // by the heartbeat (single source of truth).
        }
    }, [roomId]);

    useEffect(() => {
        if (!roomId) return;

        scheduleHeartbeat(0);
        fetchPresence();

        pollTimerRef.current = setInterval(fetchPresence, POLL_INTERVAL);

        const handleVisibility = () => {
            documentHiddenRef.current = document.hidden;
            if (document.visibilityState === "visible") {
                void fetchPresence();
                scheduleHeartbeat(0);
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            ++generationRef.current;
            if (heartbeatTimerRef.current)
                clearTimeout(heartbeatTimerRef.current);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [roomId, scheduleHeartbeat, fetchPresence]);

    useEffect(() => {
        if (!roomId) return;

        const handleBeforeUnload = () => {
            sendLeaveBeacon(roomId);
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            // SPA navigation (Inertia) unmounts the room page without firing
            // beforeunload, so also send the leave beacon here so the member
            // is marked offline promptly instead of waiting for the timeout.
            sendLeaveBeacon(roomId);
        };
    }, [roomId]);

    return {
        members,
        connected,
        moments,
        sendHeartbeat: () => {
            scheduleHeartbeat(0);
        },
    };
}

function isRemovalError(error: unknown): boolean {
    if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { status?: unknown } }).response
            ?.status === "number"
    ) {
        const status = (error as { response: { status: number } }).response
            .status;
        return status === 403 || status === 404;
    }
    return false;
}

function sendLeaveBeacon(roomId: number): void {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        // sendBeacon cannot set custom headers, so carry the CSRF token in the
        // body (multipart FormData) so the web-group /leave route doesn't 419.
        const formData = new FormData();
        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");
        if (csrfToken) {
            formData.append("_token", csrfToken);
        }
        navigator.sendBeacon(`/presence/${roomId}/leave`, formData);
    }
}
