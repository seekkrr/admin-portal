import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Check, X, AlertTriangle, Store, CalendarRange, Megaphone } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PanelState } from "@/components/ui/States";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDate, formatDateTime } from "@/utils/date";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { MarkerLink } from "../components/CollabPickers";
import { humanize, totalPagesOf } from "../utils";
import type { AdminCollab, ModerationStatus } from "../types";

const FLAG_LABELS: Record<string, string> = {
    restricted_offer: "Restricted offer (alcohol/tobacco…)",
    profanity: "Profanity",
    contact_details: "Contact details in text",
    auto_hidden_reports: "Auto-hidden after reports",
    hidden_by_admin: "Hidden by admin",
};

const STATUSES: ModerationStatus[] = ["pending", "approved", "rejected"];

function BriefSummary({ collab }: { collab: AdminCollab }) {
    const b = collab.brief;
    if (!b) return null;
    const parts = [
        ...(b.deliverables ?? []).map((d) => `${d.count} ${d.count === 1 ? d.type : d.type === "story" ? "stories" : `${d.type}s`}`),
        ...(b.tag_handles ?? []).map((h) => (h.startsWith("@") ? h : `@${h}`)),
        ...(b.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)),
    ];
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
            {parts.map((p) => (
                <Tag key={p}>{p}</Tag>
            ))}
            {b.disclosure_label && <Tag tone="info">{b.disclosure_label}</Tag>}
            {b.post_within_days ? <span className="text-xs text-ink-muted">post within {b.post_within_days}d</span> : null}
            {b.usage_rights && b.usage_rights !== "none" && <span className="text-xs text-ink-muted">· rights: {humanize(b.usage_rights)}</span>}
        </div>
    );
}

export function ModerationPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const { state, set } = useUrlState({ status: "pending", page: 1 });
    const status: ModerationStatus = STATUSES.includes(state.status as ModerationStatus) ? (state.status as ModerationStatus) : "pending";
    const page = Math.max(1, state.page);
    const [rejecting, setRejecting] = useState<AdminCollab | null>(null);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["collabs-moderation", status, page],
        queryFn: () => collabsAdminService.moderationQueue({ status, page }),
        enabled: isStaff,
        placeholderData: (prev) => prev,
    });

    const moderate = useMutation({
        mutationFn: ({ id, decision, reason }: { id: string; decision: "approved" | "rejected"; reason?: string }) =>
            collabsAdminService.moderate(id, decision, reason),
        onSuccess: (_c, vars) => {
            toast.success(vars.decision === "approved" ? "Collab approved — now visible to creators" : "Collab rejected");
            setRejecting(null);
            queryClient.invalidateQueries({ queryKey: ["collabs-moderation"] });
            queryClient.invalidateQueries({ queryKey: ["collabs-analytics"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to moderate collab"),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to moderate collabs." />;

    const collabs = data?.collabs ?? [];

    return (
        <div className="space-y-5">
            <PageHeader icon={ShieldCheck} title="Moderation" description="Collabs held by the keyword screen or hidden after reports" />

            <Tabs<ModerationStatus>
                label="Moderation status"
                value={status}
                onChange={(v) => set({ status: v })}
                tabs={[
                    { value: "pending", label: "Pending", count: status === "pending" ? data?.total : undefined },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                ]}
            />

            <PanelState
                isLoading={isLoading && !data}
                error={error}
                isEmpty={collabs.length === 0}
                emptyIcon={ShieldCheck}
                emptyText={status === "pending" ? "Nothing to review. The queue is clear." : `No ${status} collabs`}
                onRetry={() => refetch()}
            >
                <ul className="space-y-3">
                    {collabs.map((c) => {
                        const pending = moderate.isPending && moderate.variables?.id === c.id;
                        return (
                            <li key={c.id} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                                <div className="space-y-3 p-4 sm:p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                                                <Store className="h-3.5 w-3.5" aria-hidden />
                                                {c.business_id ? (
                                                    <IdLink kind="business" id={c.business_id} label={c.business_name ?? "Business"} />
                                                ) : (
                                                    <span>{c.business_name ?? "Unknown business"}</span>
                                                )}
                                                {c.marker_id && (
                                                    <>
                                                        <span aria-hidden>·</span>
                                                        <MarkerLink id={c.marker_id} />
                                                    </>
                                                )}
                                                <span>· {humanize(c.mode)}</span>
                                                <span>· created {formatDate(c.created_at)}</span>
                                            </div>
                                            <h2 className="mt-1.5 text-base font-semibold text-ink sm:text-lg">For: {c.offer}</h2>
                                            <p className="text-sm text-ink">
                                                <span className="text-ink-muted">Wants:</span> {c.want || "—"}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <StatusPill status={c.moderation.status} />
                                            <StatusPill status={c.status} />
                                        </div>
                                    </div>

                                    {c.description && (
                                        <p className="whitespace-pre-wrap rounded-control border border-line bg-surface-muted p-3 text-sm text-ink">{c.description}</p>
                                    )}

                                    <BriefSummary collab={c} />

                                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                                        <span className="inline-flex items-center gap-1">
                                            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                                            {c.valid_from || c.valid_until ? `${formatDate(c.valid_from)} → ${formatDate(c.valid_until)}` : "No validity window"}
                                        </span>
                                        <span>
                                            Slots {c.slots_used}/{c.slots_total}
                                        </span>
                                        <span>Min tier: {humanize(c.min_creator_tier)}</span>
                                        {c.allow_advance_requests && <Tag tone="brand">Advance requests</Tag>}
                                    </div>

                                    {c.moderation.flags.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <AlertTriangle className="h-3.5 w-3.5 text-warn" aria-hidden />
                                            {c.moderation.flags.map((f) => (
                                                <Tag key={f} tone="warn">
                                                    {FLAG_LABELS[f] ?? humanize(f)}
                                                </Tag>
                                            ))}
                                        </div>
                                    )}

                                    {c.moderation.reason && (
                                        <p className="text-xs text-ink-muted">
                                            Review note: {c.moderation.reason}
                                            {c.moderation.reviewed_at ? ` · ${formatDateTime(c.moderation.reviewed_at)}` : ""}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-muted px-4 py-3 sm:px-5">
                                    {c.moderation.status !== "rejected" && (
                                        <Button size="sm" variant="secondary" icon={X} onClick={() => setRejecting(c)} disabled={pending}>
                                            Reject
                                        </Button>
                                    )}
                                    {c.moderation.status !== "approved" && (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            icon={Check}
                                            loading={pending && moderate.variables?.decision === "approved"}
                                            disabled={pending}
                                            onClick={() => moderate.mutate({ id: c.id, decision: "approved" })}
                                        >
                                            Approve
                                        </Button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </PanelState>

            {data && totalPagesOf(data) > 1 && (
                <div className="overflow-hidden rounded-card border border-line">
                    <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} pageSize={data.page_size} onPageChange={(p) => set({ page: p })} />
                </div>
            )}

            <ConfirmDialog
                open={!!rejecting}
                title="Reject collab?"
                description={rejecting ? `“${rejecting.offer}” stays hidden from creators. The business sees the reason.` : undefined}
                level="reason"
                reasonPlaceholder="e.g. Alcohol promotion isn't allowed in collab offers"
                confirmLabel="Reject collab"
                tone="danger"
                isPending={moderate.isPending}
                onCancel={() => setRejecting(null)}
                onConfirm={(reason) => rejecting && moderate.mutate({ id: rejecting.id, decision: "rejected", reason })}
            />
        </div>
    );
}
