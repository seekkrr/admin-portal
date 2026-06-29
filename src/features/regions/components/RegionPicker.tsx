import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, MapPin, Building2, X } from "lucide-react";
import { regionsService } from "../services/regions.service";
import type { Region } from "@/types";

interface RegionPickerProps {
    /** Selected region id ("" when none). */
    value: string;
    /** Fires with the picked region id, or "" when cleared. */
    onChange: (regionId: string) => void;
    placeholder?: string;
    /** Tailwind focus-ring color class to match the host form (default orange for markers). */
    ringClass?: string;
}

/**
 * Searchable region selector backed by GET /regions/search. Replaces raw region-id text entry:
 * admins type a region name, pick from the dropdown, and we submit the region's id. When seeded
 * with an existing id (edit flows) the chip resolves the region's name via getById.
 */
export function RegionPicker({
    value,
    onChange,
    placeholder = "Search a region by name…",
    ringClass = "focus:ring-orange-500",
}: RegionPickerProps) {
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
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span className="min-w-0 truncate">
                        {selectedQuery.isLoading ? (
                            <span className="text-neutral-400">Loading…</span>
                        ) : region ? (
                            <>
                                <span className="font-medium text-neutral-800">{region.name}</span>
                                <span className="ml-2 text-[10px] uppercase tracking-wide text-neutral-400">
                                    {region.type}
                                </span>
                            </>
                        ) : (
                            <span className="text-neutral-500" title={value}>
                                {value}
                            </span>
                        )}
                    </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-xs text-orange-600 hover:underline"
                    >
                        Change
                    </button>
                    <button
                        type="button"
                        onClick={clear}
                        className="p-1 text-neutral-400 hover:text-neutral-700"
                        aria-label="Clear region"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </span>
            </div>
        );
    }

    const results = q.length >= 2 ? (searchQuery.data ?? []) : [];

    return (
        <div>
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                    type="text"
                    autoFocus={editing}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 ${ringClass}`}
                    placeholder={placeholder}
                />
                {searchQuery.isFetching && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500 animate-spin" />
                )}
            </div>

            {value && editing && (
                <button type="button" onClick={reset} className="mt-2 text-xs text-neutral-500 hover:underline">
                    Cancel
                </button>
            )}

            {searchQuery.isError && <p className="mt-2 text-xs text-red-500">Region search failed. Try again.</p>}

            {!searchQuery.isError && q.length >= 2 && !searchQuery.isFetching && results.length === 0 && (
                <p className="mt-2 text-xs text-neutral-500">No regions found for “{q}”.</p>
            )}

            {results.length > 0 && (
                <ul className="mt-2 border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden max-h-60 overflow-y-auto">
                    {results.map((region) => (
                        <li key={region.id}>
                            <button
                                type="button"
                                onClick={() => pick(region)}
                                className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-orange-50/60 transition-colors"
                            >
                                <span
                                    className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${
                                        region.type === "city"
                                            ? "bg-cyan-100 text-cyan-600"
                                            : "bg-amber-100 text-amber-600"
                                    }`}
                                >
                                    {region.type === "city" ? (
                                        <Building2 className="w-3.5 h-3.5" />
                                    ) : (
                                        <MapPin className="w-3.5 h-3.5" />
                                    )}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium text-neutral-800 truncate">
                                        {region.name}
                                    </span>
                                    <span className="block text-xs text-neutral-500 truncate">{region.slug}</span>
                                    <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                                        {region.type}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
