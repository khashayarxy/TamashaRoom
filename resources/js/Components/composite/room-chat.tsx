import { ConfirmDialog } from "@/Components/composite/confirm-dialog";
import { EmojiPicker } from "@/Components/ui/emoji-picker";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";
import api from "@/lib/api";
import { getEcho, watchPushHealth } from "@/lib/echo";
import { timeAgo } from "@/lib/utils";
import { isPollingSuspended } from "@/lib/polling-controller";
import { chatMessagesSchema } from "@/lib/validation";
import { usePage } from "@inertiajs/react";
import {
    Smile,
    Send,
    Trash2,
    Flag,
    User,
    UserMinus,
    UserPlus,
    WifiOff,
} from "lucide-react";
import {
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import type { PresenceMoment } from "@/lib/presence-moments";

interface Message {
    id: number;
    user_id: number;
    body: string;
    user: { id: number; name: string };
    created_at: string;
}

/**
 * A message as rendered locally: server messages are plain `Message`s; the
 * sender's optimistic copy carries a negative local id and `pending` until
 * the POST response (or the live echo) delivers the persisted message.
 */
type ChatMessageView = Message & { pending?: boolean };

/**
 * While push is healthy the poll is only a safety net for missed events, so
 * it runs at this slow cadence. Without push (or while the transport is
 * unhealthy) the poll IS the transport and ticks at `pollInterval` (3s).
 */
const HEALTHY_POLL_INTERVAL = 20000;

interface RoomChatProps {
    roomId: number;
    initialMessages: Message[];
    pollInterval?: number;
    onUnreadCountChange?: (count: number) => void;
    presenceMoments?: PresenceMoment[];
    isOwner?: boolean;
}

export function RoomChat({
    roomId,
    initialMessages,
    pollInterval = 3000,
    onUnreadCountChange,
    presenceMoments = [],
    isOwner = false,
}: RoomChatProps) {
    const { auth } = usePage().props;
    const [messages, setMessages] =
        useState<ChatMessageView[]>(initialMessages);
    const [body, setBody] = useState("");
    const [deleting, setDeleting] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [tappedMsgId, setTappedMsgId] = useState<number | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [pollError, setPollError] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const isTabVisibleRef = useRef(!document.hidden);
    const lastSeenIdRef = useRef<number | null>(
        initialMessages.reduce((max, m) => Math.max(max, m.id), 0) || null,
    );
    const tempIdRef = useRef(0);
    const pushHealthyRef = useRef(false);
    const lastPollAtRef = useRef(0);
    const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
    const [reportTarget, setReportTarget] = useState<number | null>(null);
    const [reportReason, setReportReason] = useState("");
    const [reportDetails, setReportDetails] = useState("");
    const [reporting, setReporting] = useState(false);

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

    const scrollToBottom = useCallback(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, []);

    /**
     * Append one live-delivered message (Echo broadcast), deduplicated by id
     * — the poll and the sender's POST response can race this delivery.
     */
    const appendLiveMessage = useCallback(
        (incoming: Message) => {
            if (typeof incoming?.id !== "number") return;
            setMessages((prev) =>
                prev.some((m) => m.id === incoming.id)
                    ? prev
                    : [...prev, incoming],
            );
            if (
                !isTabVisibleRef.current &&
                (lastSeenIdRef.current === null ||
                    incoming.id > lastSeenIdRef.current)
            ) {
                setUnreadCount((c) => c + 1);
            }
            setTimeout(scrollToBottom, 50);
        },
        [scrollToBottom],
    );

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
                // The server list is authoritative; keep only the sender's
                // still-unacknowledged optimistic messages (negative ids) so
                // a poll mid-send cannot wipe them.
                const pendingOptimistic = prev.filter((m) => m.id < 0);
                return pendingOptimistic.length > 0
                    ? [...incoming, ...pendingOptimistic]
                    : incoming;
            });
        } catch {
            setPollError(true);
        }
    }, [roomId]);

    useEffect(() => {
        const echo = getEcho();

        if (!echo) return;

        // Same presence channel the sync/presence hooks join; the chat feed
        // rides `.chat.message.new` broadcasts (synchronous server-side) for
        // instant delivery.
        const channel = echo.join(`room.${roomId}`);
        channel.listen(".chat.message.new", (payload) => {
            appendLiveMessage(payload as Message);
        });

        // Push health drives the poll cadence: healthy push turns the poll
        // into a slow safety net; a dropped or never-connected socket (or no
        // Echo at all) keeps the fast poll as the transport.
        const stopHealthWatch = watchPushHealth(
            echo,
            `room.${roomId}`,
            (healthy) => {
                pushHealthyRef.current = healthy;
                if (healthy) {
                    void fetchMessages();
                }
            },
        );

        return () => {
            stopHealthWatch();
            channel.stopListening(".chat.message.new");
            echo.leave(`room.${roomId}`);
        };
    }, [roomId, appendLiveMessage, fetchMessages]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (document.hidden) return;
            if (
                pushHealthyRef.current &&
                Date.now() - lastPollAtRef.current < HEALTHY_POLL_INTERVAL
            ) {
                return;
            }
            lastPollAtRef.current = Date.now();
            void fetchMessages();
        }, pollInterval);
        return () => clearInterval(interval);
    }, [fetchMessages, pollInterval]);

    useEffect(() => {
        const timer = setTimeout(scrollToBottom, 50);
        return () => clearTimeout(timer);
    }, [initialMessages, scrollToBottom]);

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

    useEffect(() => {
        return () => {
            document.title = "تماشاروم";
        };
    }, []);

    const sendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!body.trim()) return;

        // Optimistic: render immediately with a negative local id and a
        // pending indicator; reconcile when the POST resolves (or the live
        // echo beats it), roll back on failure with the draft restored.
        // Sends are NOT serialized: each message gets its own in-flight POST
        // (anti-spam stays server-side via throttle:chat) — gating submit on
        // a shared "sending" flag made every message wait out the previous
        // POST's round-trip (which contains the synchronous Pusher
        // broadcast), so rapid chat felt seconds slow.
        const optimisticId = --tempIdRef.current;
        const optimistic: ChatMessageView = {
            id: optimisticId,
            user_id: auth.user.id,
            body: body.trim(),
            user: { id: auth.user.id, name: auth.user.name },
            created_at: new Date().toISOString(),
            pending: true,
        };
        setMessages((prev) => [...prev, optimistic]);
        setBody("");
        scrollToBottom();

        try {
            const { data } = await api.post(`/chat/${roomId}/messages`, {
                body: optimistic.body,
            });
            setMessages((prev) => {
                const withoutTemp = prev.filter((m) => m.id !== optimisticId);
                // The sender's other tab may have received the live echo
                // already; never render the same id twice.
                return withoutTemp.some((m) => m.id === data.id)
                    ? withoutTemp
                    : [...withoutTemp, data];
            });
            if (
                lastSeenIdRef.current === null ||
                data.id > lastSeenIdRef.current
            ) {
                lastSeenIdRef.current = data.id;
            }
            setTimeout(scrollToBottom, 50);
        } catch {
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            setBody((b) => (b ? b : optimistic.body));
            toast.error("خطا در ارسال پیام");
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

    const reportMessage = async () => {
        if (reportTarget === null) return;
        setReporting(true);
        try {
            await api.post(`/chat/${roomId}/messages/${reportTarget}/report`, {
                reason: reportReason || undefined,
                details: reportDetails || undefined,
            });
            toast.success("گزارش پیام ثبت شد.");
        } catch (err: unknown) {
            const msg =
                err instanceof Object &&
                "response" in err &&
                err.response instanceof Object &&
                "data" in err.response &&
                typeof err.response.data === "object" &&
                err.response.data !== null &&
                "message" in err.response.data
                    ? String((err.response.data as { message: string }).message)
                    : "خطا در گزارش پیام. دوباره تلاش کنید.";
            toast.error(msg);
        } finally {
            setReporting(false);
            setReportTarget(null);
            setReportReason("");
            setReportDetails("");
        }
    };

    const isOwn = (userId: number) => userId === auth.user.id;

    const canDelete = (msg: ChatMessageView) => isOwn(msg.user_id) || isOwner;

    const canReport = (msg: ChatMessageView) => !isOwn(msg.user_id) && !isOwner;

    const feed = useMemo(
        () =>
            [
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
            ].sort((a, b) => a.at - b.at),
        [messages, presenceMoments],
    );

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
                            onTouchStart={() =>
                                setTappedMsgId(
                                    tappedMsgId === item.msg.id
                                        ? null
                                        : item.msg.id,
                                )
                            }
                        >
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                            </div>
                            <div
                                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm relative ${
                                    isOwn(item.msg.user_id)
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-secondary-foreground"
                                } ${item.msg.pending ? "opacity-60" : ""}`}
                            >
                                <div className="font-medium text-xs mb-0.5">
                                    {item.msg.user.name}
                                </div>
                                {/* break-words: long unbroken runs (URLs,
                                    token pastes) have no natural break
                                    opportunities and would overflow the
                                    bubble on narrow mobile widths. */}
                                <div className="break-words">
                                    {item.msg.body}
                                </div>
                                <div
                                    className={`text-[10px] mt-1 flex items-center gap-1 ${isOwn(item.msg.user_id) ? "text-primary-foreground" : "text-muted-foreground"}`}
                                >
                                    {timeAgo(item.msg.created_at)}
                                    {item.msg.pending && (
                                        <span
                                            className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse"
                                            role="status"
                                            aria-label="در حال ارسال"
                                        />
                                    )}
                                </div>
                                {canDelete(item.msg) && (
                                    <button
                                        tabIndex={0}
                                        onClick={() =>
                                            setConfirmDelete(item.msg.id)
                                        }
                                        disabled={deleting === item.msg.id}
                                        className={`absolute -top-1.5 -end-1.5 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                                            tappedMsgId === item.msg.id
                                                ? "opacity-100"
                                                : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                                        }`}
                                        aria-label="حذف پیام"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                {canReport(item.msg) && (
                                    <button
                                        tabIndex={0}
                                        onClick={() =>
                                            setReportTarget(item.msg.id)
                                        }
                                        className={`absolute -top-1.5 -end-1.5 h-6 w-6 rounded-full bg-warning text-warning-foreground flex items-center justify-center transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                            tappedMsgId === item.msg.id
                                                ? "opacity-100"
                                                : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                                        }`}
                                        aria-label="گزارش پیام"
                                    >
                                        <Flag className="h-3.5 w-3.5" />
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
                    id="chat-message"
                    name="chat-message"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="پیام خود را بنویسید..."
                    aria-label="پیام خود را بنویسید..."
                    className="flex-1 h-9 rounded-xl border border-input bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={500}
                />
                <button
                    type="submit"
                    disabled={!body.trim()}
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

            <ConfirmDialog
                open={reportTarget !== null}
                onClose={() => {
                    setReportTarget(null);
                    setReportReason("");
                    setReportDetails("");
                }}
                onConfirm={reportMessage}
                title="گزارش پیام"
                description="دلیل گزارش این پیام را مشخص کنید (اختیاری)."
                confirmLabel="گزارش شود"
                confirmVariant="primary"
                loading={reporting}
            >
                <div className="space-y-3 mt-3">
                    <input
                        type="text"
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        placeholder="دلیل (مثلاً هرزنامه، نامناسب)"
                        maxLength={100}
                        className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label="دلیل گزارش"
                    />
                    <textarea
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        placeholder="توضیحات بیشتر (اختیاری)"
                        maxLength={1000}
                        rows={3}
                        className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        aria-label="توضیحات گزارش"
                    />
                </div>
            </ConfirmDialog>
        </div>
    );
}
