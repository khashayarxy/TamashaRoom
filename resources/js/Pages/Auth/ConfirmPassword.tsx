import { Input } from '@/Components/ui/input';
import { Button } from '@/Components/ui/button';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="تأیید رمز عبور" />

            <div className="mb-6 text-center">
                <p className="text-sm font-medium text-primary">به تماشاروم خوش آمدید</p>
                <h2 className="mt-1 text-xl font-bold">تأیید هویت</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    برای ادامه، لطفاً رمز عبور خود را وارد کنید
                </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
                <Input
                    label="رمز عبور"
                    id="password"
                    type="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="current-password"
                    autoFocus
                    required
                />

                <div className="flex justify-end pt-2">
                    <Button variant="primary" disabled={processing}>
                        تأیید
                    </Button>
                </div>
            </form>
        </GuestLayout>
    );
}
