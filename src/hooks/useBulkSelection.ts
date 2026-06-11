import { useCallback, useMemo, useState } from "react";

/**
 * Generic multi-row selection for tables. Tracks a Set of ids and exposes
 * toggle / toggle-all / clear helpers plus derived flags.
 */
export function useBulkSelection(allIds: string[]) {
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggle = useCallback((id: string, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(
        (checked: boolean) => {
            setSelected(checked ? new Set(allIds) : new Set());
        },
        [allIds]
    );

    const clear = useCallback(() => setSelected(new Set()), []);

    const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
    const someSelected = selected.size > 0 && !allSelected;
    const ids = useMemo(() => Array.from(selected), [selected]);

    return { selected, ids, count: selected.size, toggle, toggleAll, clear, allSelected, someSelected };
}

/**
 * Run an async operation across many ids with bounded concurrency. Returns
 * counts of successes and failures so callers can surface a summary toast.
 * Used for "bulk" actions that fan out over per-item endpoints (delete,
 * moderate, audio generation) when the backend has no native batch route.
 */
export async function runBulk<T>(
    ids: string[],
    fn: (id: string) => Promise<T>,
    concurrency = 5
): Promise<{ ok: number; failed: number }> {
    let ok = 0;
    let failed = 0;
    const queue = [...ids];

    async function worker() {
        for (;;) {
            const id = queue.shift();
            if (id === undefined) return;
            try {
                await fn(id);
                ok += 1;
            } catch {
                failed += 1;
            }
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
    await Promise.all(workers);
    return { ok, failed };
}
