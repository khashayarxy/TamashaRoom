import { useEffect } from 'react';
import { router } from '@inertiajs/react';

export function usePollingReload(intervalMs: number = 5000) {
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload();
        }, intervalMs);

        return () => clearInterval(interval);
    }, [intervalMs]);
}
