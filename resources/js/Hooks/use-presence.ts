import api from "@/lib/api";
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

export function usePresence(roomId: number | null) {
    const [members, setMembers] = useState<PresenceMember[]>([]);
    const [connected, setConnected] = useState(false);
    const versionRef = useRef(0);
    const retryRef = useRef(HEARTBEAT_INTERVAL);
    const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cancelledRef = useRef(false);
    const roomIdRef = useRef(roomId);
    const documentHiddenRef = useRef(
        typeof document !== "undefined" && document.hidden,
    );

    useEffect(() => {
        roomIdRef.current = roomId;
    }, [roomId]);

    const scheduleHeartbeat = useCallback((delay: number) => {
        cancelledRef.current = false;

        clearTimeout(heartbeatTimerRef.current!);
        heartbeatTimerRef.current = setTimeout(tick, delay);

        async function tick() {
            if (documentHiddenRef.current) {
                if (!cancelledRef.current) {
                    heartbeatTimerRef.current = setTimeout(
                        tick,
                        retryRef.current,
                    );
                }
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
            } catch {
                retryRef.current = Math.min(
                    retryRef.current * 2,
                    MAX_RETRY_DELAY,
                );
                setConnected(false);
            }

            if (!cancelledRef.current) {
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
            setMembers(data);
            setConnected(true);
        } catch {
            setConnected(false);
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
            cancelledRef.current = true;
            if (heartbeatTimerRef.current)
                clearTimeout(heartbeatTimerRef.current);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [roomId, scheduleHeartbeat, fetchPresence]);

    useEffect(() => {
        if (!roomId) return;

        const handleBeforeUnload = () => {
            navigator.sendBeacon(`/presence/${roomId}/leave`);
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [roomId]);

    return {
        members,
        connected,
        sendHeartbeat: () => {
            cancelledRef.current = false;
            scheduleHeartbeat(0);
        },
    };
}
