import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, MapPin, Building2 } from "lucide-react";
import {
    suggestPlaces,
    retrievePlace,
    newSessionToken,
    isAdminFeatureType,
    type PlaceSuggestion,
    type ResolvedPlace,
} from "@/services/geocoding.service";

interface PlaceSearchInputProps {
    /** Comma-separated Mapbox feature types (see REGION_SEARCH_TYPES / MARKER_SEARCH_TYPES). */
    searchTypes: string;
    /** [lon, lat] proximity bias passed to suggest. */
    proximity?: [number, number] | null;
    placeholder?: string;
    autoFocus?: boolean;
    /** Fires after a suggestion is resolved to coordinates. */
    onSelect: (place: ResolvedPlace) => void;
    /** Optional error surfacing (e.g. toast). Inline message is shown regardless. */
    onError?: (message: string) => void;
}

/**
 * Reusable place finder backed by Mapbox SearchBox. Debounced search-as-you-type with a
 * results dropdown; on pick it resolves coordinates (+ bbox) and calls `onSelect`. Shared
 * by the Region and Marker create modals.
 */
export function PlaceSearchInput({
    searchTypes,
    proximity = null,
    placeholder = "Search a place…",
    autoFocus = false,
    onSelect,
    onError,
}: PlaceSearchInputProps) {
    const [input, setInput] = useState("");
    const [q, setQ] = useState("");
    const [sessionToken, setSessionToken] = useState(() => newSessionToken());
    const [retrievingId, setRetrievingId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Debounce the query.
    useEffect(() => {
        const t = window.setTimeout(() => setQ(input.trim()), 350);
        return () => window.clearTimeout(t);
    }, [input]);

    const proximityKey = proximity ? `${proximity[0]},${proximity[1]}` : "";
    // sessionToken is part of the key so that after it rotates on a pick, a repeat search refetches
    // suggestions under the current token — keeping suggest+retrieve in the same Mapbox session.
    const suggestQuery = useQuery<PlaceSuggestion[]>({
        queryKey: ["place-suggest", q, searchTypes, proximityKey, sessionToken],
        queryFn: () => suggestPlaces(q, { sessionToken, proximity, types: searchTypes }),
        enabled: q.length >= 3,
        staleTime: 5 * 60 * 1000,
    });

    const handlePick = async (suggestion: PlaceSuggestion) => {
        if (!suggestion.mapboxId) return;
        setRetrievingId(suggestion.mapboxId);
        setErrorMsg(null);
        try {
            const resolved = await retrievePlace(suggestion.mapboxId, sessionToken);
            if (!resolved) {
                const msg = "Could not resolve that place. Try another.";
                setErrorMsg(msg);
                onError?.(msg);
                return;
            }
            // Reset for the next search (close dropdown, fresh billing session) before notifying
            // the parent — `onSelect` may unmount this component (e.g. the region modal).
            setInput("");
            setQ("");
            setSessionToken(newSessionToken());
            onSelect(resolved);
        } catch {
            const msg = "Place search failed. Try again.";
            setErrorMsg(msg);
            onError?.(msg);
        } finally {
            setRetrievingId(null);
        }
    };

    const results = suggestQuery.data ?? [];
    // A single source of truth for the message, shown inline and (for retrieve) via onError.
    const errorText = errorMsg ?? (suggestQuery.isError ? "Place search failed. Try again." : null);

    return (
        <div>
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                    type="text"
                    autoFocus={autoFocus}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                    }}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder={placeholder}
                />
                {(suggestQuery.isFetching || retrievingId !== null) && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 animate-spin" />
                )}
            </div>

            {errorText && <p className="mt-2 text-xs text-red-500">{errorText}</p>}

            {!errorText && q.length >= 3 && !suggestQuery.isFetching && results.length === 0 && (
                <p className="mt-2 text-xs text-neutral-500">No places found for “{q}”.</p>
            )}

            {results.length > 0 && (
                <ul className="mt-2 border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
                    {results.map((place) => {
                        const isAdmin = isAdminFeatureType(place.featureType);
                        return (
                            <li key={place.mapboxId || place.placeFormatted}>
                                <button
                                    type="button"
                                    onClick={() => handlePick(place)}
                                    disabled={retrievingId !== null}
                                    className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-cyan-50/60 transition-colors disabled:opacity-60"
                                >
                                    <span
                                        className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${
                                            isAdmin ? "bg-cyan-100 text-cyan-600" : "bg-amber-100 text-amber-600"
                                        }`}
                                    >
                                        {isAdmin ? (
                                            <Building2 className="w-3.5 h-3.5" />
                                        ) : (
                                            <MapPin className="w-3.5 h-3.5" />
                                        )}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium text-neutral-800 truncate">
                                            {place.name}
                                        </span>
                                        <span className="block text-xs text-neutral-500 truncate">
                                            {place.placeFormatted}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                                            {place.featureType}
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
