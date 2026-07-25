import { ButtonHTMLAttributes } from "react";

export default function DangerButton({
    className = "",
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center rounded-xl border border-transparent bg-destructive px-4 py-2 text-xs font-semibold uppercase tracking-widest text-destructive-foreground transition duration-150 ease-in-out hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 active:opacity-80 ${
                    disabled && "opacity-25"
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
