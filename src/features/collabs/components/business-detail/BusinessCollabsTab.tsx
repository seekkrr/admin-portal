import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, GitPullRequestArrow, Pause, Play, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { buttonClass } from "@/components/ui/buttonStyles";
import { businessDetailApi } from "@/services/admin-detail.service";
import { formatDate } from "@/utils/date";
import { collabsAdminService } from "../../services/collabs-admin.service";
import { featuresOf, humanize, partnerPortalNewBriefUrl, totalPagesOf } from "../../utils";
import type { AdminBusiness, AdminCollab } from "../../types";
import { Notice } from "@/components/detail/DetailStates";

/** The business's collabs with status; open or pause them. */
export function BusinessCollabsTab({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [pausing, setPausing] = useState<AdminCollab | null>(null);
    const collabsOn = featuresOf(business).collabs;

    const query = useQuery({
        queryKey: ["collabs-admin-collabs", { business_id: business.id, page }],
        queryFn: () => collabsAdminService.listCollabs({ business_id: business.id, page }),
        staleTime: 30_000,
        placeholderData: (prev) => prev,
    });

    const setStatus = useMutation({
        mutationFn: ({ collab, status }: { collab: AdminCollab; status: "active" | "paused" }) =>
            businessDetailApi.setCollabStatus(business.id, collab.id, status),
        onSuccess: (_, { status }) => {
            toast.success(status === "active" ? "Collab is open" : "Collab paused");
            setPausing(null);
            queryClient.invalidateQueries({ queryKey: ["collabs-admin-collabs"] });
            queryClient.invalidateQueries({ queryKey: ["admin-audit", "business", business.id] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const columns: DataColumn<AdminCollab>[] = [
        {
            id: "offer",
            header: "Offer",
            hideable: false,
            sortValue: (c) => c.offer,
            cell: (c) => (
                <div className="min-w-0">
                    <div className="font-medium text-ink">{c.offer}</div>
                    <div className="max-w-[320px] truncate text-xs text-ink-muted">Wants: {c.want || "—"}</div>
                </div>
            ),
        },
        { id: "mode", header: "Mode", sortValue: (c) => c.mode, cell: (c) => <span className="text-ink-muted">{humanize(c.mode)}</span> },
        { id: "status", header: "Status", sortValue: (c) => c.status, cell: (c) => <StatusPill status={c.status} /> },
        { id: "moderation", header: "Review", cell: (c) => <StatusPill status={c.moderation?.status} /> },
        {
            id: "slots",
            header: "Slots",
            align: "right",
            sortValue: (c) => c.slots_used,
            cell: (c) => (
                <span className="tabular-nums text-ink-muted">
                    {c.slots_used}/{c.slots_total}
                </span>
            ),
        },
        { id: "until", header: "Valid until", sortValue: (c) => c.valid_until ?? "", cell: (c) => <span className="text-ink-muted">{formatDate(c.valid_until)}</span> },
    ];

    const collabs = query.data?.collabs ?? [];

    return (
        <div className="space-y-4">
            {!collabsOn && <Notice tone="warn" title="Collabs are off for this business">Turn them on in the Overview tab to open or pause collabs.</Notice>}
            <Panel
                title={`Collabs${query.data ? ` (${query.data.total})` : ""}`}
                icon={Sparkles}
                bodyClassName="p-0"
                actions={
                    <span className="flex flex-wrap gap-2">
                        <Link to={`/collabs/applications?business_id=${business.id}`} className={buttonClass("ghost", "sm")}>
                            <GitPullRequestArrow className="h-3.5 w-3.5" aria-hidden /> Requests
                        </Link>
                        {/* Posting happens in the Partner Portal's admin view, as the business. */}
                        {collabsOn && (
                            <a
                                href={partnerPortalNewBriefUrl(business.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonClass("primary", "sm")}
                                title="Opens the Partner Portal as this business with a new UGC brief. Sign in there with your admin account."
                            >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Post a UGC brief
                            </a>
                        )}
                    </span>
                }
            >
                <DataTable
                    label="Collabs"
                    rows={collabs}
                    columns={columns}
                    rowKey={(c) => c.id}
                    isLoading={query.isLoading}
                    isFetching={query.isFetching}
                    error={query.error}
                    onRetry={() => query.refetch()}
                    toolbar={false}
                    frame="bare"
                    empty={{ icon: Sparkles, title: "No collabs posted yet" }}
                    card={{ title: (c) => c.offer, subtitle: (c) => `Wants: ${c.want || "—"}`, fields: ["status", "moderation", "slots", "until"] }}
                    rowActions={
                        canEdit
                            ? (c) =>
                                  c.status === "active" ? (
                                      <Button size="sm" variant="secondary" icon={Pause} disabled={!collabsOn} onClick={() => setPausing(c)}>
                                          Pause
                                      </Button>
                                  ) : c.status === "paused" ? (
                                      <Button
                                          size="sm"
                                          variant="secondary"
                                          icon={Play}
                                          disabled={!collabsOn}
                                          loading={setStatus.isPending && setStatus.variables?.collab.id === c.id}
                                          onClick={() => setStatus.mutate({ collab: c, status: "active" })}
                                      >
                                          Open
                                      </Button>
                                  ) : null
                            : undefined
                    }
                    footer={
                        query.data && totalPagesOf(query.data) > 1 ? (
                            <Pagination
                                page={page}
                                totalPages={totalPagesOf(query.data)}
                                total={query.data.total}
                                pageSize={query.data.page_size}
                                onPageChange={setPage}
                            />
                        ) : undefined
                    }
                />
            </Panel>
            <ConfirmDialog
                open={!!pausing}
                title="Pause this collab?"
                description={`"${pausing?.offer ?? ""}" stops taking new requests. Creators already approved keep their visit.`}
                confirmLabel="Pause collab"
                tone="warning"
                isPending={setStatus.isPending}
                onConfirm={() => pausing && setStatus.mutate({ collab: pausing, status: "paused" })}
                onCancel={() => setPausing(null)}
            />
        </div>
    );
}
