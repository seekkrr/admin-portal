import { useEffect, useState } from "react";

/** A copy of `value` that only updates after it has been still for `ms`. */
export function useDebouncedValue<T>(value: T, ms = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value), ms);
        return () => window.clearTimeout(t);
    }, [value, ms]);
    return debounced;
}
