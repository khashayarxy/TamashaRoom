import { useCallback, useSyncExternalStore } from "react";

export interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

type Listener = () => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
    for (const listener of listeners) {
        listener();
    }
}

function addToast(message: string, type: Toast["type"] = "info") {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, message, type }];
    emit();
    setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        emit();
    }, 4000);
}

export function toast(message: string) {
    addToast(message, "info");
}

toast.success = (message: string) => addToast(message, "success");
toast.error = (message: string) => addToast(message, "error");

function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return toasts;
}

export function useToast() {
    const currentToasts = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getSnapshot,
    );

    const dismiss = useCallback((id: string) => {
        // eslint-disable-next-line react-compiler/react-compiler
        toasts = toasts.filter((t) => t.id !== id);
        emit();
    }, []);

    return { toasts: currentToasts, dismiss };
}
