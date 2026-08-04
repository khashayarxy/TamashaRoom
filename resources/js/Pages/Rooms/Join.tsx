import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { router } from "@inertiajs/react";
import { Users } from "lucide-react";
import AppLayout from "@/Layouts/AppLayout";

interface JoinRoomProps {
    room: { id: number; name: string; invite_code: string };
}

export default function JoinRoom({ room }: JoinRoomProps) {
    const confirmJoin = () => {
        router.post(route("rooms.join.submit", room.invite_code));
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
                </CardContent>
            </Card>
        </div>
    );
}

JoinRoom.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
