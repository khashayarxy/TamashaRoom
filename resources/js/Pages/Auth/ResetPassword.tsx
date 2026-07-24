import { Input } from '@/Components/ui/input';
import { Button } from '@/Components/ui/button';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ResetPassword({
    token,
    email,
}: {
    token: string;
    email: string;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title="بازنشانی رمز عبور" />

            <div className="mb-6 text-center">
                <p className="text-sm font-medium text-primary">به تماشاروم خوش آمدید</p>
                <h2 className="mt-1 text-xl font-bold">رمز عبور جدید</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    رمز عبور جدید خود را وارد کنید
                </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
                <Input
                    label="ایمیل"
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    autoComplete="username"
                    required
                />

                <Input
                    label="رمز عبور جدید"
                    id="password"
                    type="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="new-password"
                    autoFocus
                    required
                />

                <Input
                    label="تکرار رمز عبور جدید"
                    id="password_confirmation"
                    type="password"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={errors.password_confirmation}
                    autoComplete="new-password"
                    required
                />

                <div className="flex justify-end pt-2">
                    <Button variant="primary" disabled={processing}>
                        بازنشانی رمز عبور
                    </Button>
                </div>
            </form>
        </GuestLayout>
    );
}
