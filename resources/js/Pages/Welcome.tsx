import { Button } from '@/Components/ui/button';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Tv, Users, MessageSquare, Copy } from 'lucide-react';

export default function Welcome({ auth }: PageProps) {
    return (
        <>
            <Head title="تماشاروم – با هم ببینید" />

            <div className="flex min-h-screen flex-col bg-background">
                <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2 text-xl font-bold">
                        <Tv className="h-6 w-6 text-primary" />
                        <span>TamashaRoom</span>
                    </div>
                    <nav className="flex items-center gap-3">
                        {auth.user ? (
                            <Link href={route('dashboard')}>
                                <Button variant="primary" size="sm">
                                    داشبورد
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <Link href={route('login')}>
                                    <Button variant="ghost" size="sm">
                                        ورود
                                    </Button>
                                </Link>
                                <Link href={route('register')}>
                                    <Button variant="primary" size="sm">
                                        ثبت‌نام
                                    </Button>
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                <main className="flex flex-1 flex-col">
                    <section className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
                        <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                            با هم ببینید،
                            <br />
                            حتی اگه دورید
                        </h1>
                        <p className="mt-6 max-w-lg text-lg text-muted-foreground">
                            TamashaRoom اتاق‌های خصوصی برای تماشای هم‌زمان فیلم
                            و ویدیو با دوستان و خانواده. بساز، دعوت کن، لذت ببر.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                            {auth.user ? (
                                <Link href={route('dashboard')}>
                                    <Button variant="primary" size="lg">
                                        <Tv className="h-5 w-5" />
                                        ورود به داشبورد
                                    </Button>
                                </Link>
                            ) : (
                                <>
                                    <Link href={route('register')}>
                                        <Button variant="primary" size="lg">
                                            شروع کنید
                                        </Button>
                                    </Link>
                                    <Link href={route('login')}>
                                        <Button variant="outline" size="lg">
                                            ورود
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </div>
                    </section>

                    <section className="border-t border-border bg-card py-20">
                        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                            <div className="grid gap-8 md:grid-cols-3">
                                <div className="flex flex-col items-center text-center">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                                        <Copy className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold">
                                        یک اتاق بسازید
                                    </h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        در چند ثانیه یک اتاق خصوصی بسازید و کد دعوت
                                        را با دوستان خود به اشتراک بگذارید.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center text-center">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                                        <Users className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold">
                                        دعوت کنید و جمع شوید
                                    </h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        دوستانتان با کد دعوت به اتاق شما می‌پیوندند
                                        – نیازی به ثبت‌نام پیچیده نیست.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center text-center">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                                        <MessageSquare className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold">
                                        همزمان تماشا کنید
                                    </h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        پخش، مکث، و زمان ویدیو برای همه هماهنگ است.
                                        همراه با چت لحظه‌ای و زیرنویس.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="border-t border-border py-20">
                        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
                            <h2 className="text-2xl font-bold sm:text-3xl">
                                آماده‌ای با هم ببینیم؟
                            </h2>
                            <p className="mt-4 text-muted-foreground">
                                همین حالا یک اتاق بساز و دوستانت رو دعوت کن.
                            </p>
                            <div className="mt-8">
                                {auth.user ? (
                                    <Link href={route('dashboard')}>
                                        <Button variant="primary" size="lg">
                                            <Tv className="h-5 w-5" />
                                            برو به داشبورد
                                        </Button>
                                    </Link>
                                ) : (
                                    <Link href={route('register')}>
                                        <Button variant="primary" size="lg">
                                            شروع کنید – رایگان
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                    TamashaRoom &copy; {new Date().getFullYear()}
                </footer>
            </div>
        </>
    );
}
