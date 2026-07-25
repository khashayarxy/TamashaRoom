import ApplicationLogo from "@/Components/ApplicationLogo";
import { Link } from "@inertiajs/react";
import { PropsWithChildren } from "react";

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen flex-col items-center bg-background pt-6 sm:justify-center sm:pt-0">
            <div>
                <Link href="/" aria-label="صفحه اصلی">
                    <ApplicationLogo className="h-20 w-20 fill-current text-primary" />
                </Link>
            </div>

            <div className="relative mt-6 w-full overflow-hidden bg-card shadow-md sm:max-w-md sm:rounded-xl">
                <div className="h-1 w-full bg-primary" />
                <div className="px-6 py-6">{children}</div>
            </div>
        </div>
    );
}
