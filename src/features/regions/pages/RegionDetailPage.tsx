import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit2, Globe, Info, MapPin, Scale, X } from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { GeoMap, type GeoMapPoint } from "@components/maps/GeoMap";
import { BboxDrawMap } from "@components/maps/BboxDrawMap";
import { nearbyReferenceBoxes } from "../utils/nearbyBoxes";
import { useAuthStore } from "@store/auth.store";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Switch, TextArea, TextInput } from "@/components/ui/Field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/utils/date";
import type { Region, UpdateRegionPayload, GeoPolygon } from "@/types";

import { CrowdMeterSection } from "../components/CrowdMeterSection";
import { TravelTimeMatrix } from "../components/TravelTimeMatrix";
import { LinkedQuests } from "../components/LinkedQuests";
import { DangerZone } from "../components/DangerZone";

const EDIT_ROLES = ["admin", "super_admin"];

function regionCenter(region: Region): [number, number] | null {
    const cp = region.center_point;
    if (cp && !Array.isArray(cp) && cp.type === "Point") {
        return [cp.coordinates[0], cp.coordinates[1]];
    }
    if (Array.isArray(cp) && cp.length >= 2) {
        return [Number(cp[0]), Number(cp[1])];
    }
    return null;
}

function regionPolygon(region: Region): GeoPolygon | null {
    const bbox = region.bbox;
    if (bbox && !Array.isArray(bbox) && bbox.type === "Polygon") {
        return { type: "Polygon", coordinates: bbox.coordinates };
    }
    return null;
}

