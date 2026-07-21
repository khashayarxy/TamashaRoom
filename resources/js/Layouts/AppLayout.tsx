import { Button } from '@/Components/ui/button';
import { Link, usePage } from '@inertiajs/react';
import { Home, LogOut, Moon, Plus, Sun, Tv, User } from 'lucide-react';
import { PropsWithChildren, useState } from 'react';

interface UserData {
    id: number;
    name: string;
    email: string;
}

export default function AppLayout({ children }: PropsWithChildren) {
    const { auth } = usePage<{ auth: { user: UserData } }>().props;
    const user = auth.user;
    const [dark, setDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    const toggleDark = () => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('theme', next ? 'dark' : 'light');
    };

    const navItems = [
        { href: route('dashboard'), label: 'داشبورد', icon: Home },
    ];

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-sticky border-b border-border bg-card/80 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-6">
                        <Link href={route('dashboard')} className="flex items-center gap-2 font-bold text-xl">
                            <Tv className="h-6 w-6 text-primary" />
                            <span>TamashaRoom</span>
                        </Link>
                        <nav className="hidden sm:flex items-center gap-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href={route('rooms.store')} method="post" as="button">
                            <Button variant="primary" size="sm">
                                <Plus className="h-4 w-4" />
                                اتاق جدید
                            </Button>
                        </Link>

                        <Button variant="ghost" size="sm" onClick={toggleDark} aria-label="تغییر تم">
                            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        <Link href={route('profile.edit')}>
                            <Button variant="ghost" size="sm">
                                <User className="h-4 w-4" />
                                <span className="hidden sm:inline">{user.name}</span>
                            </Button>
                        </Link>

                        <Link href={route('logout')} method="post" as="button" aria-label="خروج">
                            <Button variant="ghost" size="sm">
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
