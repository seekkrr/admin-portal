import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, EyeOff, MapPin, Trash2 } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/Field";
import { ChangeHistoryPanel } from "@/components/detail/ChangeHistoryPanel";
import { useAdminAccess } from "@/components/detail/useAdminAccess";
import { useDetailTab } from "@/components/detail/useDetailTab";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Marker } from "@/types";
import type { MarkerExtras } from "@/types/admin-detail";
import { markersService } from "../services/markers.service";
import { MarkerDetailsTab } from "../components/marker-detail/MarkerDetailsTab";
import { MarkerLocationTab } from "../components/marker-detail/MarkerLocationTab";
import { MarkerPhotosTab } from "../components/marker-detail/MarkerPhotosTab";
import { MarkerOwnerTab } from "../components/marker-detail/MarkerOwnerTab";
import { MarkerCollabsTab } from "../components/marker-detail/MarkerCollabsTab";
import { MarkerActivityTab } from "../components/marker-detail/MarkerActivityTab";

const TABS = ["details", "location", "photos", "owner", "collabs", "activity", "history"] as const;
type Tab = (typeof TABS)[number];

type PlaceFull = Marker & MarkerExtras;

/** One place: details, location (move the pin), photos, owner/business, collabs, activity, history. */
export function MarkerDetailPage() {
    const { markerId = "" } = useParams<{ markerId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isStaff, isAdmin, isSuperAdmin } = useAdminAccess();
    const [tab, setTab] = useDetailTab<Tab>(TABS, "details");
    const [deleting, setDeleting] = useState(false);
    const [hard, setHard] = useState(false);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["marker-detail", markerId],
        queryFn: () => markersService.getById(markerId),
        enabled: isStaff && !!markerId,
    });
    const marker = data as PlaceFull | undefined;
    usePageTitle(marker?.title);

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["marker-detail", markerId] });
        queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
        queryClient.invalidateQueries({ queryKey: ["admin-audit", "place", markerId] });
    };

    const remove = useMutation({
        mutationFn: () => markersService.remove(markerId, isSuperAdmin && hard),
        onSuccess: () => {
            toast.success(hard ? "Place permanently deleted" : "Place deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            navigate("/markers", { replace: true });
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't delete the place"),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to view places." />;
    if (isLoading) return <LoadingState label="Loading place…" />;
    if (error || !marker) return <ErrorState title="Couldn't load this place" error={error ?? new Error("Place not found.")} onRetry={() => refetch()} />;

    const cover = marker.media?.find(Boolean);

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-4">
                {cover ? (
                    <img src={cover} alt="" className="h-14 w-14 shrink-0 rounded-card border border-line object-cover" />
                ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-brand-900 text-white">
                        <MapPin className="h-6 w-6" aria-hidden />
                    </span>
                )}
                <PageHeader
                    className="min-w-0 flex-1"
                    title={marker.title}
                    badge={<StatusPill status={marker.status} />}
                    description={
                        <span className="flex flex-col gap-1.5">
                            <span>
                                {(marker.categories ?? []).join(", ") || "No category"}
                                {marker.region_name ? ` · ${marker.region_name}` : ""}
                            </span>
                            {(marker.hidden || (marker.sub_categories ?? []).length > 0) && (
                                <span className="flex flex-wrap gap-1.5">
                                    {marker.hidden && (
                                        <Tag tone="bad">
                                            <EyeOff className="h-3 w-3" aria-hidden /> Hidden
                                        </Tag>
                                    )}
                                    {(marker.sub_categories ?? []).slice(0, 4).map((s) => (
                                        <Tag key={s}>{s}</Tag>
                                    ))}
                                </span>
                            )}
                        </span>
                    }
                    menu={[
                        {
                            label: "Copy place ID",
                            icon: Copy,
                            onSelect: () => {
                                navigator.clipboard
                                    .writeText(marker.id)
                                    .then(() => toast.success("Place ID copied"))
                                    .catch(() => toast.error("Couldn't copy"));
                            },
                        },
                        { label: "Delete place", icon: Trash2, danger: true, hidden: !isAdmin, onSelect: () => setDeleting(true) },
                    ]}
                />
            </div>

            <Tabs<Tab>
                label="Place sections"
                idPrefix="place"
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: "details", label: "Details" },
                    { value: "location", label: "Location" },
                    { value: "photos", label: "Photos", count: (marker.media ?? []).filter(Boolean).length },
                    { value: "owner", label: "Owner & business" },
                    { value: "collabs", label: "Collabs & experiences" },
                    { value: "activity", label: "Check-ins & reviews" },
                    { value: "history", label: "Change history" },
                ]}
            />

            <div role="tabpanel" id={`place-panel-${tab}`} aria-labelledby={`place-tab-${tab}`}>
                {tab === "details" && <MarkerDetailsTab marker={marker} canEdit={isAdmin} onSaved={refresh} />}
                {tab === "location" && <MarkerLocationTab marker={marker} canEdit={isAdmin} onSaved={refresh} />}
                {tab === "photos" && <MarkerPhotosTab marker={marker} canEdit={isAdmin} onSaved={refresh} />}
                {tab === "owner" && <MarkerOwnerTab marker={marker} canEdit={isAdmin} onSaved={refresh} />}
                {tab === "collabs" && <MarkerCollabsTab markerId={marker.id} />}
                {tab === "activity" && <MarkerActivityTab marker={marker} canEdit={isAdmin} />}
                {tab === "history" && <ChangeHistoryPanel entityType="place" entityId={marker.id} />}
            </div>

            <ConfirmDialog
                open={deleting}
                title={hard ? "Permanently delete this place?" : "Delete this place?"}
                description={hard ? "It's removed for good, with its photos and links." : "It's removed from the app. It can be restored from the database if needed."}
                confirmLabel={hard ? "Delete permanently" : "Delete"}
                tone="danger"
                level={hard ? "type" : "simple"}
                typeToConfirm={marker.title}
                isPending={remove.isPending}
                onConfirm={() => remove.mutate()}
                onCancel={() => {
                    setDeleting(false);
                    setHard(false);
                }}
            >
                {isSuperAdmin && <Checkbox checked={hard} onChange={setHard} label="Delete permanently" hint="Can't be undone." />}
            </ConfirmDialog>
        </div>
    );
}

export default MarkerDetailPage;
