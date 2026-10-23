import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Check, X, AlertTriangle, Store, CalendarRange, Megaphone } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Pagination } from "@/components/ui/Pagination";
import { Card } from "@/components/ui/Card";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { Chip, PageHeader, PanelState, ReasonModal, SegmentedTabs, StatusPill, btnSmApprove, btnSmReject } from "../components/CollabsUi";
import { MarkerLink } from "../components/CollabPickers";
import { fmtDate, fmtDateTime, humanize, totalPagesOf } from "../utils";
import type { AdminCollab, ModerationStatus } from "../types";

const FLAG_LABELS: Record<string, string> = {
    restricted_offer: "Restricted offer (alcohol/tobacco…)",
    profanity: "Profanity",
    contact_details: "Contact details in text",
    auto_hidden_reports: "Auto-hidden after reports",
    hidden_by_admin: "Hidden by admin",
};

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
            <Megaphone className="w-3.5 h-3.5 text-neutral-400" />
            {parts.map((p) => (
                <Chip key={p}>{p}</Chip>
            ))}
            {b.disclosure_label && <Chip tone="violet">{b.disclosure_label}</Chip>}
            {b.post_within_days ? <span className="text-[11px] text-neutral-500">post within {b.post_within_days}d</span> : null}
            {b.usage_rights && b.usage_rights !== "none" && <span className="text-[11px] text-neutral-500">· rights: {humanize(b.usage_rights)}</span>}
        </div>
    );
}

export function ModerationPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<ModerationStatus>("pending");
    const [page, setPage] = useState(1);
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
        <div className="space-y-5 animate-fade-in">
            <PageHeader
                icon={ShieldCheck}
                title="Moderation Queue"
                gradient="from-orange-500 to-orange-600"
                subtitle="Collabs held by the keyword screen or hidden after reports"
            />

            <SegmentedTabs<ModerationStatus>
                value={status}
                onChange={(v) => {
                    setStatus(v);
                    setPage(1);
                }}
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
                emptyText={status === "pending" ? "Nothing to review — the queue is clear" : `No ${status} collabs`}
                onRetry={() => refetch()}
            >
                <div className="space-y-3">
                    {collabs.map((c) => {
                        const pending = moderate.isPending && moderate.variables?.id === c.id;
                        return (
                            <Card key={c.id} padding="none" className="overflow-hidden">
                                <div className="p-5 space-y-3">
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-500">
                                                <Store className="w-3.5 h-3.5" />
                                                {c.business_id ? (
                                                    <Link to={`/collabs/businesses/${c.business_id}`} className="font-medium text-neutral-700 hover:underline">
                                                        {c.business_name ?? "Business"}
                                                    </Link>
                                                ) : (
                                                    <span>{c.business_name ?? "Unknown business"}</span>
                                                )}
                                                {c.marker_id && (
                                                    <>
                                                        <span>·</span>
                                                        <MarkerLink id={c.marker_id} />
                                                    </>
                                                )}
                                                <span>· {humanize(c.mode)}</span>
                                                <span>· created {fmtDate(c.created_at)}</span>
                                            </div>
                                            <h3 className="mt-1.5 text-lg font-semibold text-neutral-900">For: {c.offer}</h3>
                                            <p className="text-sm text-neutral-700">
                                                <span className="text-neutral-500">Wants:</span> {c.want || "—"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StatusPill status={c.moderation.status} />
                                            <StatusPill status={c.status} />
                                        </div>
                                    </div>

                                    {c.description && <p className="text-sm text-neutral-600 whitespace-pre-wrap bg-neutral-50 rounded-xl p-3 border border-neutral-100">{c.description}</p>}

                                    <BriefSummary collab={c} />

                                    <div className="flex items-center gap-3 flex-wrap text-xs text-neutral-500">
                                        <span className="inline-flex items-center gap-1">
                                            <CalendarRange className="w-3.5 h-3.5" />
                                            {c.valid_from || c.valid_until ? `${fmtDate(c.valid_from)} → ${fmtDate(c.valid_until)}` : "No validity window"}
                                        </span>
                                        <span>
                                            Slots {c.slots_used}/{c.slots_total}
                                        </span>
                                        <span>Min tier: {humanize(c.min_creator_tier)}</span>
                                        {c.allow_advance_requests && <Chip tone="teal">Advance requests</Chip>}
                                    </div>

                                    {c.moderation.flags.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            {c.moderation.flags.map((f) => (
                                                <Chip key={f} tone="amber">
                                                    {FLAG_LABELS[f] ?? humanize(f)}
                                                </Chip>
                                            ))}
                                        </div>
                                    )}

                                    {c.moderation.reason && (
                                        <p className="text-xs text-neutral-500">
                                            Review note: {c.moderation.reason}
                                            {c.moderation.reviewed_at ? ` · ${fmtDateTime(c.moderation.reviewed_at)}` : ""}
                                        </p>
                                    )}
                                </div>
                                <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex justify-end gap-2">
                                    {c.moderation.status !== "rejected" && (
                                        <button type="button" onClick={() => setRejecting(c)} disabled={pending} className={btnSmReject}>
                                            <X className="w-4 h-4" /> Reject
                                        </button>
                                    )}
                                    {c.moderation.status !== "approved" && (
                                        <button
                                            type="button"
                                            onClick={() => moderate.mutate({ id: c.id, decision: "approved" })}
                                            disabled={pending}
                                            className={btnSmApprove}
                                        >
                                            <Check className="w-4 h-4" /> Approve
                                        </button>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </PanelState>

            {data && (
                <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden empty:hidden">
                    <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} onPageChange={setPage} theme="orange" />
                </div>
            )}

            <ReasonModal
                open={!!rejecting}
                title="Reject collab"
                description={rejecting ? `“${rejecting.offer}” stays hidden from creators. The business sees the reason.` : undefined}
                placeholder="e.g. Alcohol promotion isn't allowed in collab offers"
                confirmLabel="Reject collab"
                isPending={moderate.isPending}
                onCancel={() => setRejecting(null)}
                onConfirm={(reason) => rejecting && moderate.mutate({ id: rejecting.id, decision: "rejected", reason })}
            />
        </div>
    );
}
