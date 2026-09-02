import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface GridProps extends HTMLAttributes<HTMLDivElement> {
    cols?: 2 | 3 | 4;
}

/**
 * Responsive grid: 1 col on mobile → `cols` on desktop.
 * Tablet gets 2 cols when cols > 2 for balanced reflow.
 */
export function Grid({ className, cols = 3, ...props }: GridProps) {
    const colClass = {
        2: "md:grid-cols-2",
        3: "md:grid-cols-2 lg:grid-cols-3",
        4: "md:grid-cols-2 lg:grid-cols-4",
    }[cols];

    return (
        <div
            className={cn("grid grid-cols-1 gap-6", colClass, className)}
            {...props}
        />
    );
}
