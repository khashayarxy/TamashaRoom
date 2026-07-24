import PrimaryButton from '@/Components/PrimaryButton';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <GuestLayout>
            <Head title="تأیید ایمیل" />

            <div className="mb-4 text-sm text-muted-foreground">
                از ثبت‌نام شما متشکریم! قبل از شروع، لطفاً ایمیل خود را با
                کلیک روی لینکی که برایتان ارسال کردیم تأیید کنید. اگر ایمیلی
                دریافت نکردید، خوشحال می‌شویم دوباره برایتان ارسال کنیم.
            </div>

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-sm font-medium text-success">
                    لینک تأیید جدید به آدرس ایمیل شما ارسال شد.
                </div>
            )}

            <form onSubmit={submit}>
                <div className="mt-4 flex items-center justify-between">
                    <PrimaryButton disabled={processing}>
                        ارسال مجدد ایمیل تأیید
                    </PrimaryButton>

                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="rounded-md text-sm text-muted-foreground underline hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        خروج
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
