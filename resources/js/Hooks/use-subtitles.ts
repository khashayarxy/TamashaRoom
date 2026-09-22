import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { getEcho } from "@/lib/echo";
import type { EmbeddedSubtitleSelection } from "@/lib/embedded-subtitles";
import {
    clearActiveTrackChoice,
    loadActiveTrackId,
    saveActiveTrackId,
} from "@/lib/subtitle-selection";
import type { SubtitleCue, SubtitleTrack } from "@/lib/types/subtitle";
import { subtitleTracksSchema } from "@/lib/validation";

export function useSubtitles(
    roomId: number,
    roomDefaultIdInitial: number | null,
) {
    const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
    const [tracksError, setTracksError] = useState(false);
    const [activeTrackId, setActiveTrackId] = useState<number | null>(() => {
        const stored = loadActiveTrackId(roomId);
        return stored === undefined ? roomDefaultIdInitial : stored;
    });
    const [roomDefaultId, setRoomDefaultId] = useState<number | null>(
        roomDefaultIdInitial,
    );
    const [cues, setCues] = useState<SubtitleCue[]>([]);
    const [subLoading, setSubLoading] = useState(false);
    const [subError, setSubError] = useState<string | null>(null);
    const [trackToDelete, setTrackToDelete] = useState<number | null>(null);
    const [deletingTrack, setDeletingTrack] = useState(false);

    const fetchTracks = useCallback(async () => {
        try {
            const res = await api.get(`/subtitles/${roomId}`);
            setTracks(subtitleTracksSchema.parse(res.data));
            setTracksError(false);
        } catch {
            setTracksError(true);
        }
    }, [roomId]);

    useEffect(() => {
        setTracksError(false);
        void fetchTracks();
    }, [roomId, fetchTracks]);

    // Room-default changes (manual or auto-applied on set-video) arrive on
    // the same presence channel as chat. Members following the default
    // adopt it; members with a local override keep theirs. The track list
    // is refetched because auto-detection may have added embedded rows.
    useEffect(() => {
        const echo = getEcho();
        if (!echo) return undefined;

        const channel = echo.join(`room.${roomId}`);
        channel.listen(".subtitle.default.changed", (payload: unknown) => {
            if (
                typeof payload !== "object" ||
                payload === null ||
                !("default_track_id" in payload)
            ) {
                return;
            }
            const next =
                payload.default_track_id === null
                    ? null
                    : Number(payload.default_track_id);
            const defaultId =
                Number.isInteger(next) && (next as number) >= 0
                    ? (next as number)
                    : null;
            setRoomDefaultId(defaultId);
            void fetchTracks();
            if (loadActiveTrackId(roomId) === undefined) {
                setActiveTrackId(defaultId);
            }
        });

        return () => {
            channel.stopListening(".subtitle.default.changed");
            echo.leave(`room.${roomId}`);
        };
    }, [roomId, fetchTracks]);

    const selectTrack = (trackId: number | null) => {
        setActiveTrackId(trackId);
        saveActiveTrackId(roomId, trackId);
    };

    const followRoomDefault = () => {
        clearActiveTrackChoice(roomId);
        setActiveTrackId(roomDefaultId);
    };

    const setRoomDefault = async (trackId: number | null) => {
        try {
            await api.post(`/subtitles/${roomId}/default`, {
                track_id: trackId,
            });
            setRoomDefaultId(trackId);
        } catch {
            setSubError("خطا در تنظیم زیرنویس پیش‌فرض");
        }
    };

    const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null;
    // Primitive on purpose: feeds effect deps without identity churn.
    const activeIsEmbedded = activeTrack?.kind === "embedded";
    const embeddedSelection: EmbeddedSubtitleSelection | null =
        activeIsEmbedded && activeTrack !== null
            ? {
                  language: activeTrack.language,
                  index: activeTrack.track_index ?? 0,
              }
            : null;

    useEffect(() => {
        if (!activeTrackId) {
            setCues([]);
            setSubError(null);
            return;
        }

        // Embedded tracks have no server-side cues file — the browser
        // renders them natively (see applyEmbeddedSubtitle). Never hit the
        // cues endpoint for them; a 404 there would surface a bogus error.
        if (activeIsEmbedded) {
            setCues([]);
            setSubLoading(false);
            setSubError(null);
            return;
        }

        let cancelled = false;
        setSubLoading(true);
        setSubError(null);

        api.get(`/subtitles/${roomId}/${activeTrackId}/cues`)
            .then((res) => {
                if (cancelled) return;
                setCues(res.data.cues ?? []);
                setSubLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setCues([]);
                setSubError("خطا در بارگذاری زیرنویس");
                setSubLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [roomId, activeTrackId, activeIsEmbedded]);

    const uploadTrack = async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await api.post(`/subtitles/${roomId}`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setTracks((prev) => [res.data, ...prev]);
            selectTrack(res.data.id);
        } catch {
            setSubError("خطا در آپلود فایل");
        }
    };

    const deleteTrack = async (trackId: number) => {
        setDeletingTrack(true);
        try {
            await api.delete(`/subtitles/${roomId}/${trackId}`);
            setTracks((prev) => prev.filter((t) => t.id !== trackId));
            if (activeTrackId === trackId) {
                selectTrack(null);
                setCues([]);
            }
            if (roomDefaultId === trackId) {
                setRoomDefaultId(null);
            }
        } catch {
            setSubError("خطا در حذف زیرنویس");
        } finally {
            setDeletingTrack(false);
            setTrackToDelete(null);
        }
    };

    return {
        tracks,
        tracksError,
        activeTrackId,
        roomDefaultId,
        embeddedSelection,
        cues,
        subLoading,
        subError,
        trackToDelete,
        deletingTrack,
        setTrackToDelete,
        selectTrack,
        followRoomDefault,
        setRoomDefault,
        uploadTrack,
        deleteTrack,
    };
}
