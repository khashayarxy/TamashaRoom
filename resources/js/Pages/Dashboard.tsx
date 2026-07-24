import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import AppLayout from '@/Layouts/AppLayout';
import { copyToClipboard, timeAgo } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { Copy, Link2, Plus, Trash2, Tv, Users } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface Room {
    id: number;
    name: string;
    invite_code: string;
    owner: { id: number; name: string };
    members_count: number;
    max_members: number;
    is_playing: boolean;
    last_activity_at: string | null;
    user_id: number;
}

interface DashboardProps {
    rooms: Room[];
}

export default function Dashboard({ rooms }: DashboardProps) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [creating, setCreating] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const createRoom = async (e: FormEvent) => {
        e.preventDefault();
        if (!roomName.trim() || creating) return;
        setCreating(true);
        setErrors({});
        router.post(
            route('rooms.store'),
            { name: roomName },
            {
                onSuccess: () => {
                    setRoomName('');
                    setShowCreateForm(false);
                    setCreating(false);
                },
                onError: (errs) => {
                    setErrors(errs as Record<string, string>);
                    setCreating(false);
                },
            }
        );
    };

    const joinRoom = (e: FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        router.get(route('rooms.join', joinCode.trim()));
    };

    const deleteRoom = (room: Room) => {
        if (confirm(`آیا از حذف "${room.name}" مطمئن هستید؟`)) {
            router.delete(route('rooms.destroy', room.id));
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">اتاق‌های من</h1>
                <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                    <Plus className="h-4 w-4" />
                    اتاق جدید
                </Button>
            </div>

            {showCreateForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>ساخت اتاق جدید</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={createRoom} className="flex gap-3">
                            <div className="flex-1">
                                <Input
                                    placeholder="نام اتاق"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    maxLength={255}
                                />
                                {errors.name && (
                                    <p className="text-sm text-destructive mt-1">{errors.name}</p>
                                )}
                            </div>
                            <Button type="submit" disabled={creating}>
                                {creating ? 'در حال ساخت...' : 'ساخت اتاق'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>پیوستن به اتاق</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={joinRoom} className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                placeholder="کد دعوت را وارد کنید"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                            />
                        </div>
                        <Button type="submit" variant="secondary">
                            <Link2 className="h-4 w-4" />
                            پیوستن
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {rooms.length === 0 ? (
                <div className="text-center py-16">
                    <Tv className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
                    <h2 className="text-xl font-semibold mb-2">هنوز اتاقی ندارید</h2>
                    <p className="text-muted-foreground mb-6">
                        یک اتاق بسازید یا با کد دعوت به اتاق دوستان خود بپیوندید
                    </p>
                    <Button onClick={() => setShowCreateForm(true)}>
                        <Plus className="h-4 w-4" />
                        اولین اتاق را بسازید
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((room) => (
                        <Link key={room.id} href={route('rooms.show', room.id)}>
                            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-base">{room.name}</CardTitle>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Users className="h-3.5 w-3.5" />
                                            {room.members_count}/{room.max_members}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <span>ساخته شده توسط {room.owner.name}</span>
                                        </div>
                                        {room.last_activity_at && (
                                            <div>آخرین فعالیت: {timeAgo(room.last_activity_at)}</div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="bg-secondary px-2 py-0.5 rounded-full">
                                                {room.is_playing ? 'در حال پخش' : 'متوقف'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mt-4">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                copyToClipboard(room.invite_code);
                                            }}
                                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                                        >
                                            <Copy className="h-3 w-3" />
                                            کپی کد دعوت
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                deleteRoom(room);
                                            }}
                                            className="flex items-center gap-1 text-xs text-destructive hover:underline ms-auto p-1"
                                            aria-label="حذف اتاق"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

Dashboard.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