export function RegionDetailPage() {
    const { regionId: regionIdParam } = useParams<{ regionId: string }>();
    const regionId = regionIdParam ?? "";
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const canEdit = !!user?.role?.some((r) => EDIT_ROLES.includes(r));
    const canApprove = canEdit;
    const isSuper = !!user?.role?.includes("super_admin");

    const [form, setForm] = useState<UpdateRegionPayload | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [weightInput, setWeightInput] = useState("");
    const [confirmWeight, setConfirmWeight] = useState(false);

    const { data: region, isLoading, error, refetch } = useQuery<Region>({
        queryKey: ["region-detail", regionId],
        queryFn: () => regionsService.getById(regionId),
        enabled: !!regionId,
        staleTime: 60 * 1000,
    });

    usePageTitle(region?.name);

    const hotspotsQuery = useQuery<{ hotspots: Region[]; total: number }>({
        queryKey: ["region-hotspots", regionId],
        queryFn: () => regionsService.getHotspots(regionId),
        enabled: !!regionId && region?.type === "city",
    });

    const parentQuery = useQuery<Region>({
        queryKey: ["region-detail", region?.parent_id],
        queryFn: () => regionsService.getById(region?.parent_id ?? ""),
        enabled: !!region?.parent_id,
        staleTime: 5 * 60 * 1000,
    });

    const updateMutation = useMutation({
        mutationFn: (payload: UpdateRegionPayload) => regionsService.update(regionId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["region-detail", regionId] });
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            toast.success("Region updated");
            setForm(null);
            setIsEditing(false);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update region"),
    });

    const weightMutation = useMutation({
        mutationFn: (weight: number) => regionsService.setAdminWeight(regionId, weight),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["region-detail", regionId] });
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            toast.success("Admin weight updated");
            setWeightInput("");
            setConfirmWeight(false);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to update admin weight");
            setConfirmWeight(false);
        },
    });

    // Neighbouring regions for the bbox editor's overlap-guard layer. Only fetched while editing.
    const allRegionsQuery = useQuery<Region[]>({
        queryKey: ["admin-regions-all-ref"],
        queryFn: () => regionsService.listAll(),
        enabled: isEditing,
        staleTime: 5 * 60 * 1000,
    });

    // Anchor on the region's stored bbox (not the live-edited box) so the neighbour set stays
    // stable while the admin drags the handles.
    const referenceBoxes = useMemo(
        () =>
            nearbyReferenceBoxes({
                regions: allRegionsQuery.data ?? [],
                anchor: region ? regionPolygon(region) : null,
                type: region?.type,
                excludeId: region?.id,
            }),
        [allRegionsQuery.data, region]
    );

    if (isLoading) return <LoadingState label="Loading region…" />;

    if (error || !region) {
        return (
            <Panel>
                <ErrorState title="Couldn't load this region" error={error ?? new Error("It may have been deleted.")} onRetry={error ? () => refetch() : undefined} />
                <div className="flex justify-center pb-6">
                    <ButtonLink to="/regions" variant="secondary">
                        Back to regions
                    </ButtonLink>
                </div>
            </Panel>
        );
    }

    const center = regionCenter(region);
    const polygon = regionPolygon(region);
    const points: GeoMapPoint[] = center ? [{ coordinates: center, label: region.name, color: "#00a49e" }] : [];

    const editValues: UpdateRegionPayload = form ?? {
        name: region.name,
        description: region.description ?? "",
        is_active: region.is_active,
        mapbox_place_id: region.mapbox_place_id ?? "",
    };

    const cancelEdit = () => {
        setForm(null);
        setIsEditing(false);
    };

    const applyWeight = () => {
        const w = Number(weightInput);
        if (!Number.isFinite(w) || w <= 0) {
            toast.error("Weight must be greater than 0");
            return;
        }
        setConfirmWeight(true);
    };

    const hotspots = hotspotsQuery.data?.hotspots ?? [];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Globe}
                title={region.name}
                badge={
                    <>
                        <Tag tone={region.type === "city" ? "brand" : "warn"} className="capitalize">
                            {region.type}
                        </Tag>
                        <StatusPill status={region.is_active ? "active" : "inactive"} label={region.is_active ? "Active" : "Inactive"} tone={region.is_active ? "good" : "neutral"} />
                    </>
                }
                description={
                    <>
                        <span className="font-mono text-xs">{region.slug}</span> · {region.marker_count.toLocaleString("en-IN")} places
                    </>
                }
                primaryAction={
                    canEdit &&
                    (isEditing ? (
                        <Button variant="secondary" icon={X} onClick={cancelEdit}>
                            Cancel editing
                        </Button>
                    ) : (
                        <Button variant="primary" icon={Edit2} onClick={() => setIsEditing(true)}>
                            Edit region
                        </Button>
                    ))
                }
            />

            {/* Read-only map — hidden while editing (the edit panel has its own bbox map). */}
            {!isEditing && (points.length > 0 || polygon) && (
                <Panel bodyClassName="p-0">
                    <GeoMap points={points} polygon={polygon} center={center} height="360px" zoom={10} />
                </Panel>
            )}

            {!isEditing && (
                <Panel title="Details" icon={Info}>
                    <DetailList>
                        <DetailRow label="Name" value={region.name} />
                        <DetailRow label="Mapbox place ID" value={<span className="font-mono text-xs">{region.mapbox_place_id || "—"}</span>} />
                        <DetailRow label="Description" value={<span className="whitespace-pre-wrap">{region.description || "—"}</span>} />
                        {region.type === "hotspot" && region.parent_id && (
                            <DetailRow label="Parent city" value={<IdLink kind="region" id={region.parent_id} label={parentQuery.data?.name} />} />
                        )}
                        <DetailRow label="Created" value={formatDateTime(region.created_at)} />
                        <DetailRow label="Last updated" value={formatDateTime(region.updated_at)} />
                    </DetailList>
                </Panel>
            )}

            {canEdit && isEditing && (
                <Panel title="Edit region" icon={Edit2}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="Name">
                                <TextInput type="text" value={editValues.name ?? ""} onChange={(e) => setForm({ ...editValues, name: e.target.value })} />
                            </Field>
                            <Field label="Mapbox place ID">
                                <TextInput
                                    type="text"
                                    className="font-mono"
                                    value={editValues.mapbox_place_id ?? ""}
                                    onChange={(e) => setForm({ ...editValues, mapbox_place_id: e.target.value })}
                                />
                            </Field>
                        </div>
                        <Field label="Description">
                            <TextArea rows={3} value={editValues.description ?? ""} onChange={(e) => setForm({ ...editValues, description: e.target.value })} />
                        </Field>
                        <Field
                            label="Boundary"
                            hint="Drag the corner handles to adjust the boundary, or redraw it. Saving updates the box and its center."
                            htmlFor="region-bbox"
                        >
                            <div id="region-bbox" className="overflow-hidden rounded-control border border-line">
                                <BboxDrawMap
                                    value={(editValues.bbox as GeoPolygon | undefined) ?? polygon}
                                    center={center}
                                    referenceBoxes={referenceBoxes}
                                    onChange={(poly, c) => setForm({ ...editValues, bbox: poly, center_point: c })}
                                    height="320px"
                                />
                            </div>
                        </Field>
                        <Switch
                            checked={editValues.is_active ?? false}
                            onChange={(v) => setForm({ ...editValues, is_active: v })}
                            label="Region active"
                            description="Inactive regions are hidden from the app."
                        />
                        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                            <Button variant="secondary" onClick={cancelEdit} disabled={updateMutation.isPending}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={() => updateMutation.mutate(editValues)} loading={updateMutation.isPending} disabled={!form}>
                                Save changes
                            </Button>
                        </div>
                    </div>
                </Panel>
            )}

            <CrowdMeterSection regionId={regionId} canApprove={canApprove} />

            {canApprove && (
                <Panel title="Ranking weight" icon={Scale} description="Affects where this region ranks in discovery.">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="text-sm text-ink-muted">
                            Current weight <span className="ml-1 text-lg font-semibold tabular-nums text-ink">{region.admin_weight}</span>
                        </div>
                        <Field label="New weight" hint="Greater than 0." className="w-36">
                            <TextInput type="number" min={0} step="0.1" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
                        </Field>
                        <Button variant="primary" onClick={applyWeight} disabled={weightInput === ""} className="mb-5">
                            Apply weight
                        </Button>
                    </div>
                </Panel>
            )}

            <TravelTimeMatrix regionId={regionId} canApprove={canApprove} />

            <LinkedQuests regionId={regionId} questIds={region.quest_ids} canEdit={canEdit} />

            {region.type === "city" && (
                <Panel title="Hotspots" icon={MapPin} description={hotspotsQuery.data ? `${hotspotsQuery.data.total ?? hotspots.length} in this city` : undefined}>
                    {hotspotsQuery.isLoading ? (
                        <LoadingState label="Loading hotspots…" className="min-h-[120px]" />
                    ) : hotspotsQuery.error ? (
                        <ErrorState error={hotspotsQuery.error} onRetry={() => hotspotsQuery.refetch()} compact />
                    ) : hotspots.length === 0 ? (
                        <EmptyState compact icon={MapPin} title="No hotspots in this city yet." />
                    ) : (
                        <ul className="divide-y divide-line">
                            {hotspots.map((h) => (
                                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                                    <Link to={`/regions/${h.id}`} className="min-w-0 truncate text-sm font-medium text-accent-700 hover:underline">
                                        {h.name}
                                    </Link>
                                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">{h.marker_count} places</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            )}

            <DangerZone regionId={regionId} regionName={region.name} canEdit={canEdit} isSuper={isSuper} />

            <ConfirmDialog
                open={confirmWeight}
                title="Apply ranking weight?"
                description={
                    <>
                        Set the admin weight to <strong className="text-ink">{weightInput}</strong>. This changes where the region ranks in discovery.
                    </>
                }
                confirmLabel="Apply"
                onConfirm={() => weightMutation.mutate(Number(weightInput))}
                onCancel={() => setConfirmWeight(false)}
                isPending={weightMutation.isPending}
            />
        </div>
    );
}
