import { useEffect, useState } from "react";

/**
 * Debounce a value — returns the latest value only after `delay` ms of
 * stability. Useful for search inputs to avoid spamming requests.
 * Cleanup cancels the pending timer on value change / unmount.
 */
export function useDebounce<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);

    return debounced;
}
