import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Check } from "lucide-react";
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
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";

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

    const busy = createMutation.isPending;

    return (
        <Modal
            open={open}
            onClose={resetCreate}
            dismissible={!busy}
            title="New region"
            icon={Globe}
            size="xl"
            footer={
                <>
                    <Button variant="secondary" onClick={resetCreate} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" form="region-create-form" loading={busy} disabled={!selectedPlace}>
                        Create region
                    </Button>
                </>
            }
        >
            <form id="region-create-form" onSubmit={handleCreate} className="space-y-4">
                {/* Place search (provides bbox + center) */}
                {!selectedPlace ? (
                    <Field label="Find a place" required hint="Search a city or hotspot. We use its real boundary (bbox) and center." htmlFor="region-place">
                        <div id="region-place">
                            <PlaceSearchInput
                                searchTypes={REGION_SEARCH_TYPES}
                                proximity={INDIA_PROXIMITY}
                                autoFocus
                                placeholder="e.g. Bir Billing, Varanasi, Indiranagar…"
                                onSelect={pickPlace}
                                onError={(msg) => toast.error(msg)}
                            />
                        </div>
                    </Field>
                ) : (
                    <div className="space-y-2 rounded-card border border-accent-200 bg-accent-50/50 p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-ink">{selectedPlace.name}</p>
                                    <p className="truncate text-xs text-ink-muted">{selectedPlace.fullAddress}</p>
                                    <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                                        {selectedPlace.center[1].toFixed(4)}, {selectedPlace.center[0].toFixed(4)}
                                        {selectedPlace.bbox ? " · bbox" : " · synthetic bbox"}
                                    </p>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" onClick={clearPlace}>
                                Change
                            </Button>
                        </div>
                        <p className="text-xs text-ink-muted">The boundary comes from the place. Drag the corner handles or redraw to adjust it.</p>
                        <div className="overflow-hidden rounded-control border border-line">
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

                <Field label="Name" required>
                    <TextInput type="text" required value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Paris" />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Type" required>
                        <SelectInput
                            value={cType}
                            onChange={(e) => {
                                setCType(e.target.value as RegionType);
                                setCParentId("");
                            }}
                            options={[
                                { value: "city", label: "City" },
                                { value: "hotspot", label: "Hotspot" },
                            ]}
                        />
                    </Field>
                    <Field label="Admin weight" hint="Greater than 0.">
                        <TextInput type="number" min={0} step="0.1" value={cWeight} onChange={(e) => setCWeight(e.target.value)} />
                    </Field>
                </div>

                {cType === "hotspot" && (
                    <Field label="Parent city" required>
                        <SelectInput value={cParentId} onChange={(e) => setCParentId(e.target.value)} disabled={citiesQuery.isLoading}>
                            <option value="">{citiesQuery.isLoading ? "Loading cities…" : "Select a city"}</option>
                            {(citiesQuery.data ?? []).map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </SelectInput>
                    </Field>
                )}

                <Field label="Description">
                    <TextArea rows={2} value={cDescription} onChange={(e) => setCDescription(e.target.value)} />
                </Field>
            </form>
        </Modal>
    );
}
