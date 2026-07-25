import api from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { usePage } from "@inertiajs/react";
import { Send, Trash2, User } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/Components/composite/confirm-dialog";

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
}

export function RoomChat({
    roomId,
    initialMessages,
    pollInterval = 3000,
    onUnreadCountChange,
}: RoomChatProps) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(initialMessages.length);
    const isTabVisibleRef = useRef(!document.hidden);

    const scrollToBottom = () => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    };

    const fetchMessages = useCallback(async () => {
        try {
            const { data } = await api.get(`/chat/${roomId}/messages`);
            setMessages((prev) => {
                const incoming = data as Message[];
                if (!isTabVisibleRef.current && incoming.length > prev.length) {
                    setUnreadCount((c) => c + incoming.length - prev.length);
                }
                return incoming;
            });
        } catch {
            // silently fail
        }
    }, [roomId]);

    useEffect(() => {
        const timer = setTimeout(scrollToBottom, 50);
        return () => clearTimeout(timer);
    }, [initialMessages]);

    useEffect(() => {
        const interval = setInterval(fetchMessages, pollInterval);
        return () => clearInterval(interval);
    }, [fetchMessages, pollInterval]);

    useEffect(() => {
        const handleVisibility = () => {
            isTabVisibleRef.current = !document.hidden;
            if (document.visibilityState === "visible") {
                setUnreadCount(0);
                fetchMessages();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () =>
            document.removeEventListener("visibilitychange", handleVisibility);
    }, [fetchMessages]);

    useEffect(() => {
        prevCountRef.current = messages.length;
    }, [messages]);

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
            setBody("");
            setTimeout(scrollToBottom, 50);
        } catch {
            // silently fail
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
            // silently fail — the polling will correct the list
        } finally {
            setDeleting(null);
            setConfirmDelete(null);
        }
    };

    const isOwn = (userId: number) => userId === auth.user.id;

    return (
        <div className="flex flex-col h-full">
            <div ref={listRef} className="flex-1 overflow-y-auto space-y-3 p-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-2 group ${isOwn(msg.user_id) ? "flex-row-reverse" : ""}`}
                    >
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                        </div>
                        <div
                            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm relative ${
                                isOwn(msg.user_id)
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-secondary-foreground"
                            }`}
                        >
                            <div className="font-medium text-xs mb-0.5">
                                {msg.user.name}
                            </div>
                            <div>{msg.body}</div>
                            <div className={`text-[10px] mt-1 ${isOwn(msg.user_id) ? "text-primary-foreground/80" : "text-secondary-foreground/80"}`}>
                                {timeAgo(msg.created_at)}
                            </div>
                            {isOwn(msg.user_id) && (
                                <button
                                    onClick={() => setConfirmDelete(msg.id)}
                                    disabled={deleting === msg.id}
                                    className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                    aria-label="حذف پیام"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
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
