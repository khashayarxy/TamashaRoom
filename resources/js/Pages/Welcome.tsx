import { Head, Link } from "@inertiajs/react";
import { Moon, Play, Sun, Tv } from "lucide-react";

import { buttonVariants } from "@/Components/ui/button";
import { toPersianDigits } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme";

import type { PageProps } from "@/types";

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

                    <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-24 pt-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:pb-32 lg:pt-16">
                        <div className="max-w-2xl">
                            <span className="inline-flex items-center gap-2 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-background dark:text-card-foreground">
                                <span
                                    aria-hidden="true"
                                    className="h-1.5 w-1.5 rounded-full bg-success"
                                />
                                پخش زنده با دوستات
                            </span>
                            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-background sm:text-5xl dark:text-card-foreground lg:text-6xl">
                                با هم، همون لحظه
                            </h1>
                            <span
                                aria-hidden="true"
                                className="mt-5 block h-0.5 w-16 rounded-full bg-primary"
                            />
                            <p className="mt-5 max-w-md text-lg leading-relaxed text-background/70 dark:text-card-foreground/70">
                                یک اتاق بساز، لینک رو بفرست؛ پخش و مکث برای همه
                                یکی میشه.
                            </p>
                            <div className="mt-8 flex flex-wrap items-center gap-4">
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
                                        className="text-sm font-medium text-background/70 underline-offset-4 transition-colors hover:text-background hover:underline dark:text-card-foreground/70 dark:hover:text-card-foreground"
                                    >
                                        ورود
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div
                            aria-hidden="true"
                            className="relative mx-auto w-full max-w-md lg:mx-0"
                        >
                            <div className="rounded-xl border border-primary/60 p-3">
                                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black/40">
                                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                                        <Play
                                            className="h-6 w-6"
                                            fill="currentColor"
                                        />
                                    </span>
                                    <span className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-background dark:text-card-foreground">
                                        <span
                                            aria-hidden="true"
                                            className="h-1.5 w-1.5 rounded-full bg-success"
                                        />
                                        {toPersianDigits("3 نفر آنلاین")}
                                    </span>
                                </div>
                                <div className="mt-3 px-1">
                                    <div className="relative h-1.5 overflow-hidden rounded-full bg-black/40">
                                        <span className="absolute start-0 top-0 h-full w-[35%] rounded-full bg-destructive" />
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs text-background/80 dark:text-card-foreground/80">
                                        <span dir="ltr">
                                            {toPersianDigits("04:12")}
                                        </span>
                                        <span dir="ltr">
                                            {toPersianDigits("01:24:00")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute -bottom-5 end-3 flex items-center gap-2 rounded-xl border border-destructive bg-black/30 px-3 py-2 dark:bg-white/10">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                                    س
                                </span>
                                <span className="text-xs font-semibold text-background dark:text-card-foreground">
                                    واااای اینجاشو دیدی؟!
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="border-t border-border">
                    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-24">
                        <div className="max-w-xl">
                            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
                                امشب می‌بینیم؟
                            </h2>
                            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
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
                        </div>
                    </div>
                </section>

                <footer className="py-8 text-center text-sm text-muted-foreground">
                    تماشاروم &copy; {new Date().getFullYear()}
                </footer>
            </div>
        </>
    );
}
