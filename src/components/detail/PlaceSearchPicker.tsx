import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Plus } from "lucide-react";
import { SearchInput } from "@/components/ui/FilterBar";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { markersService } from "@/features/markers/services/markers.service";
import type { Marker, MarkerStatus } from "@/types";
import { OBJECT_ID } from "./detailFormat";

/**
 * Find a SeekKrr place by name (or paste its id) and pick it. Used to link
 * places to a business, add quest stops and event venues.
 */
export function PlaceSearchPicker({
    onPick,
    excludeIds = [],
    status,
    placeholder = "Search places by name, or paste a place id",
    disabled,
    busyId,
}: {
    onPick: (marker: Marker) => void;
    excludeIds?: string[];
    /** Only places with this status (e.g. "approved" for quest stops). */
    status?: MarkerStatus;
    placeholder?: string;
    disabled?: boolean;
    /** Shows a spinner on the row being added. */
    busyId?: string | null;
}) {
    const [text, setText] = useState("");
    const q = useDebouncedValue(text.trim(), 300);
    const isId = OBJECT_ID.test(q);

    const search = useQuery({
        queryKey: ["detail-place-search", q, status ?? ""],
        queryFn: async () => (await markersService.list({ search: q, status, page_size: 8 })).markers ?? [],
        enabled: !disabled && !isId && q.length >= 2,
        staleTime: 60_000,
    });
    const byId = useQuery({
        queryKey: ["marker-detail", q],
        queryFn: () => markersService.getById(q),
        enabled: !disabled && isId,
        retry: false,
        staleTime: 60_000,
    });

    const rows = (isId ? (byId.data ? [byId.data] : []) : q.length >= 2 ? (search.data ?? []) : []).filter((m) => !excludeIds.includes(m.id));
    const loading = search.isFetching || byId.isFetching;
    const statusBlocked = (m: Marker) => !!status && m.status !== status;

    return (
        <div className="space-y-2">
            <SearchInput value={text} onChange={setText} placeholder={placeholder} label="Find a place" />
            {loading && (
                <p className="flex items-center gap-2 text-xs text-ink-faint">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Searching…
                </p>
            )}
            {!loading && q.length >= 2 && rows.length === 0 && <p className="text-xs text-ink-faint">No matching places.</p>}
            {rows.length > 0 && (
                <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-control border border-line">
                    {rows.map((m) => {
                        const blocked = statusBlocked(m);
                        return (
                            <li key={m.id}>
                                <button
                                    type="button"
                                    disabled={disabled || blocked || !!busyId}
                                    onClick={() => {
                                        onPick(m);
                                        setText("");
                                    }}
                                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {busyId === m.id ? (
                                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-600" aria-hidden />
                                    ) : (
                                        <Plus className="h-4 w-4 shrink-0 text-accent-600" aria-hidden />
                                    )}
                                    {m.media?.[0] ? (
                                        <img src={m.media[0]} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                                    ) : (
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-500">
                                            <MapPin className="h-4 w-4" aria-hidden />
                                        </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-ink">{m.title}</span>
                                        <span className="block truncate text-xs text-ink-muted">
                                            {blocked ? `Not approved (${m.status})` : m.address || m.categories?.join(", ") || m.id}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
