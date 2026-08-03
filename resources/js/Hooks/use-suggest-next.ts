import api from "@/lib/api";
import { toast } from "@/Hooks/use-toast";
import { useCallback } from "react";

const SUGGEST_BODY = "پیشنهاد بعدی: بیایید ویدیوی بعدی را تماشا کنیم";

/**
 * "پیشنهاد بعدی" posts a suggestion through the existing chat mechanism
 * (ChatController::store). No new messaging system, no recommendations engine.
 */
export function useSuggestNext(roomId: number) {
    const suggestNext = useCallback(async () => {
        try {
            await api.post(`/chat/${roomId}/messages`, {
                body: SUGGEST_BODY,
            });
        } catch {
            toast.error("خطا در ارسال پیشنهاد");
        }
    }, [roomId]);

    return { suggestNext };
}
