import { buttonVariants } from "@/Components/ui/button";
import { PageProps } from "@/types";
import { Head, Link } from "@inertiajs/react";
import { Copy, Moon, Play, Sun, Tv, User } from "lucide-react";
import { useThemeStore } from "@/stores/theme";

export default function Welcome({ auth }: PageProps) {
    const { dark, toggle } = useThemeStore();

    const primaryCta = auth.user
        ? {
              href: route("dashboard"),
              label: "ورود به داشبورد",
          }
        : {
              href: route("register"),
              label: "شروع کنید — رایگان",
          };

    return (
        <>
            <Head title="تماشاروم – با هم ببینید" />

            <button
                onClick={toggle}
                className="fixed end-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={dark ? "حالت روشن" : "حالت تاریک"}
            >
                {dark ? (
                    <Sun className="h-5 w-5 text-primary" />
                ) : (
                    <Moon className="h-5 w-5 text-primary" />
                )}
            </button>

            <div className="min-h-screen bg-background">
                <section className="relative overflow-hidden bg-foreground text-background dark:bg-card dark:text-card-foreground">
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
                                            className:
                                                "text-background hover:text-background dark:text-card-foreground dark:hover:text-card-foreground",
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

                    <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-28 lg:pt-16">
                        <div>
                            <span className="inline-block rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-background dark:text-card-foreground">
                                تماشای هم‌زمان با دوستان
                            </span>
                            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-background sm:text-5xl dark:text-card-foreground lg:text-6xl">
                                با هم ببینیم،
                                <br />
                                حتی اگه دورید
                            </h1>
                            <p className="mt-6 max-w-lg text-lg leading-relaxed text-background/70 dark:text-card-foreground/70">
                                تماشاروم اتاق‌های خصوصی برای تماشای هم‌زمان فیلم
                                و ویدیو با دوستان و خانواده است. بساز، دعوت کن،
                                لذت ببر.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-4">
                                <Link
                                    href={primaryCta.href}
                                    className={buttonVariants({
                                        variant: "primary",
                                        size: "lg",
                                    })}
                                >
                                    <Tv className="h-5 w-5" />
                                    {primaryCta.label}
                                </Link>
                                {!auth.user && (
                                    <Link
                                        href={route("login")}
                                        className={buttonVariants({
                                            variant: "outline",
                                            size: "lg",
                                        })}
                                    >
                                        ورود
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="relative lg:ps-4" aria-hidden="true">
                            <div className="rounded-3xl border border-background/10 bg-card p-3 shadow-lg dark:border-card-foreground/10">
                                <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-foreground via-foreground to-black dark:from-black dark:via-foreground/80 dark:to-black">
                                    <div className="absolute end-4 top-4 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                                        هم‌زمان
                                    </div>

                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg ring-1 ring-primary/40">
                                            <Play className="h-7 w-7 translate-x-px" />
                                        </div>
                                    </div>

                                    <div className="absolute bottom-4 start-4 flex items-center gap-3">
                                        <div className="flex -space-x-2 space-x-reverse">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/25 ring-2 ring-primary/40">
                                                <User className="h-4 w-4 text-background dark:text-card-foreground" />
                                            </span>
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/25 ring-2 ring-primary/40">
                                                <User className="h-4 w-4 text-background dark:text-card-foreground" />
                                            </span>
                                        </div>
                                        <span className="text-xs font-medium text-background/80 dark:text-card-foreground/80">
                                            ۲ دوست آنلاین
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute -top-6 -end-6 hidden rounded-2xl bg-primary p-3 shadow-lg sm:block">
                                <div className="flex items-center gap-2 text-primary-foreground">
                                    <Copy className="h-4 w-4" />
                                    <span className="text-sm font-semibold">
                                        کد دعوت
                                    </span>
                                    <span
                                        dir="ltr"
                                        className="rounded-md bg-black/20 px-2 py-0.5 font-mono text-xs"
                                    >
                                        TR-7K2M
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        className="absolute -bottom-16 -start-16 h-64 w-64 rounded-3xl bg-primary/10 blur-3xl"
                        aria-hidden="true"
                    />
                </section>

                <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
                    <div className="max-w-2xl">
                        <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            چگونه کار می‌کند
                        </span>
                        <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                            سه قدم تا تماشای مشترک
                        </h2>
                    </div>

                    <ol className="relative mt-14 grid gap-10 lg:grid-cols-3 lg:gap-8">
                        <div
                            className="absolute start-0 end-0 top-6 hidden border-t border-dashed border-border lg:block"
                            aria-hidden="true"
                        />
                        <li className="relative flex gap-4 lg:block">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-xl font-bold text-primary dark:text-accent-foreground">
                                ۱
                            </span>
                            <div className="lg:mt-6">
                                <h3 className="text-xl font-bold">
                                    یک اتاق بساز
                                </h3>
                                <p className="mt-2 max-w-xs leading-relaxed text-muted-foreground">
                                    فقط یک نام کافی است؛ اتاق شما در چند ثانیه
                                    آماده می‌شود.
                                </p>
                            </div>
                        </li>
                        <li className="relative flex gap-4 lg:block">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-xl font-bold text-primary dark:text-accent-foreground">
                                ۲
                            </span>
                            <div className="lg:mt-6">
                                <h3 className="text-xl font-bold">
                                    دعوت را بفرست
                                </h3>
                                <p className="mt-2 max-w-xs leading-relaxed text-muted-foreground">
                                    کد دعوت را برای دوستانت بفرست؛ آنها با یک
                                    لینک وارد می‌شوند.
                                </p>
                            </div>
                        </li>
                        <li className="relative flex gap-4 lg:block">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-xl font-bold text-primary dark:text-accent-foreground">
                                ۳
                            </span>
                            <div className="lg:mt-6">
                                <h3 className="text-xl font-bold">
                                    با هم ببینید
                                </h3>
                                <p className="mt-2 max-w-xs leading-relaxed text-muted-foreground">
                                    پخش، مکث و زمان ویدیو برای همه هماهنگ است؛
                                    همراه چت لحظه‌ای و زیرنویس.
                                </p>
                            </div>
                        </li>
                    </ol>
                </section>

                <section className="relative overflow-hidden bg-foreground text-background dark:bg-card dark:text-card-foreground">
                    <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-24">
                        <div className="max-w-xl">
                            <h2 className="text-3xl font-bold leading-tight text-background sm:text-4xl dark:text-card-foreground">
                                امشب می‌بینیم؟
                            </h2>
                            <p className="mt-4 text-lg leading-relaxed text-background/70 dark:text-card-foreground/70">
                                یک اتاق بساز، دوستانت را دعوت کن و با هم فیلم
                                ببینید. رایگان است.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-4">
                            <Link
                                href={primaryCta.href}
                                className={buttonVariants({
                                    variant: "primary",
                                    size: "lg",
                                })}
                            >
                                {auth.user ? "رفتن به داشبورد" : "شروع کنید"}
                            </Link>
                            {!auth.user && (
                                <Link
                                    href={route("login")}
                                    className={buttonVariants({
                                        variant: "outline",
                                        size: "lg",
                                    })}
                                >
                                    ورود
                                </Link>
                            )}
                        </div>
                    </div>
                    <div
                        className="absolute -bottom-16 -end-16 h-64 w-64 rounded-3xl bg-primary/15 blur-3xl"
                        aria-hidden="true"
                    />
                </section>

                <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                    تماشاروم &copy; {new Date().getFullYear()}
                </footer>
            </div>
        </>
    );
}
