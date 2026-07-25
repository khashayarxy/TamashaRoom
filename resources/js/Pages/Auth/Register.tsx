import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import GuestLayout from "@/Layouts/GuestLayout";
import { Head, Link, useForm } from "@inertiajs/react";
import { FormEventHandler } from "react";

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route("register"), {
            onFinish: () => reset("password", "password_confirmation"),
        });
    };

    return (
        <GuestLayout>
            <Head title="ثبت‌نام" />

            <div className="mb-6 text-center">
                <p className="text-sm font-medium text-primary">
                    به تماشاروم خوش آمدید
                </p>
                <h2 className="mt-1 text-xl font-bold">ایجاد حساب</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    با دوستانتان فیلم ببینید، حتی اگه دورید
                </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
                <Input
                    label="نام"
                    id="name"
                    value={data.name}
                    onChange={(e) => setData("name", e.target.value)}
                    error={errors.name}
                    autoComplete="name"
                    autoFocus
                    required
                />

                <Input
                    label="ایمیل"
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData("email", e.target.value)}
                    error={errors.email}
                    autoComplete="username"
                    required
                />

                <Input
                    label="رمز عبور"
                    id="password"
                    type="password"
                    value={data.password}
                    onChange={(e) => setData("password", e.target.value)}
                    error={errors.password}
                    autoComplete="new-password"
                    required
                />

                <Input
                    label="تکرار رمز عبور"
                    id="password_confirmation"
                    type="password"
                    value={data.password_confirmation}
                    onChange={(e) =>
                        setData("password_confirmation", e.target.value)
                    }
                    error={errors.password_confirmation}
                    autoComplete="new-password"
                    required
                />

                <div className="flex items-center justify-between pt-2">
                    <Link
                        href={route("login")}
                        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                        قبلاً ثبت‌نام کرده‌اید؟
                    </Link>
                    <Button type="submit" variant="primary" disabled={processing}>
                        ثبت‌نام
                    </Button>
                </div>
            </form>
        </GuestLayout>
    );
}
