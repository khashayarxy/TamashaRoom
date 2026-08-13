import { z } from "zod";

/**
 * Runtime validation for values crossing trust boundaries (untrusted API
 * responses and localStorage). PHP-side input is validated by Form Requests;
 * these schemas cover the opposite direction: data that reaches the frontend
 * from the server or from the browser's own storage.
 */

export const chatMessageSchema = z.object({
    id: z.number().int().nonnegative(),
    user_id: z.number().int().nonnegative(),
    body: z.string(),
    user: z.object({
        id: z.number().int().nonnegative(),
        name: z.string(),
    }),
    created_at: z.string(),
});

export const chatMessagesSchema = z.array(chatMessageSchema);

export const subtitleSettingsSchema = z.object({
    size: z.number().int().min(10).max(40).default(20),
    color: z
        .string()
        .default("#FFFFFF")
        .transform((val) => {
            const upper = val.toUpperCase();
            if (upper === "#FFFF00") return "#FFFF00";
            return "#FFFFFF";
        }),
    enabled: z.boolean().default(true),
    bgOpacity: z.number().int().min(0).max(100).default(40),
    position: z.enum(["bottom", "top"]).default("bottom"),
    offset: z.number().int().min(-5000).max(5000).default(0),
    fontFamily: z
        .string()
        .default("Vazirmatn-Medium")
        .transform((val) => {
            if (val === "IRANSansXFaNum-Medium") {
                return "IRANSansXFaNum-Medium";
            }
            return "Vazirmatn-Medium";
        }),
    borderRadius: z.enum(["rounded", "sharp"]).default("rounded"),
    vOffset: z.number().int().min(-25).max(75).default(0),
});

export const subtitleTrackSchema = z.object({
    id: z.number().int().nonnegative(),
    label: z.string(),
    language: z.string(),
    original_extension: z.string(),
    created_at: z.string(),
});

export const subtitleTracksSchema = z.array(subtitleTrackSchema);
