import { cn } from '@/lib/utils';
import { DialogHTMLAttributes, useEffect, useRef, forwardRef } from 'react';

export interface DialogProps extends DialogHTMLAttributes<HTMLDialogElement> {
    open?: boolean;
    onClose?: () => void;
}

const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
    ({ open, onClose, children, className, ...props }, ref) => {
        const innerRef = useRef<HTMLDialogElement | null>(null);
        const resolvedRef = (ref || innerRef) as React.RefObject<HTMLDialogElement | null>;

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
            el.addEventListener('close', handler);
            return () => el.removeEventListener('close', handler);
        }, [onClose, resolvedRef]);

        useEffect(() => {
            const el = resolvedRef.current;
            if (!el) return;

            const handler = (e: MouseEvent) => {
                if (e.target === el) onClose?.();
            };
            el.addEventListener('click', handler);
            return () => el.removeEventListener('click', handler);
        }, [onClose, resolvedRef]);

        return (
            <dialog
                ref={ref || innerRef}
                className={cn(
                    'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
                    'rounded-2xl border border-border bg-card p-0 shadow-xl',
                    'open:animate-in open:fade-in-0 open:zoom-in-95',
                    'max-w-lg w-full',
                    className
                )}
                {...props}
            >
                {children}
            </dialog>
        );
    }
);

Dialog.displayName = 'Dialog';

const DialogContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('p-6', className)} {...props} />
);

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-right', className)} {...props} />
);

const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
);

const DialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6', className)} {...props} />
);

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle };
