import { useEffect, useState } from "react";

/** Trimmed, debounced copy of a text value (search boxes). */
export function useDebouncedValue(value: string, ms = 400): string {
    const [debounced, setDebounced] = useState(value.trim());
    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value.trim()), ms);
        return () => window.clearTimeout(t);
    }, [value, ms]);
    return debounced;
}
