export type PresenceStatus = "online" | "offline" | "away";

export interface PresenceMemberData {
    user_id: number;
    name: string;
    presence_status: PresenceStatus;
}

export interface PresenceBaselineEntry {
    name: string;
    status: PresenceStatus;
}

export type PresenceBaseline = Map<number, PresenceBaselineEntry>;

export interface PresenceMoment {
    id: string;
    type: "join" | "leave";
    name: string;
    user_id: number;
    at: number;
}

/**
 * Build the baseline map (user_id -> { name, status }) for a presence snapshot.
 * The first snapshot in a room acts as the baseline; nothing is emitted for it.
 */
export function buildPresenceBaseline(
    members: PresenceMemberData[],
): PresenceBaseline {
    const baseline = new Map<number, PresenceBaselineEntry>();
    for (const member of members) {
        baseline.set(member.user_id, {
            name: member.name,
            status: member.presence_status,
        });
    }
    return baseline;
}

/**
 * Diff two consecutive presence snapshots and return join/leave moments.
 *
 * Rules (deterministic, transition-based):
 * - `prev === null` (initial snapshot) emits nothing.
 * - A member becoming `online` from `offline` or from being absent -> join.
 * - A member becoming `offline` from `online` -> leave.
 * - `online <-> away` changes are NOT events (presence, not membership).
 * - A previously-online member vanishing from the list -> leave (removed/kicked).
 *
 * Because this only compares consecutive snapshots, repeated identical polls
 * (retries, visibility refetches, unchanged data) emit nothing.
 */
export function derivePresenceMoments(
    prev: PresenceBaseline | null,
    next: PresenceMemberData[],
    now: number,
): Array<Omit<PresenceMoment, "id">> {
    if (prev === null) return [];

    const moments: Array<Omit<PresenceMoment, "id">> = [];
    const nextIds = new Set(next.map((m) => m.user_id));

    for (const member of next) {
        const prevStatus = prev.get(member.user_id)?.status;

        if (
            member.presence_status === "online" &&
            prevStatus !== "online" &&
            prevStatus !== "away"
        ) {
            moments.push({
                type: "join",
                name: member.name,
                user_id: member.user_id,
                at: now,
            });
        } else if (
            member.presence_status === "offline" &&
            prevStatus === "online"
        ) {
            moments.push({
                type: "leave",
                name: member.name,
                user_id: member.user_id,
                at: now,
            });
        }
    }

    for (const [userId, entry] of prev) {
        if (entry.status === "online" && !nextIds.has(userId)) {
            moments.push({
                type: "leave",
                name: entry.name,
                user_id: userId,
                at: now,
            });
        }
    }

    return moments;
}
