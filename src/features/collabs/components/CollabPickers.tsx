import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Building2, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import { regionsService } from "@/features/regions/services/regions.service";
import { markersService } from "@/features/markers/services/markers.service";
import { useDebouncedValue } from "../hooks";
import type { Marker, Region } from "@/types";

const useDebounced = (value: string) => useDebouncedValue(value, 300);

/**
 * Multi-region selector built on the same endpoints as the single
 * RegionPicker (GET /regions/search to find, GET /regions/{id} to label the
 * chips). Region ids are matched exactly by the backend, so pick the region a
 * marker actually belongs to (city or hotspot).
 */
export function RegionMultiSelect({
    value,
    onChange,
    disabled,
}: {
    value: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}) {
    const [input, setInput] = useState("");
    const q = useDebounced(input);

    const chips = useQueries({
        queries: value.map((id) => ({
            queryKey: ["region-by-id", id],
            queryFn: () => regionsService.getById(id),
            staleTime: 5 * 60 * 1000,
        })),
    });

    const search = useQuery<Region[]>({
        queryKey: ["region-search", q],
        queryFn: async () => (await regionsService.search(q)).regions,
        enabled: !disabled && q.length >= 2,
        staleTime: 60 * 1000,
    });

    const results = (q.length >= 2 ? search.data ?? [] : []).filter((r) => !value.includes(r.id));

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {value.length === 0 && <span className="text-xs text-neutral-400">No regions selected.</span>}
                {value.map((id, i) => {
                    const region = chips[i]?.data;
                    return (
                        <span
                            key={id}
                            className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs font-medium text-teal-800"
                            title={id}
                        >
                            {region?.type === "city" ? <Building2 className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                            {chips[i]?.isLoading ? "Loading…" : region?.name ?? id}
                            {region && <span className="text-[10px] uppercase text-teal-600/70">{region.type}</span>}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => onChange(value.filter((v) => v !== id))}
                                    className="p-0.5 rounded hover:bg-teal-100"
                                    aria-label={`Remove ${region?.name ?? id}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </span>
                    );
                })}
            </div>
            {!disabled && (
                <div>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="Search a region to enable…"
                        />
                        {search.isFetching && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500 animate-spin" />
                        )}
                    </div>
                    {search.isError && <p className="mt-2 text-xs text-red-500">Region search failed. Try again.</p>}
                    {!search.isError && q.length >= 2 && !search.isFetching && results.length === 0 && (
                        <p className="mt-2 text-xs text-neutral-500">No more regions match “{q}”.</p>
                    )}
                    {results.length > 0 && (
                        <ul className="mt-2 border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden max-h-60 overflow-y-auto">
                            {results.map((region) => (
                                <li key={region.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange([...value, region.id]);
                                            setInput("");
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-teal-50/60 transition-colors"
                                    >
                                        <Plus className="w-4 h-4 text-teal-600 shrink-0" />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium text-neutral-800 truncate">{region.name}</span>
                                            <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                                                {region.type} · {region.slug}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

/** Resolves a region id to its name (shares the RegionPicker cache). */
export function RegionName({ id }: { id: string | null | undefined }) {
    const q = useQuery<Region>({
        queryKey: ["region-by-id", id],
        queryFn: () => regionsService.getById(id ?? ""),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
    if (!id) return <span className="text-neutral-400">—</span>;
    return <span title={id}>{q.data?.name ?? (q.isLoading ? "…" : id)}</span>;
}

/** Resolves a marker id to a link with its title. */
export function MarkerLink({ id }: { id: string }) {
    const q = useQuery<Marker>({
        queryKey: ["marker-detail", id],
        queryFn: () => markersService.getById(id),
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
    return (
        <Link to={`/markers/${id}`} className="inline-flex items-center gap-1 text-teal-700 hover:underline" title={id}>
            <MapPin className="w-3.5 h-3.5" />
            {q.data?.title ?? (q.isLoading ? "Loading…" : id)}
        </Link>
    );
}

/** Marker id list with title lookup + search-to-add (GET /markers?search=). */
export function MarkerIdsInput({
    value,
    onChange,
    disabled,
}: {
    value: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}) {
    const [input, setInput] = useState("");
    const q = useDebounced(input);

    const chips = useQueries({
        queries: value.map((id) => ({
            queryKey: ["marker-detail", id],
            queryFn: () => markersService.getById(id),
            staleTime: 5 * 60 * 1000,
            retry: false,
        })),
    });

    const search = useQuery<Marker[]>({
        queryKey: ["collabs-marker-search", q],
        queryFn: async () => (await markersService.list({ search: q, page_size: 10 })).markers ?? [],
        enabled: !disabled && q.length >= 2,
        staleTime: 60 * 1000,
    });

    const results = (q.length >= 2 ? search.data ?? [] : []).filter((m) => !value.includes(m.id));
    const looksLikeId = /^[a-f0-9]{24}$/i.test(input.trim()) && !value.includes(input.trim());

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {value.length === 0 && <span className="text-xs text-neutral-400">No places linked.</span>}
                {value.map((id, i) => {
                    const marker = chips[i]?.data;
                    return (
                        <span
                            key={id}
                            className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-orange-50 border border-orange-200 text-xs font-medium text-orange-800"
                            title={id}
                        >
                            <MapPin className="w-3 h-3" />
                            {chips[i]?.isLoading ? "Loading…" : marker?.title ?? id}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => onChange(value.filter((v) => v !== id))}
                                    className="p-0.5 rounded hover:bg-orange-100"
                                    aria-label={`Remove ${marker?.title ?? id}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </span>
                    );
                })}
            </div>
            {!disabled && (
                <div>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="Search places by name, or paste a marker id…"
                        />
                        {search.isFetching && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500 animate-spin" />
                        )}
                    </div>
                    {looksLikeId && (
                        <button
                            type="button"
                            onClick={() => {
                                onChange([...value, input.trim()]);
                                setInput("");
                            }}
                            className="mt-2 text-xs text-teal-700 hover:underline"
                        >
                            Add marker id {input.trim()}
                        </button>
                    )}
                    {results.length > 0 && (
                        <ul className="mt-2 border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden max-h-60 overflow-y-auto">
                            {results.map((m) => (
                                <li key={m.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange([...value, m.id]);
                                            setInput("");
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-teal-50/60 transition-colors"
                                    >
                                        <Plus className="w-4 h-4 text-teal-600 shrink-0" />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium text-neutral-800 truncate">{m.title}</span>
                                            <span className="block text-xs text-neutral-500 truncate">
                                                {m.address || m.categories?.join(", ") || m.id}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
