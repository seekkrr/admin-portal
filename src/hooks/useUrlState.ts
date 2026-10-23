import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

export type UrlStateValue = string | number | boolean;
export type UrlStateDefaults = Record<string, UrlStateValue>;

export interface UrlStateApi<T extends UrlStateDefaults> {
    /** Current values: from the address when present, else the defaults. */
    state: T;
    /**
     * Merge a patch into the address. Values equal to their default are removed
     * from the URL. Changing anything other than `page` resets `page` (when the
     * state has one), so a new filter always starts on page 1.
     */
    set: (patch: Partial<T>, opts?: { replace?: boolean }) => void;
    /** Clear every key this hook owns (others, e.g. `focus`, are kept). */
    reset: () => void;
    /** True when any key other than `page` differs from its default. */
    isFiltered: boolean;
}

/**
 * Filters, search and page kept in the address, so they survive a reload and
 * coming back from a detail page. Keys not listed in `defaults` are left alone.
 *
 *   const { state, set } = useUrlState({ q: "", status: "", page: 1 });
 */
export function useUrlState<T extends UrlStateDefaults>(defaults: T): UrlStateApi<T> {
    const [params, setParams] = useSearchParams();
    // Defaults are treated as constant for the life of the page.
    const defaultsRef = useRef(defaults);

    const state = useMemo(() => {
        const out: Record<string, UrlStateValue> = {};
        for (const [key, def] of Object.entries(defaultsRef.current)) {
            const raw = params.get(key);
            if (raw === null) {
                out[key] = def;
            } else if (typeof def === "number") {
                const n = Number(raw);
                out[key] = Number.isFinite(n) ? n : def;
            } else if (typeof def === "boolean") {
                out[key] = raw === "true" || raw === "1";
            } else {
                out[key] = raw;
            }
        }
        return out as T;
    }, [params]);

    const set = useCallback(
        (patch: Partial<T>, opts?: { replace?: boolean }) => {
            setParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    const defs = defaultsRef.current;
                    let changedOther = false;
                    for (const [key, value] of Object.entries(patch)) {
                        const def = defs[key];
                        const before = prev.get(key);
                        if (value === undefined || value === null || value === "" || value === def) {
                            next.delete(key);
                        } else {
                            next.set(key, String(value));
                        }
                        if (key !== "page" && before !== next.get(key)) changedOther = true;
                    }
                    if (changedOther && "page" in defs && !("page" in patch)) next.delete("page");
                    return next;
                },
                { replace: opts?.replace ?? false }
            );
        },
        [setParams]
    );

    const reset = useCallback(() => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            Object.keys(defaultsRef.current).forEach((k) => next.delete(k));
            return next;
        });
    }, [setParams]);

    const isFiltered = Object.entries(defaultsRef.current).some(([k, def]) => k !== "page" && state[k] !== def);

    return { state, set, reset, isFiltered };
}

/**
 * A text box bound to a URL value with a debounce: typing updates the box at
 * once and the address after `delay` ms; back/forward or a reset updates the box.
 *
 *   const [search, setSearch] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));
 */
export function useDebouncedUrlInput(
    urlValue: string,
    commit: (value: string) => void,
    delay = 400
): [string, (value: string) => void] {
    const [input, setInput] = useState(urlValue);
    const lastCommitted = useRef(urlValue);
    const commitRef = useRef(commit);

    useEffect(() => {
        commitRef.current = commit;
    }, [commit]);

    // Address changed from outside (back button, reset, a link).
    useEffect(() => {
        if (urlValue !== lastCommitted.current) {
            lastCommitted.current = urlValue;
            setInput(urlValue);
        }
    }, [urlValue]);

    useEffect(() => {
        const t = window.setTimeout(() => {
            const v = input.trim();
            if (v !== lastCommitted.current) {
                lastCommitted.current = v;
                commitRef.current(v);
            }
        }, delay);
        return () => window.clearTimeout(t);
    }, [input, delay]);

    return [input, setInput];
}
