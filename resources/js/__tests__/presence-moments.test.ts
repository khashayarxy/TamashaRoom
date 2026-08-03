import { describe, it, expect } from "vitest";
import {
    buildPresenceBaseline,
    derivePresenceMoments,
    type PresenceMemberData,
} from "@/lib/presence-moments";

function member(
    user_id: number,
    name: string,
    presence_status: PresenceMemberData["presence_status"],
): PresenceMemberData {
    return { user_id, name, presence_status };
}

describe("derivePresenceMoments", () => {
    it("emits nothing on the initial snapshot", () => {
        const first = [
            member(1, "سارا", "online"),
            member(2, "علی", "offline"),
        ];
        const moments = derivePresenceMoments(null, first, 1000);
        expect(moments).toEqual([]);
    });

    it("emits a join when a member becomes online from offline", () => {
        const prev = buildPresenceBaseline([member(1, "سارا", "offline")]);
        const next = [member(1, "سارا", "online")];
        const moments = derivePresenceMoments(prev, next, 2000);
        expect(moments).toEqual([
            { type: "join", name: "سارا", user_id: 1, at: 2000 },
        ]);
    });

    it("emits a join when a brand-new online member appears", () => {
        const prev = buildPresenceBaseline([member(1, "سارا", "online")]);
        const next = [member(1, "سارا", "online"), member(2, "علی", "online")];
        const moments = derivePresenceMoments(prev, next, 2000);
        expect(moments).toEqual([
            { type: "join", name: "علی", user_id: 2, at: 2000 },
        ]);
    });

    it("does not emit a join when a brand-new member appears offline", () => {
        const prev = buildPresenceBaseline([member(1, "سارا", "online")]);
        const next = [member(1, "سارا", "online"), member(2, "علی", "offline")];
        const moments = derivePresenceMoments(prev, next, 2000);
        expect(moments).toEqual([]);
    });

    it("emits a leave when a member goes offline from online", () => {
        const prev = buildPresenceBaseline([member(1, "سارا", "online")]);
        const next = [member(1, "سارا", "offline")];
        const moments = derivePresenceMoments(prev, next, 2000);
        expect(moments).toEqual([
            { type: "leave", name: "سارا", user_id: 1, at: 2000 },
        ]);
    });

    it("emits a leave when an online member vanishes from the list", () => {
        const prev = buildPresenceBaseline([
            member(1, "سارا", "online"),
            member(2, "علی", "online"),
        ]);
        const next = [member(2, "علی", "online")];
        const moments = derivePresenceMoments(prev, next, 2000);
        expect(moments).toEqual([
            { type: "leave", name: "سارا", user_id: 1, at: 2000 },
        ]);
    });

    it("does not treat online<->away changes as join/leave", () => {
        const prev = buildPresenceBaseline([member(1, "سارا", "away")]);
        const next = [member(1, "سارا", "online")];
        expect(derivePresenceMoments(prev, next, 2000)).toEqual([]);

        const prev2 = buildPresenceBaseline([member(1, "سارا", "online")]);
        const next2 = [member(1, "سارا", "away")];
        expect(derivePresenceMoments(prev2, next2, 2000)).toEqual([]);
    });

    it("does not emit anything when the snapshot is unchanged", () => {
        const prev = buildPresenceBaseline([
            member(1, "سارا", "online"),
            member(2, "علی", "offline"),
        ]);
        const next = [member(1, "سارا", "online"), member(2, "علی", "offline")];
        expect(derivePresenceMoments(prev, next, 2000)).toEqual([]);
    });

    it("emits one join for each newly-online member in a single poll", () => {
        const prev = buildPresenceBaseline([
            member(1, "سارا", "offline"),
            member(2, "علی", "offline"),
        ]);
        const next = [member(1, "سارا", "online"), member(2, "علی", "online")];
        const moments = derivePresenceMoments(prev, next, 2000);
        expect(moments).toHaveLength(2);
        expect(moments.map((m) => m.user_id)).toEqual([1, 2]);
    });

    it("does not duplicate across repeated identical polls", () => {
        const first = [member(1, "سارا", "offline")];
        const baseline = buildPresenceBaseline(first);

        const online1 = derivePresenceMoments(
            baseline,
            [member(1, "سارا", "online")],
            2000,
        );
        const online2 = derivePresenceMoments(
            buildPresenceBaseline([member(1, "سارا", "online")]),
            [member(1, "سارا", "online")],
            5000,
        );

        expect(online1).toHaveLength(1);
        expect(online2).toEqual([]);
    });

    it("does not emit a join for the same member twice across polls", () => {
        const baseline = buildPresenceBaseline([member(1, "سارا", "offline")]);
        const joined = [member(1, "سارا", "online")];
        const first = derivePresenceMoments(baseline, joined, 2000);
        const secondBaseline = buildPresenceBaseline(joined);
        const second = derivePresenceMoments(secondBaseline, joined, 3000);

        expect(first).toHaveLength(1);
        expect(second).toEqual([]);
    });
});
