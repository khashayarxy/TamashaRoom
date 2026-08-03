const ACTIVE_TRACK_KEY = "tamasharoom-active-track";

export type ActiveTrackChoice = number | null | undefined;

export function loadActiveTrackId(roomId: number): ActiveTrackChoice {
    try {
        const raw = localStorage.getItem(`${ACTIVE_TRACK_KEY}-${roomId}`);
        if (raw === null) return undefined;
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

export function saveActiveTrackId(
    roomId: number,
    trackId: number | null,
): void {
    localStorage.setItem(
        `${ACTIVE_TRACK_KEY}-${roomId}`,
        JSON.stringify(trackId),
    );
}

export function clearActiveTrackChoice(roomId: number): void {
    localStorage.removeItem(`${ACTIVE_TRACK_KEY}-${roomId}`);
}
