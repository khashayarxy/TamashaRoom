import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export const CREATE_ROOM_INTENT_KEY = "tamasharoom.open-create-room";

const persianDigits: Record<string, string> = {
    "0": "۰",
    "1": "۱",
    "2": "۲",
    "3": "۳",
    "4": "۴",
    "5": "۵",
    "6": "۶",
    "7": "۷",
    "8": "۸",
    "9": "۹",
};

export function toPersianDigits(num: number | string): string {
    return String(num).replace(/[0-9]/g, (d) => persianDigits[d] || d);
}

export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function timeAgo(date: Date | string): string {
    const now = new Date();
    const past = typeof date === "string" ? new Date(date) : date;
    const diffMs = now.getTime() - past.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    // Persian-context relative times must use Persian digits (DESIGN.md).
    if (diffMinutes < 1) return "همین الان";
    if (diffMinutes < 60) return `${toPersianDigits(diffMinutes)} دقیقه پیش`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${toPersianDigits(diffHours)} ساعت پیش`;

    const diffDays = Math.floor(diffHours / 24);
    return `${toPersianDigits(diffDays)} روز پیش`;
}

/**
 * Copy to the clipboard, swallowing rejection (e.g. the Clipboard API being
 * unavailable or permission-denied) and reporting success/failure instead of
 * leaving an unhandled promise rejection.
 */
export async function safeCopyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

export function extractInviteCode(input: string): string {
    const trimmed = input.trim();
    const match = trimmed.match(/\/rooms\/join\/([A-Za-z0-9]+)/);
    return match ? match[1] : trimmed;
}
