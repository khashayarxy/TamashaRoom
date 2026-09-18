import { cn } from "@/lib/utils";
import { DialogHTMLAttributes, useEffect, useRef, forwardRef } from "react";

export type DialogVariant = "center" | "side-right";

export interface DialogProps extends DialogHTMLAttributes<HTMLDialogElement> {
    open?: boolean;
    onClose?: () => void;
    disableBackdropBlur?: boolean;
    /**
     * "center" (default): centered modal with blurred backdrop.
     * "side-right": docks to the PHYSICAL right edge, vertically centered,
     * with a transparent backdrop (keeps video visible — subtitle
     * settings). Physical (not logical) positioning is deliberate: the dock
     * side must stay invariant, like the LTR-pinned player it serves.
     */
    variant?: DialogVariant;
}

const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
    (
        {
            open,
            onClose,
            disableBackdropBlur,
            variant = "center",
            children,
            className,
            ...props
        },
        ref,
    ) => {
        const innerRef = useRef<HTMLDialogElement | null>(null);
        const resolvedRef = (ref ||
            innerRef) as React.RefObject<HTMLDialogElement | null>;

        useEffect(() => {
            const el = resolvedRef.current;
            if (!el) return;

            if (open && !el.open) {
                el.showModal();
            } else if (!open && el.open) {
                el.close();
            }
        }, [open, resolvedRef]);

        useEffect(() => {
            const el = resolvedRef.current;
            if (!el) return;

            const handler = () => onClose?.();
            el.addEventListener("close", handler);
            return () => el.removeEventListener("close", handler);
        }, [onClose, resolvedRef]);

        useEffect(() => {
            const el = resolvedRef.current;
            if (!el) return;

            const handler = (e: MouseEvent) => {
                if (e.target === el) onClose?.();
            };
            el.addEventListener("click", handler);
            return () => el.removeEventListener("click", handler);
        }, [onClose, resolvedRef]);

        const isSide = variant === "side-right";

        return (
            <dialog
                ref={ref || innerRef}
                className={cn(
                    "rounded-2xl border border-border/50 bg-card text-foreground p-0 shadow-2xl",
                    "max-h-[85vh] overflow-y-auto",
                    isSide
                        ? // Transparent backdrop: clicks still close (see
                          // handler above) but the video stays fully visible.
                          "backdrop:bg-transparent ml-auto mr-4 my-auto open:animate-dialog-side-in"
                        : [
                              "backdrop:bg-black/50",
                              !disableBackdropBlur &&
                                  "backdrop:backdrop-blur-sm",
                              // Gutters included in the width so small screens
                              // never overflow: min(32rem, viewport - 2rem).
                              "m-auto max-w-lg w-[calc(100%-2rem)] open:animate-dialog-in",
                          ],
                    className,
                )}
                {...props}
            >
                {children}
            </dialog>
        );
    },
);

Dialog.displayName = "Dialog";

const DialogContent = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("p-6", className)} {...props} />
);

const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col space-y-1.5 text-center sm:text-end",
            className,
        )}
        {...props}
    />
);

const DialogTitle = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
        className={cn(
            "text-lg font-semibold leading-none tracking-tight",
            className,
        )}
        {...props}
    />
);

const DialogDescription = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6",
            className,
        )}
        {...props}
    />
);

export {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
};
