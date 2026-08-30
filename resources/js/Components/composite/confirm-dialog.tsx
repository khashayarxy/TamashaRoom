import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    confirmVariant?: "primary" | "destructive";
    loading?: boolean;
    children?: ReactNode;
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "تأیید",
    confirmVariant = "destructive",
    loading = false,
    children,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent>
                <DialogHeader className="text-center sm:text-center">
                    <DialogTitle className="text-center">{title}</DialogTitle>
                    <DialogDescription className="text-center">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                {children}
                <DialogFooter className="justify-center sm:justify-center">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={loading}
                    >
                        انصراف
                    </Button>
                    <Button
                        autoFocus
                        variant={confirmVariant}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? "در حال انجام..." : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
