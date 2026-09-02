import { Head, Link } from "@inertiajs/react";
import {
    Captions,
    MessageCircle,
    Moon,
    Play,
    PlusCircle,
    Share2,
    Sun,
    Tv,
    Users,
} from "lucide-react";

import { PageErrorFallback } from "@/Components/composite/page-error-fallback";
import { buttonVariants } from "@/Components/ui/button";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { Container } from "@/Components/ui/container";
import { ErrorBoundary } from "@/Components/ui/error-boundary";
import { Grid } from "@/Components/ui/grid";
import { Section } from "@/Components/ui/section";
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
              label: "شروع رایگان",
          };

    const secondaryHref = auth.user ? route("dashboard") : route("login");

    return (
        <ErrorBoundary fallback={<PageErrorFallback />}>
            <Head title="تماشاروم – با هم ببینید" />

            <button
                onClick={toggle}
                className="fixed end-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={dark ? "حالت روشن" : "حالت تاریک"}
                type="button"
            >
                {dark ? (
                    <Sun className="h-5 w-5 text-primary" />
                ) : (
                    <Moon className="h-5 w-5 text-primary" />
                )}
            </button>

            <div className="min-h-screen bg-background text-foreground antialiased">
                {/* Header */}
                <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
                    <Container className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-2 text-xl font-bold">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                                <Tv className="h-4 w-4" />
                            </span>
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
                    </Container>
                </header>

                {/* Hero */}
                <Section
                    spacing="relaxed"
                    className="relative overflow-hidden border-b border-border"
                >
                    {/* Subtle brand glow — respects light/dark via tokens */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-accent/5 to-transparent dark:from-primary/15 dark:via-accent/5"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-32 start-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15"
                    />

                    <Container className="relative flex flex-col items-center text-center">
                        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 rounded-full bg-success"
                            />
                            پخش زنده با دوستان
                        </span>

                        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
                            تماشای دسته‌جمعی فیلم و سریال، کاملاً همزمان
                        </h1>

                        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                            اتاق اختصاصی بسازید، دوستانتان را دعوت کنید و با
                            کیفیت سینمایی و چت زنده لذت ببرید.
                        </p>

                        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
                            <Link
                                href={primaryCta.href}
                                className={buttonVariants({
                                    variant: "primary",
                                    size: "lg",
                                    className: "w-full sm:w-auto",
                                })}
                            >
                                <Play className="h-5 w-5" fill="currentColor" />
                                {primaryCta.label}
                            </Link>
                            <Link
                                href={secondaryHref}
                                className={buttonVariants({
                                    variant: "outline",
                                    size: "lg",
                                    className: "w-full sm:w-auto",
                                })}
                            >
                                ورود به اتاق
                            </Link>
                        </div>

                        {/* Visual — stylized browser frame */}
                        <Card
                            hoverable
                            className="mt-12 w-full max-w-3xl overflow-hidden border-border/60 shadow-lg"
                        >
                            <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-2.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                                <span className="ms-3 text-xs text-muted-foreground">
                                    تماشاروم — اتاق فیلم شب جمعه
                                </span>
                            </div>
                            <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-black">
                                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                                    <Play
                                        className="h-7 w-7 ps-0.5"
                                        fill="currentColor"
                                    />
                                </span>
                                <span className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                                    <span
                                        aria-hidden="true"
                                        className="h-1.5 w-1.5 rounded-full bg-success"
                                    />
                                    {toPersianDigits("۳ نفر آنلاین")}
                                </span>
                                <span className="absolute inset-x-6 bottom-6">
                                    <span className="block h-1.5 overflow-hidden rounded-full bg-white/20">
                                        <span className="block h-full w-[35%] rounded-full bg-primary" />
                                    </span>
                                    <span className="mt-2 flex items-center justify-between text-xs text-white/80">
                                        <span dir="ltr">
                                            {toPersianDigits("04:12")}
                                        </span>
                                        <span dir="ltr">
                                            {toPersianDigits("01:24:00")}
                                        </span>
                                    </span>
                                </span>
                            </div>
                        </Card>
                    </Container>
                </Section>

                {/* Features */}
                <Section variant="surface">
                    <Container>
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                چرا تماشاروم؟
                            </h2>
                            <p className="mt-3 text-muted-foreground">
                                تجربه‌ای نزدیک به سینما، اما از خانه و با هم.
                            </p>
                        </div>

                        <Grid cols={3} className="mt-12">
                            <Card
                                hoverable
                                className="transition-transform hover:-translate-y-1"
                            >
                                <CardHeader>
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Play className="h-5 w-5" />
                                    </span>
                                    <CardTitle className="text-start">
                                        پخش کاملاً همزمان
                                    </CardTitle>
                                    <CardDescription className="text-start leading-relaxed">
                                        هیچ کس جلو یا عقب نیست. پخش، توقف و
                                        جستجو برای همه یکسان است.
                                    </CardDescription>
                                </CardHeader>
                            </Card>

                            <Card
                                hoverable
                                className="transition-transform hover:-translate-y-1"
                            >
                                <CardHeader>
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <MessageCircle className="h-5 w-5" />
                                    </span>
                                    <CardTitle className="text-start">
                                        چت زنده و امن
                                    </CardTitle>
                                    <CardDescription className="text-start leading-relaxed">
                                        در حین تماشا گفتگو کنید. پیام‌ها قابل
                                        مدیریت و ایمن هستند.
                                    </CardDescription>
                                </CardHeader>
                            </Card>

                            <Card
                                hoverable
                                className="transition-transform hover:-translate-y-1"
                            >
                                <CardHeader>
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Captions className="h-5 w-5" />
                                    </span>
                                    <CardTitle className="text-start">
                                        زیرنویس چندزبانه
                                    </CardTitle>
                                    <CardDescription className="text-start leading-relaxed">
                                        زیرنویس فارسی یا انگلیسی آپلود کنید.
                                        پشتیبانی از SRT و VTT.
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Grid>
                    </Container>
                </Section>

                {/* How it works */}
                <Section>
                    <Container>
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                چطور کار می‌کند؟
                            </h2>
                            <p className="mt-3 text-muted-foreground">
                                سه قدم تا تماشای دسته‌جمعی
                            </p>
                        </div>

                        <div className="mt-12 grid gap-6 md:grid-cols-3">
                            <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                    <PlusCircle className="h-6 w-6" />
                                </span>
                                <span className="mt-3 text-xs font-semibold tracking-widest text-muted-foreground">
                                    قدم ۱
                                </span>
                                <h3 className="mt-1 text-lg font-bold">
                                    یک اتاق بسازید
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    نام اتاق را وارد کنید و در چند ثانیه آماده
                                    شوید.
                                </p>
                            </div>

                            <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                    <Share2 className="h-6 w-6" />
                                </span>
                                <span className="mt-3 text-xs font-semibold tracking-widest text-muted-foreground">
                                    قدم ۲
                                </span>
                                <h3 className="mt-1 text-lg font-bold">
                                    لینک را بفرستید
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    لینک دعوت را برای دوستانتان ارسال کنید —
                                    ورود با یک کلیک.
                                </p>
                            </div>

                            <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                    <Users className="h-6 w-6" />
                                </span>
                                <span className="mt-3 text-xs font-semibold tracking-widest text-muted-foreground">
                                    قدم ۳
                                </span>
                                <h3 className="mt-1 text-lg font-bold">
                                    با هم تماشا کنید
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    ویدیو را پخش کنید — همه همزمان می‌بینند و چت
                                    می‌کنند.
                                </p>
                            </div>
                        </div>

                        <div className="mt-10 flex justify-center">
                            <Link
                                href={primaryCta.href}
                                className={buttonVariants({
                                    variant: "primary",
                                    size: "lg",
                                })}
                            >
                                {auth.user
                                    ? "رفتن به داشبورد"
                                    : "شروع کنید — رایگان"}
                            </Link>
                        </div>
                    </Container>
                </Section>

                {/* Footer */}
                <footer className="border-t border-border py-8">
                    <Container className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
                        <span>
                            تماشاروم &copy; {new Date().getFullYear()} — همه
                            حقوق محفوظ است.
                        </span>
                        <nav className="flex items-center gap-4">
                            <a
                                href="#"
                                className="hover:text-foreground hover:underline underline-offset-4"
                            >
                                درباره ما
                            </a>
                            <a
                                href="#"
                                className="hover:text-foreground hover:underline underline-offset-4"
                            >
                                حریم خصوصی
                            </a>
                            <a
                                href="#"
                                className="hover:text-foreground hover:underline underline-offset-4"
                            >
                                قوانین
                            </a>
                        </nav>
                    </Container>
                </footer>
            </div>
        </ErrorBoundary>
    );
}
