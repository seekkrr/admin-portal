import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, MapPin, Building2, X } from "lucide-react";
import { regionsService } from "../services/regions.service";
import { cx } from "@/utils/cx";
import type { Region } from "@/types";

interface RegionPickerProps {
    /** Selected region id ("" when none). */
    value: string;
    /** Fires with the picked region id, or "" when cleared. */
    onChange: (regionId: string) => void;
    placeholder?: string;
    /** @deprecated ignored — one focus style everywhere. */
    ringClass?: string;
}

/**
 * Searchable region selector backed by GET /regions/search. Replaces raw region-id text entry:
 * admins type a region name, pick from the list, and we submit the region's id. When seeded
 * with an existing id (edit flows) the chip resolves the region's name via getById.
 */
export function RegionPicker({ value, onChange, placeholder = "Search a region by name…" }: RegionPickerProps) {
    const [editing, setEditing] = useState(false);
    const [input, setInput] = useState("");
    const [q, setQ] = useState("");

    // Debounce the query (matches PlaceSearchInput cadence).
    useEffect(() => {
        const t = window.setTimeout(() => setQ(input.trim()), 300);
        return () => window.clearTimeout(t);
    }, [input]);

    // Resolve the selected region's display name (edit case: we only hold an id).
    const selectedQuery = useQuery<Region>({
        queryKey: ["region-by-id", value],
        queryFn: () => regionsService.getById(value),
        enabled: !!value,
        staleTime: 5 * 60 * 1000,
    });

    // Search runs whenever the field is acting as an input (no selection, or actively changing one).
    const searching = !value || editing;
    const searchQuery = useQuery<Region[]>({
        queryKey: ["region-search", q],
        queryFn: async () => (await regionsService.search(q)).regions,
        enabled: searching && q.length >= 2,
        staleTime: 60 * 1000,
    });

    const reset = () => {
        setEditing(false);
        setInput("");
        setQ("");
    };

    const pick = (region: Region) => {
        onChange(region.id);
        reset();
    };

    const clear = () => {
        onChange("");
        reset();
    };

    // Selected chip — shown once a region is committed and we're not editing it.
    if (value && !editing) {
        const region = selectedQuery.data;
        return (
            <div className="flex h-10 items-center justify-between gap-3 rounded-control border border-line-strong bg-surface pl-3 pr-1 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                    <span className="min-w-0 truncate">
                        {selectedQuery.isLoading ? (
                            <span className="text-ink-faint">Loading…</span>
                        ) : region ? (
                            <>
                                <span className="font-medium text-ink">{region.name}</span>
                                <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-faint">{region.type}</span>
                            </>
                        ) : (
                            <span className="font-mono text-xs text-ink-muted" title={value}>
                                {value}
                            </span>
                        )}
                    </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => setEditing(true)} className="rounded-md px-2 py-1 text-xs font-medium text-accent-700 hover:bg-brand-50">
                        Change
                    </button>
                    <button type="button" onClick={clear} className="rounded-md p-1.5 text-ink-faint hover:bg-brand-50 hover:text-ink" aria-label="Clear region">
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                </span>
            </div>
        );
    }

    const results = q.length >= 2 ? (searchQuery.data ?? []) : [];

    return (
        <div>
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                <input
                    type="text"
                    autoFocus={editing}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    aria-label="Region"
                    className="h-10 w-full rounded-control border border-line-strong bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500"
                    placeholder={placeholder}
                />
                {searchQuery.isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-faint" aria-hidden />}
            </div>

            {value && editing && (
                <button type="button" onClick={reset} className="mt-2 text-xs font-medium text-ink-muted hover:text-ink hover:underline">
                    Cancel
                </button>
            )}

            {searchQuery.isError && <p className="mt-2 text-xs font-medium text-bad">Region search failed. Try again.</p>}

            {!searchQuery.isError && q.length >= 2 && !searchQuery.isFetching && results.length === 0 && (
                <p className="mt-2 text-xs text-ink-muted">No regions found for “{q}”.</p>
            )}

            {results.length > 0 && (
                <ul className="mt-2 max-h-60 divide-y divide-line overflow-hidden overflow-y-auto rounded-control border border-line">
                    {results.map((region) => (
                        <li key={region.id}>
                            <button
                                type="button"
                                onClick={() => pick(region)}
                                className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
                            >
                                <span
                                    className={cx(
                                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                        region.type === "city" ? "bg-accent-50 text-accent-700" : "bg-warn-soft text-warn"
                                    )}
                                >
                                    {region.type === "city" ? <Building2 className="h-3.5 w-3.5" aria-hidden /> : <MapPin className="h-3.5 w-3.5" aria-hidden />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-ink">{region.name}</span>
                                    <span className="block truncate text-xs text-ink-muted">{region.slug}</span>
                                    <span className="text-[10px] uppercase tracking-wide text-ink-faint">{region.type}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
