import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import GuestLayout from "@/Layouts/GuestLayout";
import { Head, useForm } from "@inertiajs/react";
import { FormEventHandler } from "react";

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({
        email: "",
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route("password.email"));
    };

    return (
        <GuestLayout>
            <Head title="فراموشی رمز عبور" />

            <div className="mb-6 text-center">
                <p className="text-sm font-medium text-primary dark:text-accent-foreground">
                    به تماشاروم خوش آمدید
                </p>
                <h2 className="mt-1 text-xl font-bold">بازیابی رمز عبور</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    ایمیل خود را وارد کنید تا لینک بازنشانی برای شما ارسال شود
                </p>
            </div>

            {status && (
                <div className="mb-4 text-sm font-medium text-success">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-4">
                <Input
                    label="ایمیل"
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData("email", e.target.value)}
                    error={errors.email}
                    autoComplete="email"
                    autoFocus
                    required
                />

                <div className="flex justify-end pt-2">
                    <Button variant="primary" disabled={processing}>
                        ارسال لینک بازنشانی
                    </Button>
                </div>
            </form>
        </GuestLayout>
    );
}
