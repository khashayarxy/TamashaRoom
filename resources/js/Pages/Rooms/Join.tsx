import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { router, useForm, usePage } from "@inertiajs/react";
import { LogIn, Users } from "lucide-react";
import { PropsWithChildren } from "react";
import AppLayout from "@/Layouts/AppLayout";
import GuestLayout from "@/Layouts/GuestLayout";
import { Input } from "@/Components/ui/input";
import InputLabel from "@/Components/InputLabel";
import type { PageProps } from "@/types";

type JoinPageProps = PageProps<{
    room: { id: number; name: string; invite_code: string };
}>;

interface JoinRoomProps {
    room: { id: number; name: string; invite_code: string };
}

function useProps() {
    return usePage<JoinPageProps>().props;
}

function JoinShell({ children }: PropsWithChildren) {
    const { auth } = useProps();

    if (auth.user) {
        return <AppLayout>{children}</AppLayout>;
    }

    return <GuestLayout>{children}</GuestLayout>;
}

export default function JoinRoom({ room }: JoinRoomProps) {
    const { auth } = useProps();
    const isGuest = !auth.user;

    const { data, setData, post, processing, errors } = useForm({
        guest_name: "",
    });

    const confirmJoin = () => {
        router.post(route("rooms.join.submit", room.invite_code));
    };

    const submitGuest = (e: React.FormEvent) => {
        e.preventDefault();
        post(route("rooms.join.submit", room.invite_code));
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
            <Card className="w-full max-w-md">
                <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <h1 className="text-lg font-bold">پیوستن به اتاق</h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        آیا می‌خواهید به اتاق{" "}
                        <span className="font-medium text-foreground">
                            {room.name}
                        </span>{" "}
                        بپیوندید؟
                    </p>

                    {isGuest ? (
                        <form onSubmit={submitGuest} className="space-y-4">
                            <div className="space-y-2">
                                <InputLabel htmlFor="guest_name">
                                    نام نمایشی شما
                                </InputLabel>
                                <Input
                                    id="guest_name"
                                    value={data.guest_name}
                                    onChange={(e) =>
                                        setData("guest_name", e.target.value)
                                    }
                                    placeholder="مثال: آرش"
                                    aria-invalid={Boolean(errors.guest_name)}
                                    aria-describedby={
                                        errors.guest_name
                                            ? "guest_name_error"
                                            : undefined
                                    }
                                />
                                {errors.guest_name && (
                                    <p
                                        id="guest_name_error"
                                        className="text-sm text-destructive-text"
                                    >
                                        {errors.guest_name}
                                    </p>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                برای مشاهده و گفتگو در اتاق نیازی به ثبت‌نام
                                ندارید؛ کافی است نامی وارد کنید.
                            </p>
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={processing}
                            >
                                <LogIn className="h-4 w-4" />
                                پیوستن به اتاق
                            </Button>
                        </form>
                    ) : (
                        <div className="flex gap-2 pt-2">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => router.visit(route("dashboard"))}
                            >
                                انصراف
                            </Button>
                            <Button className="flex-1" onClick={confirmJoin}>
                                پیوستن به اتاق
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

JoinRoom.layout = (page: React.ReactNode) => <JoinShell>{page}</JoinShell>;
