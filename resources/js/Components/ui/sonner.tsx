import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Global toast host. Styled entirely from the app's semantic tokens
 * (bg-card / text-card-foreground / border-border), so toasts follow the
 * theme store's light/dark mode automatically. Toasts display Persian text,
 * so the container is RTL-aligned like the rest of the UI.
 */
const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            position="bottom-center"
            dir="rtl"
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast: "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
                    title: "group-[.toaster]:text-card-foreground",
                    description:
                        "group-[.toaster]:text-muted-foreground group-[.toaster]:font-normal",
                    actionButton:
                        "group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground",
                    cancelButton:
                        "group-[.toaster]:bg-muted group-[.toaster]:text-muted-foreground",
                    closeButton:
                        "group-[.toaster]:text-muted-foreground group-[.toaster]:hover:text-foreground",
                },
            }}
            {...props}
        />
    );
};

export { Toaster };
