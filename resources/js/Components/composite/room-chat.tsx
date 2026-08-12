import { ConfirmDialog } from "@/Components/composite/confirm-dialog";
import { EmojiPicker } from "@/Components/ui/emoji-picker";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";
import api from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { isPollingSuspended } from "@/lib/polling-controller";
import { chatMessagesSchema } from "@/lib/validation";
import { usePage } from "@inertiajs/react";
import {
    Smile,
    Send,
    Trash2,
    User,
    UserMinus,
    UserPlus,
    WifiOff,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PresenceMoment } from "@/lib/presence-moments";

interface Message {
    id: number;
    user_id: number;
    body: string;
    user: { id: number; name: string };
    created_at: string;
}

interface RoomChatProps {
    roomId: number;
    initialMessages: Message[];
    pollInterval?: number;
    onUnreadCountChange?: (count: number) => void;
    presenceMoments?: PresenceMoment[];
}

export function RoomChat({
    roomId,
    initialMessages,
    pollInterval = 3000,
    onUnreadCountChange,
    presenceMoments = [],
}: RoomChatProps) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [pollError, setPollError] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const isTabVisibleRef = useRef(!document.hidden);
    const lastSeenIdRef = useRef<number | null>(
        initialMessages.reduce((max, m) => Math.max(max, m.id), 0) || null,
    );
    const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);

    const insertEmoji = (emoji: string) => {
        setBody((prev) => {
            const el = document.activeElement;
            if (el instanceof HTMLInputElement && el.value === prev) {
                const start = el.selectionStart ?? prev.length;
                const end = el.selectionEnd ?? prev.length;
                return prev.slice(0, start) + emoji + prev.slice(end);
            }
            return prev + emoji;
        });
    };

    const markAllSeen = useCallback(() => {
        lastSeenIdRef.current =
            messages.reduce((max, m) => Math.max(max, m.id), 0) || null;
        setUnreadCount(0);
    }, [messages]);

    const scrollToBottom = () => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    };

    const fetchMessages = useCallback(async () => {
        if (isPollingSuspended()) return;
        try {
            const { data } = await api.get(`/chat/${roomId}/messages`);
            const incoming = chatMessagesSchema.parse(data);
            setPollError(false);
            setMessages((prev) => {
                if (!isTabVisibleRef.current) {
                    // Count only messages newer than the last one the user saw,
                    // so deletions or same-size updates can't skew the count.
                    const lastSeenId =
                        lastSeenIdRef.current ??
                        prev.reduce(
                            (max, m) => Math.max(max, m.id),
                            incoming.reduce((max, m) => Math.max(max, m.id), 0),
                        );
                    const unseen = incoming.filter(
                        (m) => m.id > lastSeenId,
                    ).length;
                    if (unseen > 0) {
                        setUnreadCount((c) => c + unseen);
                    }
                }
                return incoming;
            });
        } catch {
            setPollError(true);
        }
    }, [roomId]);

    useEffect(() => {
        const timer = setTimeout(scrollToBottom, 50);
        return () => clearTimeout(timer);
    }, [initialMessages]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden) {
                void fetchMessages();
            }
        }, pollInterval);
        return () => clearInterval(interval);
    }, [fetchMessages, pollInterval]);

    useEffect(() => {
        const handleVisibility = () => {
            isTabVisibleRef.current = !document.hidden;
            if (document.visibilityState === "visible") {
                markAllSeen();
                fetchMessages();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () =>
            document.removeEventListener("visibilitychange", handleVisibility);
    }, [fetchMessages, markAllSeen]);

    useEffect(() => {
        onUnreadCountChange?.(unreadCount);
    }, [unreadCount, onUnreadCountChange]);

    useEffect(() => {
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) تماشاروم`;
        } else {
            document.title = "تماشاروم";
        }
    }, [unreadCount]);

    const sendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!body.trim() || sending) return;

        setSending(true);
        try {
            const { data } = await api.post(`/chat/${roomId}/messages`, {
                body,
            });
            setMessages((prev) => [...prev, data]);
            if (
                lastSeenIdRef.current === null ||
                data.id > lastSeenIdRef.current
            ) {
                lastSeenIdRef.current = data.id;
            }
            setBody("");
            setTimeout(scrollToBottom, 50);
        } catch {
            toast.error("خطا در ارسال پیام");
        } finally {
            setSending(false);
        }
    };

    const deleteMessage = async (messageId: number) => {
        setDeleting(messageId);
        try {
            await api.delete(`/chat/${roomId}/messages/${messageId}`);
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
        } catch {
            toast.error("خطا در حذف پیام");
        } finally {
            setDeleting(null);
            setConfirmDelete(null);
        }
    };

    const isOwn = (userId: number) => userId === auth.user.id;

    const feed = [
        ...messages.map((msg) => ({
            kind: "message" as const,
            key: `m-${msg.id}`,
            at: new Date(msg.created_at).getTime(),
            msg,
        })),
        ...presenceMoments.map((moment) => ({
            kind: "moment" as const,
            key: moment.id,
            at: moment.at,
            moment,
        })),
    ].sort((a, b) => a.at - b.at);

    return (
        <div className="flex flex-col h-full">
            <div ref={listRef} className="flex-1 overflow-y-auto space-y-3 p-4">
                {pollError && (
                    <div role="status" className="flex justify-center py-1">
                        <span className="inline-flex items-center gap-1.5 text-xs text-destructive-text">
                            <WifiOff className="h-3.5 w-3.5" />
                            در حال اتصال مجدد...
                        </span>
                    </div>
                )}
                {feed.map((item) =>
                    item.kind === "moment" ? (
                        <div key={item.key} className="flex justify-center">
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                {item.moment.type === "join" ? (
                                    <UserPlus className="h-3.5 w-3.5" />
                                ) : (
                                    <UserMinus className="h-3.5 w-3.5" />
                                )}
                                {item.moment.type === "join"
                                    ? `${item.moment.name} به اتاق پیوست`
                                    : `${item.moment.name} از اتاق خارج شد`}
                            </span>
                        </div>
                    ) : (
                        <div
                            key={item.key}
                            className={`flex gap-2 group ${isOwn(item.msg.user_id) ? "flex-row-reverse" : ""}`}
                        >
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                            </div>
                            <div
                                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm relative ${
                                    isOwn(item.msg.user_id)
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-secondary-foreground"
                                }`}
                            >
                                <div className="font-medium text-xs mb-0.5">
                                    {item.msg.user.name}
                                </div>
                                <div>{item.msg.body}</div>
                                <div
                                    className={`text-[10px] mt-1 ${isOwn(item.msg.user_id) ? "text-primary-foreground" : "text-muted-foreground"}`}
                                >
                                    {timeAgo(item.msg.created_at)}
                                </div>
                                {isOwn(item.msg.user_id) && (
                                    <button
                                        onClick={() =>
                                            setConfirmDelete(item.msg.id)
                                        }
                                        disabled={deleting === item.msg.id}
                                        className="absolute -top-1.5 -end-1.5 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label="حذف پیام"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ),
                )}
            </div>

            <form
                onSubmit={sendMessage}
                className="border-t border-border p-3 flex gap-2"
            >
                <input
                    type="text"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="پیام خود را بنویسید..."
                    className="flex-1 h-9 rounded-xl border border-input bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={500}
                />
                <button
                    type="submit"
                    disabled={sending || !body.trim()}
                    className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                    aria-label="ارسال پیام"
                >
                    <Send className="h-4 w-4" />
                </button>

                <Popover
                    open={emojiPopoverOpen}
                    onOpenChange={setEmojiPopoverOpen}
                >
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="h-9 w-9 rounded-xl border border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
                            aria-label="افزودن شکلک"
                            aria-expanded={emojiPopoverOpen}
                            aria-haspopup="true"
                        >
                            <Smile className="h-4 w-4" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        side="top"
                        className="w-fit p-0 border-border"
                    >
                        <EmojiPicker
                            onEmojiSelect={(emoji) => {
                                insertEmoji(emoji);
                                setEmojiPopoverOpen(false);
                            }}
                        />
                    </PopoverContent>
                </Popover>
            </form>

            <ConfirmDialog
                open={confirmDelete !== null}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() =>
                    confirmDelete !== null && deleteMessage(confirmDelete)
                }
                title="حذف پیام"
                description="آیا از حذف این پیام اطمینان دارید؟ این عمل قابل بازگشت نیست."
                confirmLabel="حذف شود"
                confirmVariant="destructive"
                loading={deleting !== null}
            />
        </div>
    );
}
