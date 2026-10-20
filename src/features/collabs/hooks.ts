import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { businessesService } from "./services/businesses.service";

/** Trimmed, debounced copy of a text value (search boxes). */
export function useDebouncedValue(value: string, ms = 400): string {
    const [debounced, setDebounced] = useState(value.trim());
    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value.trim()), ms);
        return () => window.clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

/** Predefined business categories (place categories minus system buckets). */
export function useBusinessCategories() {
    return useQuery({
        queryKey: ["collabs-business-categories"],
        queryFn: () => businessesService.categories(),
        staleTime: 10 * 60_000,
    });
}
