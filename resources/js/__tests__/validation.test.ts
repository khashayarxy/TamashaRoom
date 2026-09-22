import { describe, it, expect } from "vitest";
import {
    chatMessageSchema,
    chatMessagesSchema,
    subtitleSettingsSchema,
    subtitleTrackSchema,
    subtitleTracksSchema,
} from "@/lib/validation";

describe("lib/validation schemas", () => {
    it("chatMessageSchema accepts a well-formed message", () => {
        const message = {
            id: 1,
            user_id: 2,
            body: "سلام",
            user: { id: 2, name: "علی" },
            created_at: "2026-08-04T00:00:00.000000Z",
            reply_to_id: null,
            reply_to: null,
            likes: [],
        };
        expect(chatMessageSchema.parse(message)).toEqual(message);
    });

    it("chatMessageSchema accepts a message with reply and likes", () => {
        const message = {
            id: 3,
            user_id: 4,
            body: "موافقم",
            user: { id: 4, name: "سارا" },
            created_at: "2026-08-04T00:00:00.000000Z",
            reply_to_id: 1,
            reply_to: {
                id: 1,
                body: "سلام",
                user: { id: 2, name: "علی" },
            },
            likes: [{ user_id: 2, user: { id: 2, name: "علی" } }],
        };
        expect(chatMessageSchema.parse(message)).toEqual(message);
    });

    it("chatMessagesSchema rejects a malformed message", () => {
        const malformed = [{ id: "not-a-number", body: "bad" }];
        expect(() => chatMessagesSchema.parse(malformed)).toThrow();
    });

    it("chatMessageSchema rejects a message missing its user", () => {
        const missingUser = {
            id: 1,
            user_id: 2,
            body: "سلام",
            created_at: "2026-08-04T00:00:00.000000Z",
        };
        expect(() => chatMessageSchema.parse(missingUser)).toThrow();
    });

    it("subtitleSettingsSchema fills defaults for partial stored settings", () => {
        const parsed = subtitleSettingsSchema.parse({ size: 24 });
        expect(parsed.size).toBe(24);
        expect(parsed.color).toBe("#FFFFFF");
        expect(parsed.enabled).toBe(true);
        expect(parsed.position).toBe("bottom");
        expect(parsed.offset).toBe(0);
    });

    it("subtitleSettingsSchema falls back to #FFFFFF for unsupported colors", () => {
        const parsedPink = subtitleSettingsSchema.parse({ color: "#f472b6" });
        expect(parsedPink.color).toBe("#FFFFFF");

        const parsedYellow = subtitleSettingsSchema.parse({ color: "#ffff00" });
        expect(parsedYellow.color).toBe("#FFFF00");
    });

    it("subtitleSettingsSchema handles fontFamily validation and legacy migration", () => {
        const regular = subtitleSettingsSchema.parse({
            fontFamily: "IRANSansXFaNum-Regular",
        });
        expect(regular.fontFamily).toBe("IRANSansXFaNum-Regular");

        const legacyMedium = subtitleSettingsSchema.parse({
            fontFamily: "IRANSansXFaNum-Medium",
        });
        expect(legacyMedium.fontFamily).toBe("IRANSansXFaNum-Regular");

        const unknown = subtitleSettingsSchema.parse({
            fontFamily: "Times New Roman",
        });
        expect(unknown.fontFamily).toBe("Vazirmatn-Medium");
    });

    it("subtitleSettingsSchema rejects out-of-range values", () => {
        expect(() => subtitleSettingsSchema.parse({ offset: 99999 })).toThrow();
        expect(() => subtitleSettingsSchema.parse({ size: 500 })).toThrow();
        expect(() =>
            subtitleSettingsSchema.parse({ position: "middle" }),
        ).toThrow();
    });

    it("subtitleTracksSchema accepts a well-formed track list", () => {
        const tracks = [
            {
                id: 1,
                kind: "upload",
                track_index: null,
                label: "فارسی",
                language: "fa",
                original_extension: "vtt",
                created_at: "2026-08-04T00:00:00.000000Z",
            },
            {
                id: 2,
                kind: "embedded",
                track_index: 0,
                label: "Embedded (PER)",
                language: "per",
                original_extension: "mkv",
                created_at: "2026-08-04T00:00:00.000000Z",
            },
        ];
        expect(subtitleTracksSchema.parse(tracks)).toEqual(tracks);
    });

    it("subtitleTrackSchema rejects a track missing required fields", () => {
        expect(() =>
            subtitleTrackSchema.parse({
                id: 1,
                label: "فارسی",
                created_at: "2026-08-04T00:00:00.000000Z",
            }),
        ).toThrow();
    });
});
