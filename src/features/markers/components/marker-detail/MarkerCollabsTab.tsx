import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { LoadingState } from "@/components/ui/States";
import { Notice } from "@/components/detail/DetailStates";
import { calendarDate, count } from "@/components/detail/detailFormat";
import { collabsAdminService } from "@/features/collabs/services/collabs-admin.service";
import { experiencesAdminService } from "@/features/collabs/services/experiences-admin.service";
import type { AdminCollab, AdminExperience } from "@/features/collabs/types";
import { useMarkerBusiness } from "./useMarkerBusiness";

type ExperienceRow = AdminExperience & { marker_id?: string | null };

/** Collabs and experiences that happen at this place. */
export function MarkerCollabsTab({ markerId }: { markerId: string }) {
    const navigate = useNavigate();
    const { business, isLoading } = useMarkerBusiness(markerId);

    const collabs = useQuery({
        queryKey: ["collabs-admin-collabs", { business_id: business?.id, page: 1 }],
        queryFn: () => collabsAdminService.listCollabs({ business_id: business?.id, page: 1 }),
        enabled: !!business?.id,
        staleTime: 30_000,
    });
    const experiences = useQuery({
        queryKey: ["admin-experiences", { business_id: business?.id }],
        queryFn: () => experiencesAdminService.list({ business_id: business?.id }),
        enabled: !!business?.id,
        staleTime: 30_000,
    });

    if (isLoading) return <LoadingState />;
    if (!business) {
        return (
            <Panel>
                <Notice tone="info" title="No business runs this place (that we can see)">
                    Collabs and experiences belong to a business. Link one on the Owner tab to see them here.
                </Notice>
            </Panel>
        );
    }

    const placeCollabs = (collabs.data?.collabs ?? []).filter((c) => c.marker_id === markerId);
    const placeExperiences = ((experiences.data?.experiences ?? []) as ExperienceRow[]).filter((e) => e.marker_id === markerId);

    const collabColumns: DataColumn<AdminCollab>[] = [
        { id: "offer", header: "Offer", hideable: false, cell: (c) => <span className="font-medium text-ink">{c.offer}</span> },
        { id: "status", header: "Status", cell: (c) => <StatusPill status={c.status} /> },
        { id: "review", header: "Review", cell: (c) => <StatusPill status={c.moderation?.status} /> },
        { id: "slots", header: "Slots", align: "right", cell: (c) => <span className="tabular-nums">{c.slots_used}/{c.slots_total}</span> },
    ];
    const expColumns: DataColumn<ExperienceRow>[] = [
        { id: "title", header: "Experience", hideable: false, cell: (e) => <span className="font-medium text-ink">{e.title}</span> },
        { id: "status", header: "Status", cell: (e) => <StatusPill status={e.hidden_by_admin ? "hidden" : e.status} /> },
        { id: "next", header: "Next date", cell: (e) => <span className="text-ink-muted">{calendarDate(e.next_date)}</span> },
        { id: "bookings", header: "Bookings", align: "right", cell: (e) => <span className="tabular-nums">{count(e.stats?.bookings)}</span> },
    ];

    return (
        <div className="space-y-5">
            <p className="text-sm text-ink-muted">
                Run by{" "}
                <Link to={`/collabs/businesses/${business.id}`} className="font-medium text-accent-700 hover:underline">
                    {business.name ?? business.id}
                </Link>
            </p>
            <Panel title={`Collabs here (${placeCollabs.length})`} icon={Sparkles} bodyClassName="p-0">
                <DataTable
                    label="Collabs at this place"
                    rows={placeCollabs}
                    columns={collabColumns}
                    rowKey={(c) => c.id}
                    isLoading={collabs.isLoading}
                    error={collabs.error}
                    onRetry={() => collabs.refetch()}
                    toolbar={false}
                    frame="bare"
                    onRowClick={() => navigate(`/collabs/businesses/${business.id}?tab=collabs`)}
                    empty={{ icon: Sparkles, title: "No collabs at this place" }}
                    card={{ title: (c) => c.offer, fields: ["status", "review", "slots"] }}
                />
            </Panel>
            <Panel title={`Experiences here (${placeExperiences.length})`} icon={CalendarRange} bodyClassName="p-0">
                <DataTable
                    label="Experiences at this place"
                    rows={placeExperiences}
                    columns={expColumns}
                    rowKey={(e) => e.id}
                    isLoading={experiences.isLoading}
                    error={experiences.error}
                    onRetry={() => experiences.refetch()}
                    toolbar={false}
                    frame="bare"
                    onRowClick={(e) => navigate(`/collabs/experiences/${e.id}`)}
                    empty={{ icon: CalendarRange, title: "No experiences at this place" }}
                    card={{ title: (e) => e.title, fields: ["status", "next", "bookings"] }}
                />
            </Panel>
        </div>
    );
}
