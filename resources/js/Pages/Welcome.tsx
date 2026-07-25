import { buttonVariants } from "@/Components/ui/button";
import { PageProps } from "@/types";
import { Head, Link } from "@inertiajs/react";
import { Tv, Copy, Users, MessageSquare, Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/stores/theme";

export default function Welcome({ auth }: PageProps) {
    const { dark, toggle } = useThemeStore();

    return (
        <>
            <Head title="تماشاروم – با هم ببینید" />

            <button
                onClick={toggle}
                className="fixed end-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label={dark ? "حالت روشن" : "حالت تاریک"}
            >
                {dark ? (
                    <Sun className="h-5 w-5 text-primary" />
                ) : (
                    <Moon className="h-5 w-5 text-primary" />
                )}
            </button>

            <div className="min-h-screen bg-background">
                <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2 text-xl font-bold">
                        <Tv className="h-6 w-6 text-primary" />
                        <span>تماشاروم</span>
                    </div>
                    <nav className="flex items-center gap-3">
                        {auth.user ? (
                            <Link
                                href={route("dashboard")}
                                className={buttonVariants({
                                    variant: "primary",
                                    size: "sm",
                                })}
                            >
                                داشبورد
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route("login")}
                                    className={buttonVariants({
                                        variant: "ghost",
                                        size: "sm",
                                    })}
                                >
                                    ورود
                                </Link>
                                <Link
                                    href={route("register")}
                                    className={buttonVariants({
                                        variant: "primary",
                                        size: "sm",
                                    })}
                                >
                                    ثبت‌نام
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
                    <div className="grid items-center gap-12 lg:grid-cols-5">
                        <div className="lg:col-span-3 lg:pe-12">
                            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                                با هم ببینید،
                                <br />
                                حتی اگه دورید
                            </h1>
                            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                                تماشاروم اتاق‌های خصوصی برای تماشای هم‌زمان فیلم
                                و ویدیو با دوستان و خانواده. بساز، دعوت کن، لذت
                                ببر.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-4">
                                {auth.user ? (
                                    <Link
                                        href={route("dashboard")}
                                        className={buttonVariants({
                                            variant: "primary",
                                            size: "lg",
                                        })}
                                    >
                                        <Tv className="h-5 w-5" />
                                        ورود به داشبورد
                                    </Link>
                                ) : (
                                    <>
                                        <Link
                                            href={route("register")}
                                            className={buttonVariants({
                                                variant: "primary",
                                                size: "lg",
                                            })}
                                        >
                                            شروع کنید
                                        </Link>
                                        <Link
                                            href={route("login")}
                                            className={buttonVariants({
                                                variant: "outline",
                                                size: "lg",
                                            })}
                                        >
                                            ورود
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="relative hidden lg:col-span-2 lg:block">
                            <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 p-8">
                                <div className="flex h-full w-full items-center justify-center rounded-2xl border border-primary/10 bg-background/50 backdrop-blur-sm">
                                    <Tv
                                        className="h-24 w-24 text-primary/40"
                                        strokeWidth={1}
                                    />
                                </div>
                            </div>
                            <div className="absolute -end-4 -top-4 h-32 w-32 rounded-full bg-primary/10 blur-xl" />
                            <div className="absolute -bottom-6 -start-6 h-40 w-40 rounded-full bg-primary/5 blur-2xl" />
                        </div>
                    </div>
                </section>

                <section className="border-t border-border bg-card py-20">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                        <div className="mb-16 max-w-2xl">
                            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                چگونه کار می‌کند
                            </span>
                            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                                تماشای هم‌زمان،
                                <br />
                                به سادگی یک دعوت
                            </h2>
                        </div>

                        <div className="grid items-center gap-8 lg:grid-cols-2">
                            <div className="order-last lg:order-first">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                                    <Copy className="h-7 w-7 text-primary" />
                                </div>
                                <h3 className="mt-4 text-2xl font-bold">
                                    یک اتاق بسازید
                                </h3>
                                <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
                                    در چند ثانیه یک اتاق خصوصی بسازید. کد دعوت
                                    را با دوستان خود به اشتراک بگذارید — نیازی
                                    به ثبت‌نام پیچیده نیست.
                                </p>
                            </div>
                            <div className="relative">
                                <div className="aspect-[4/3] rounded-2xl border border-primary/10 bg-gradient-to-tr from-primary/15 to-primary/5" />
                                <div className="absolute -end-3 -top-3 h-24 w-24 rounded-xl bg-primary/20 backdrop-blur" />
                            </div>
                        </div>

                        <div className="mt-20 grid items-center gap-8 lg:grid-cols-2">
                            <div className="relative">
                                <div className="aspect-[4/3] rounded-2xl border border-primary/10 bg-gradient-to-tl from-primary/15 to-primary/5" />
                                <div className="absolute -bottom-3 -start-3 h-24 w-24 rounded-xl bg-primary/20 backdrop-blur" />
                            </div>
                            <div className="lg:ps-12">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                                    <Users className="h-7 w-7 text-primary" />
                                </div>
                                <h3 className="mt-4 text-2xl font-bold">
                                    دعوت کنید و جمع شوید
                                </h3>
                                <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
                                    دوستانتان با کد دعوت به اتاق شما می‌پیوندند.
                                    کافی است لینک را بفرستید — آنها بلافاصله
                                    وارد می‌شوند.
                                </p>
                            </div>
                        </div>

                        <div className="mt-20 rounded-2xl border border-primary/10 bg-primary/[0.03] p-8 lg:p-12">
                            <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                                        <MessageSquare className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">
                                            چت و زیرنویس هم‌زمان
                                        </h3>
                                        <p className="mt-1 text-muted-foreground">
                                            پخش، مکث، و زمان ویدیو برای همه
                                            هماهنگ است. همراه با چت لحظه‌ای و
                                            زیرنویس.
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href={
                                        auth.user
                                            ? route("dashboard")
                                            : route("register")
                                    }
                                    className={buttonVariants({
                                        variant: "primary",
                                    })}
                                >
                                    {auth.user
                                        ? "رفتن به داشبورد"
                                        : "همین حالا شروع کنید"}
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="relative overflow-hidden py-24">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent" />
                    <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                        <div className="lg:w-3/5">
                            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
                                آماده‌ای با هم ببینیم؟
                            </h2>
                            <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
                                همین حالا یک اتاق بساز و دوستانت رو دعوت کن.
                                تماشای هم‌زمان، به سادگی یک کلیک.
                            </p>
                            <div className="mt-8">
                                {auth.user ? (
                                    <Link
                                        href={route("dashboard")}
                                        className={buttonVariants({
                                            variant: "primary",
                                            size: "lg",
                                        })}
                                    >
                                        <Tv className="h-5 w-5" />
                                        برو به داشبورد
                                    </Link>
                                ) : (
                                    <Link
                                        href={route("register")}
                                        className={buttonVariants({
                                            variant: "primary",
                                            size: "lg",
                                        })}
                                    >
                                        شروع کنید – رایگان
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="absolute -bottom-12 -end-12 h-64 w-64 rounded-3xl bg-primary/5 blur-2xl" />
                    <div className="absolute -start-12 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-primary/[0.03] blur-xl" />
                </section>

                <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                    تماشاروم &copy; {new Date().getFullYear()}
                </footer>
            </div>
        </>
    );
}
