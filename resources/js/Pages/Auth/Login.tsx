import Checkbox from "@/Components/Checkbox";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import GuestLayout from "@/Layouts/GuestLayout";
import { Head, Link, useForm } from "@inertiajs/react";
import { FormEventHandler } from "react";

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: "",
        password: "",
        remember: false as boolean,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route("login"), {
            onFinish: () => reset("password"),
        });
    };

    return (
        <GuestLayout>
            <Head title="ورود" />

            <div className="mb-6 text-center">
                <p className="text-sm font-medium text-primary">
                    به تماشاروم خوش آمدید
                </p>
                <h2 className="mt-1 text-xl font-bold">ورود به حساب</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    با دوستانتان فیلم ببینید، حتی اگه دورید
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
                    autoComplete="username"
                    autoFocus
                    required
                />

                <Input
                    label="رمز عبور"
                    id="password"
                    type="password"
                    value={data.password}
                    onChange={(e) => setData("password", e.target.value)}
                    error={errors.password}
                    autoComplete="current-password"
                    required
                />

                <label className="flex items-center gap-2">
                    <Checkbox
                        name="remember"
                        checked={data.remember}
                        onChange={(e) =>
                            setData(
                                "remember",
                                (e.target.checked || false) as false,
                            )
                        }
                    />
                    <span className="text-sm text-muted-foreground">
                        مرا به خاطر بسپار
                    </span>
                </label>

                <div className="flex items-center justify-between pt-2">
                    {canResetPassword && (
                        <Link
                            href={route("password.request")}
                            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                            رمز عبور را فراموش کرده‌اید؟
                        </Link>
                    )}
                    <Button variant="primary" disabled={processing}>
                        ورود
                    </Button>
                </div>
            </form>
        </GuestLayout>
    );
}
