import { useToast } from '@/Hooks/use-toast';
import { CheckCircle, Info, X, XCircle } from 'lucide-react';

const iconMap = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
};

const colorMap = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconColorMap = {
    success: 'text-green-500',
    error: 'text-red-500',
    info: 'text-blue-500',
};

export function ToastContainer() {
    const { toasts, dismiss } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-sm px-4">
            {toasts.map((t) => {
                const Icon = iconMap[t.type];
                return (
                    <div
                        key={t.id}
                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 fade-in ${colorMap[t.type]}`}
                    >
                        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColorMap[t.type]}`} />
                        <span className="flex-1">{t.message}</span>
<button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="بستن">
    <X className="h-4 w-4" />
</button>
                    </div>
                );
            })}
        </div>
    );
}
