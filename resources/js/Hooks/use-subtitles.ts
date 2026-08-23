import { useEffect, useState } from "react";
import api from "@/lib/api";
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

    useEffect(() => {
        let cancelled = false;
        setTracksError(false);
        api.get(`/subtitles/${roomId}`)
            .then((res) => {
                if (cancelled) return;
                setTracks(subtitleTracksSchema.parse(res.data));
            })
            .catch(() => {
                if (cancelled) return;
                setTracksError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [roomId]);

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

    useEffect(() => {
        if (!activeTrackId) {
            setCues([]);
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
    }, [roomId, activeTrackId]);

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
