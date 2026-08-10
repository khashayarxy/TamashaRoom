import { Button } from "@/Components/ui/button";
import GuestLayout from "@/Layouts/GuestLayout";
import { Head, Link, useForm } from "@inertiajs/react";
import { FormEventHandler } from "react";

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route("verification.send"));
    };

    return (
        <GuestLayout>
            <Head title="تأیید ایمیل" />

            <div className="mb-6 text-center">
                <p className="text-sm font-medium text-primary dark:text-accent-foreground">
                    به تماشاروم خوش آمدید
                </p>
                <h2 className="mt-1 text-xl font-bold">تأیید ایمیل</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    قبل از شروع، لطفاً ایمیل خود را تأیید کنید
                </p>
            </div>

            <div className="mb-4 text-sm leading-relaxed text-muted-foreground">
                از ثبت‌نام شما متشکریم! لطفاً روی لینکی که برایتان ارسال کردیم
                کلیک کنید تا ایمیل خود را تأیید کنید. اگر ایمیلی دریافت نکردید،
                دوباره ارسال می‌کنیم.
            </div>

            {status === "verification-link-sent" && (
                <div className="mb-4 text-sm font-medium text-success">
                    لینک تأیید جدید به آدرس ایمیل شما ارسال شد.
                </div>
            )}

            <form onSubmit={submit}>
                <div className="flex items-center justify-between pt-2">
                    <Button variant="primary" disabled={processing}>
                        ارسال مجدد ایمیل تأیید
                    </Button>

                    <Link
                        href={route("logout")}
                        method="post"
                        as="button"
                        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                        خروج
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
