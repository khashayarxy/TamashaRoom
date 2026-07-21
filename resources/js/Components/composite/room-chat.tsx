import api from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { usePage } from '@inertiajs/react';
import { Send, User } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

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
}

export function RoomChat({ roomId, initialMessages, pollInterval = 3000 }: RoomChatProps) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        const timer = setTimeout(scrollToBottom, 50);
        return () => clearTimeout(timer);
    }, [initialMessages]);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const { data } = await api.get(`/chat/${roomId}/messages`);
                setMessages(data);
            } catch {
                // silently fail
            }
        }, pollInterval);

        return () => clearInterval(interval);
    }, [roomId, pollInterval]);

    const sendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!body.trim() || sending) return;

        setSending(true);
        try {
            const { data } = await api.post(`/chat/${roomId}/messages`, { body });
            setMessages((prev) => [...prev, data]);
            setBody('');
            setTimeout(scrollToBottom, 50);
        } catch {
            // silently fail
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div
                ref={listRef}
                className="flex-1 overflow-y-auto space-y-3 p-4"
            >
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-2 ${msg.user_id === auth.user.id ? 'flex-row-reverse' : ''}`}
                    >
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                        </div>
                        <div
                            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                                msg.user_id === auth.user.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground'
                            }`}
                        >
                            <div className="font-medium text-xs mb-0.5">{msg.user.name}</div>
                            <div>{msg.body}</div>
                            <div className="text-[10px] opacity-60 mt-1">
                                {timeAgo(msg.created_at)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={sendMessage} className="border-t border-border p-3 flex gap-2">
                <input
                    type="text"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="پیام خود را بنویسید..."
                    className="flex-1 h-9 rounded-xl border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
        </div>
    );
}
