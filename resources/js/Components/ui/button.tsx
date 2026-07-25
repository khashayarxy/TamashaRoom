import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "destructive" | "ghost" | "outline";
    size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", ...props }, ref) => {
        const baseStyles =
            "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none";

        const variants = {
            primary:
                "bg-primary text-primary-foreground hover:opacity-90 shadow-sm",
            secondary:
                "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            destructive:
                "bg-destructive text-destructive-foreground hover:opacity-90",
            ghost: "hover:bg-accent hover:text-accent-foreground",
            outline:
                "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        };

        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 text-sm",
            lg: "h-12 px-6 text-base",
        };

        return (
            <button
                ref={ref}
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    className,
                )}
                {...props}
            />
        );
    },
);

Button.displayName = "Button";

export { Button };
