import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface SectionProps extends HTMLAttributes<HTMLElement> {
    variant?: "default" | "surface";
    spacing?: "default" | "compact" | "relaxed";
}

const variantStyles = {
    default: "bg-transparent",
    surface: "bg-surface-card border-y border-surface-border",
} as const;

const spacingStyles = {
    compact: "py-8 sm:py-12",
    default: "py-12 sm:py-16",
    relaxed: "py-16 sm:py-20 lg:py-24",
} as const;

/**
 * Vertical rhythm section with optional surface background.
 * Spacing is mobile-first; surface variant provides subtle separation.
 */
export function Section({
    className,
    variant = "default",
    spacing = "default",
    ...props
}: SectionProps) {
    return (
        <section
            className={cn(
                variantStyles[variant],
                spacingStyles[spacing],
                className,
            )}
            {...props}
        />
    );
}
