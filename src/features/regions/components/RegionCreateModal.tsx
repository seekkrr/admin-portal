import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, X, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { nearbyReferenceBoxes } from "../utils/nearbyBoxes";
import { BboxDrawMap } from "@components/maps/BboxDrawMap";
import { PlaceSearchInput } from "@components/maps/PlaceSearchInput";
import {
    REGION_SEARCH_TYPES,
    INDIA_PROXIMITY,
    isAdminFeatureType,
    type ResolvedPlace,
} from "@/services/geocoding.service";
import type { RegionType, Region, CreateRegionPayload, GeoPolygon, GeoPoint } from "@/types";

interface RegionCreateModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: (id: string) => void;
}

/** Build a GeoJSON Polygon from a place's bbox, or a small box around its center. */
function placeToPolygon(place: ResolvedPlace): GeoPolygon {
    const [lon, lat] = place.center;
    const [w, s, e, n] = place.bbox ?? [lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02];
    return { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
}

export function RegionCreateModal({ open, onClose, onSuccess }: RegionCreateModalProps) {
    const queryClient = useQueryClient();

    const [cName, setCName] = useState("");
    const [cType, setCType] = useState<RegionType>("city");
    const [cDescription, setCDescription] = useState("");
    const [cWeight, setCWeight] = useState("1.0");
    const [cParentId, setCParentId] = useState("");

    // Selected place (provides the initial bbox + center) — search UI lives in <PlaceSearchInput>.
    const [selectedPlace, setSelectedPlace] = useState<ResolvedPlace | null>(null);
    // bbox + center are seeded from the picked place, then editable via <BboxDrawMap>.
    const [bbox, setBbox] = useState<GeoPolygon | null>(null);
    const [centerPoint, setCenterPoint] = useState<GeoPoint | null>(null);

    const citiesQuery = useQuery<Region[]>({
        queryKey: ["admin-regions-cities"],
        queryFn: () => regionsService.listAll({ type: "city" }),
        enabled: open && cType === "hotspot",
        staleTime: 5 * 60 * 1000,
    });

    // All regions for the bbox editor's overlap-guard layer (fetched once a place is picked).
    const allRegionsQuery = useQuery<Region[]>({
        queryKey: ["admin-regions-all-ref"],
        queryFn: () => regionsService.listAll(),
        enabled: open && !!selectedPlace,
        staleTime: 5 * 60 * 1000,
    });

    // Anchor on the picked place's boundary (stable) and show same-type neighbours nearby.
    const referenceBoxes = useMemo(
        () =>
            nearbyReferenceBoxes({
                regions: allRegionsQuery.data ?? [],
                anchor: selectedPlace ? placeToPolygon(selectedPlace) : null,
                type: cType,
            }),
        [allRegionsQuery.data, selectedPlace, cType],
    );

    const resetCreate = () => {
        setCName("");
        setCType("city");
        setCDescription("");
        setCWeight("1.0");
        setCParentId("");
        setSelectedPlace(null);
        setBbox(null);
        setCenterPoint(null);
        onClose();
    };

    const createMutation = useMutation({
        mutationFn: (payload: CreateRegionPayload) => regionsService.create(payload),
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            toast.success("Region created");
            resetCreate();
            if (onSuccess) onSuccess(created.id);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create region"),
    });

    const pickPlace = (place: ResolvedPlace) => {
        setSelectedPlace(place);
        setBbox(placeToPolygon(place));
        setCenterPoint({ type: "Point", coordinates: place.center });
        if (!cName.trim()) setCName(place.name);
        const detected: RegionType = isAdminFeatureType(place.featureType) ? "city" : "hotspot";
        setCType(detected);
        if (detected === "city") setCParentId("");
    };

    const clearPlace = () => {
        setSelectedPlace(null);
        setBbox(null);
        setCenterPoint(null);
    };

    const handleCreate = (e: FormEvent) => {
        e.preventDefault();
        const name = cName.trim();
        if (!name) {
            toast.error("Name is required");
            return;
        }
        if (!selectedPlace) {
            toast.error("Search and select a place to anchor the region");
            return;
        }
        if (!bbox || !centerPoint) {
            toast.error("Draw a bounding box for the region");
            return;
        }
        if (cType === "hotspot" && !cParentId) {
            toast.error("A hotspot requires a parent city");
            return;
        }
        const weight = Number(cWeight);
        if (!Number.isFinite(weight) || weight <= 0) {
            toast.error("Admin weight must be greater than 0");
            return;
        }
        const payload: CreateRegionPayload = {
            name,
            type: cType,
            admin_weight: weight,
            bbox,
            center_point: centerPoint,
        };
        if (selectedPlace.mapboxId) payload.mapbox_place_id = selectedPlace.mapboxId;
        const description = cDescription.trim();
        if (description) payload.description = description;
        if (cType === "hotspot" && cParentId) payload.parent_id = cParentId;
        createMutation.mutate(payload);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-neutral-200">
                    <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-100 text-cyan-600">
                            <Globe className="w-4 h-4" />
                        </span>
                        New Region
                    </h3>
                    <button
                        onClick={resetCreate}
                        disabled={createMutation.isPending}
                        className="p-1.5 rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleCreate} className="p-5 space-y-4">
                    {/* ── Place search (provides bbox + center) ───────────────────── */}
                    {!selectedPlace ? (
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Find a place <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-neutral-500 mb-2">
                                Search a city or hotspot. We use its real geographic boundary (bbox) and center.
                            </p>
                            <PlaceSearchInput
                                searchTypes={REGION_SEARCH_TYPES}
                                proximity={INDIA_PROXIMITY}
                                autoFocus
                                placeholder="e.g. Bir Billing, Varanasi, Indiranagar…"
                                onSelect={pickPlace}
                                onError={(msg) => toast.error(msg)}
                            />
                        </div>
                    ) : (
                        <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 min-w-0">
                                    <Check className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-neutral-800 truncate">{selectedPlace.name}</p>
                                        <p className="text-xs text-neutral-500 truncate">{selectedPlace.fullAddress}</p>
                                        <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                                            {selectedPlace.center[1].toFixed(4)}, {selectedPlace.center[0].toFixed(4)}
                                            {selectedPlace.bbox ? " · bbox" : " · synthetic bbox"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearPlace}
                                    className="text-xs text-cyan-700 hover:underline shrink-0"
                                >
                                    Change
                                </button>
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-2 mb-2">
                                The boundary is seeded from the place. Drag the corner handles or redraw to adjust it.
                            </p>
                            <div className="mt-1 rounded-lg overflow-hidden border border-neutral-200">
                                <BboxDrawMap
                                    value={bbox}
                                    center={selectedPlace.center}
                                    referenceBoxes={referenceBoxes}
                                    onChange={(poly, c) => {
                                        setBbox(poly);
                                        setCenterPoint(c);
                                    }}
                                    height="220px"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="region-name" className="block text-sm font-medium text-neutral-700 mb-1">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="region-name"
                            type="text"
                            required
                            value={cName}
                            onChange={(e) => setCName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            placeholder="e.g. Paris"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="region-type" className="block text-sm font-medium text-neutral-700 mb-1">
                                Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="region-type"
                                value={cType}
                                onChange={(e) => {
                                    setCType(e.target.value as RegionType);
                                    setCParentId("");
                                }}
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="city">City</option>
                                <option value="hotspot">Hotspot</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="region-weight" className="block text-sm font-medium text-neutral-700 mb-1">
                                Admin weight ({">"} 0)
                            </label>
                            <input
                                id="region-weight"
                                type="number"
                                min={0}
                                step="0.1"
                                value={cWeight}
                                onChange={(e) => setCWeight(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </div>

                    {cType === "hotspot" && (
                        <div>
                            <label htmlFor="region-parent" className="block text-sm font-medium text-neutral-700 mb-1">
                                Parent city <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="region-parent"
                                value={cParentId}
                                onChange={(e) => setCParentId(e.target.value)}
                                disabled={citiesQuery.isLoading}
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                            >
                                <option value="">
                                    {citiesQuery.isLoading ? "Loading cities…" : "— Select a city —"}
                                </option>
                                {(citiesQuery.data ?? []).map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label htmlFor="region-description" className="block text-sm font-medium text-neutral-700 mb-1">
                            Description
                        </label>
                        <textarea
                            id="region-description"
                            rows={2}
                            value={cDescription}
                            onChange={(e) => setCDescription(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                        <button
                            type="button"
                            onClick={resetCreate}
                            disabled={createMutation.isPending}
                            className="px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || !selectedPlace}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create Region
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
