import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GitPullRequestArrow, Zap, ExternalLink, CheckCircle2, XCircle, Star, History, Link as LinkIcon, Lock } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Drawer } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, SelectInput, TextArea } from "@/components/ui/Field";
import { DetailList, DetailRow } from "@/components/ui/Panel";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDate, formatDateTime } from "@/utils/date";
import { cx } from "@/utils/cx";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { MarkerLink } from "../components/CollabPickers";
import { DrawerSection } from "../components/AdminBits";
import { humanize, totalPagesOf } from "../utils";
import { APPLICATION_STATUSES, type AdminCollabApplication, type ApplicationRating } from "../types";

const STATUS_OPTIONS: FilterOption[] = APPLICATION_STATUSES.map((s) => ({ value: s, label: humanize(s) }));

function Timeline({ app }: { app: AdminCollabApplication }) {
    const items = [...(app.timeline ?? [])];
    if (items.length === 0) return <p className="text-sm text-ink-faint">No timeline entries.</p>;
    return (
        <ol className="relative ml-2 space-y-4 border-l-2 border-line">
            {items.map((t, i) => (
                <li key={`${t.status}-${t.at}-${i}`} className="ml-4">
                    <span className={cx("absolute -left-[7px] mt-1 h-3 w-3 rounded-full ring-4 ring-surface", i === items.length - 1 ? "bg-accent-500" : "bg-line-strong")} />
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={t.status} />
                        <span className="text-xs text-ink-muted">{formatDateTime(t.at)}</span>
                    </div>
                </li>
            ))}
        </ol>
    );
}

function Stars({ score }: { score: number }) {
    return (
        <span className="inline-flex items-center gap-0.5" aria-label={`${score} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cx("h-4 w-4", n <= score ? "fill-highlight text-highlight" : "text-line-strong")} aria-hidden />
            ))}
            <span className="ml-1.5 text-xs font-medium text-ink-muted">{score}/5</span>
        </span>
    );
}

function ReviewCard({ label, review }: { label: string; review: ApplicationRating | null }) {
    return (
        <div className="space-y-1.5 rounded-control border border-line bg-surface-muted p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
            {review ? (
                <>
                    <Stars score={review.score} />
                    {review.comment ? (
                        <p className="whitespace-pre-line break-words text-sm text-ink">{review.comment}</p>
                    ) : (
                        <p className="text-sm italic text-ink-faint">No comment</p>
                    )}
                    <p className="text-xs text-ink-muted">
                        {review.by_name ?? "Unknown"}
                        {review.by && (
                            <>
                                {" "}
                                <IdLink kind="user" id={review.by} />
                            </>
                        )}
                        {" · "}
                        {formatDateTime(review.at)}
                    </p>
                </>
            ) : (
                <p className="text-sm text-ink-faint">Not reviewed yet</p>
            )}
        </div>
    );
}

function visitText(a: AdminCollabApplication): string {
    if (a.visit_window) return `${formatDate(a.visit_window.from)} → ${formatDate(a.visit_window.to)}`;
    if (a.due_at) return `Due ${formatDate(a.due_at)}`;
    return "—";
}

export function CollabApplicationsPage() {
    const { isStaff, isAdmin } = useCollabAccess();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { state, set, reset } = useUrlState({ status: "", business_id: "", creator_user_id: "", page: 1 });
    const status = STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "";
    const page = Math.max(1, state.page);
    const [selected, setSelected] = useState<AdminCollabApplication | null>(null);
    const [forceOpen, setForceOpen] = useState(false);
    const [forceStatus, setForceStatus] = useState("");
    const [forceReason, setForceReason] = useState("");

    const params = {
        status: status || undefined,
        business_id: state.business_id || undefined,
        creator_user_id: state.creator_user_id || undefined,
        page,
    };
    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["collabs-applications", params],
        queryFn: () => collabsAdminService.listApplications(params),
        enabled: isStaff,
        placeholderData: (prev) => prev,
    });

    const force = useMutation({
        mutationFn: () => collabsAdminService.forceTransition(selected?.id ?? "", forceStatus, forceReason.trim()),
        onSuccess: (app) => {
            toast.success(`Application moved to ${humanize(app.status)}`);
            setSelected((prev) => (prev ? { ...prev, ...app } : app));
            setForceOpen(false);
            queryClient.invalidateQueries({ queryKey: ["collabs-applications"] });
            queryClient.invalidateQueries({ queryKey: ["collabs-analytics"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to force transition"),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to view collab requests." />;

    const apps = data?.applications ?? [];

    const openForce = () => {
        setForceStatus("");
        setForceReason("");
        setForceOpen(true);
    };

    const columns: DataColumn<AdminCollabApplication>[] = [
        {
            id: "creator",
            header: "Creator",
            hideable: false,
            sortValue: (a) => a.creator_name ?? "",
            csv: (a) => `${a.creator_name ?? ""} ${a.creator_user_id ?? ""}`.trim(),
            cell: (a) => (
                <div className="min-w-0">
                    <div className="font-medium text-ink">{a.creator_name ?? "Creator"}</div>
                    <IdLink kind="user" id={a.creator_user_id} />
                </div>
            ),
        },
        {
            id: "business",
            header: "Business",
            sortValue: (a) => a.business_name ?? "",
            csv: (a) => a.business_name ?? a.business_id ?? "",
            cell: (a) => (a.business_id ? <IdLink kind="business" id={a.business_id} label={a.business_name ?? "Business"} /> : <span className="text-ink-faint">—</span>),
        },
        { id: "source", header: "Source", sortValue: (a) => a.source, csv: (a) => humanize(a.source), cell: (a) => <span className="text-ink-muted">{humanize(a.source)}</span> },
        { id: "status", header: "Status", sortValue: (a) => a.status, cell: (a) => <StatusPill status={a.status} /> },
        { id: "visit", header: "Visit / due", csv: (a) => visitText(a), cell: (a) => <span className="whitespace-nowrap text-xs text-ink-muted">{visitText(a)}</span> },
        {
            id: "updated",
            header: "Updated",
            sortValue: (a) => a.updated_at ?? a.created_at ?? "",
            csv: (a) => formatDateTime(a.updated_at ?? a.created_at),
            cell: (a) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(a.updated_at ?? a.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });
    if (state.business_id) chips.push({ key: "business", label: "Business filter", onRemove: () => set({ business_id: "" }) });
    if (state.creator_user_id) chips.push({ key: "creator", label: "Creator filter", onRemove: () => set({ creator_user_id: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={GitPullRequestArrow}
                title="Collab requests"
                description={
                    <>
                        Walk-ins, advance requests and invites
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
            />

            <FilterBar chips={chips} onReset={reset}>
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                <EntityPicker type="business" variant="filter" label="Business" value={state.business_id} onChange={(id) => set({ business_id: id })} placeholder="Business…" />
                <EntityPicker type="user" variant="filter" label="Creator" value={state.creator_user_id} onChange={(id) => set({ creator_user_id: id })} placeholder="Creator…" />
            </FilterBar>

            <DataTable
                label="Collab requests"
                rows={apps}
                columns={columns}
                rowKey={(a) => a.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: GitPullRequestArrow, title: "No collab requests match", description: chips.length ? "Try clearing a filter." : undefined }}
                onRowClick={setSelected}
                storageKey="collab-requests"
                exportName="collab-requests"
                summary={data ? `${apps.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (a) => `${a.creator_name ?? "Creator"} × ${a.business_name ?? "Business"}`,
                    subtitle: (a) => humanize(a.source),
                    fields: ["status", "visit", "updated"],
                }}
                footer={
                    data && (
                        <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} pageSize={data.page_size} onPageChange={(p) => set({ page: p })} />
                    )
                }
            />

            <Drawer
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected ? `${selected.creator_name ?? "Creator"} × ${selected.business_name ?? "Business"}` : ""}
                subtitle={selected && <span className="font-mono">{selected.id}</span>}
                footer={
                    selected &&
                    (isAdmin ? (
                        <Button variant="danger" icon={Zap} block onClick={openForce}>
                            Force transition
                        </Button>
                    ) : (
                        <p className="text-center text-xs text-ink-muted">Forced transitions need an admin.</p>
                    ))
                }
            >
                {selected && (
                    <>
                        <DetailList>
                            <DetailRow label="Status" value={<StatusPill status={selected.status} />} />
                            <DetailRow label="Source" value={humanize(selected.source)} />
                            <DetailRow
                                label="Business"
                                value={selected.business_id ? <IdLink kind="business" id={selected.business_id} label={selected.business_name ?? selected.business_id} /> : "—"}
                            />
                            <DetailRow
                                label="Creator"
                                value={
                                    selected.creator_user_id ? (
                                        <span className="flex flex-wrap items-center gap-2">
                                            <IdLink kind="user" id={selected.creator_user_id} label={selected.creator_name ?? undefined} />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelected(null);
                                                    navigate(`/collabs/applications?creator_user_id=${selected.creator_user_id}`);
                                                }}
                                                className="text-xs font-medium text-accent-700 hover:underline"
                                            >
                                                All their requests
                                            </button>
                                        </span>
                                    ) : (
                                        "—"
                                    )
                                }
                            />
                            <DetailRow label="Collab" value={selected.collab_id ? <span className="font-mono text-xs">{selected.collab_id}</span> : "—"} />
                            <DetailRow label="Place" value={selected.marker_id ? <MarkerLink id={selected.marker_id} /> : "—"} />
                            {selected.visit_window && (
                                <DetailRow label="Visit window" value={`${formatDate(selected.visit_window.from)} → ${formatDate(selected.visit_window.to)}`} />
                            )}
                            {selected.redemption && (
                                <DetailRow
                                    label="Redeemed"
                                    value={`${formatDateTime(selected.redemption.at)} via ${selected.redemption.method === "staff_qr" ? "staff QR scan" : "redeem code"}`}
                                />
                            )}
                            <DetailRow label="Deliverables due" value={formatDateTime(selected.due_at)} />
                            {selected.tracking_code && <DetailRow label="Tracking link" value={<span className="font-mono text-xs">seekkrr.com/t/{selected.tracking_code}</span>} />}
                            {selected.note && <DetailRow label="Creator note" value={selected.note} />}
                            {selected.decline_reason && <DetailRow label="Decline reason" value={selected.decline_reason} />}
                        </DetailList>

                        {selected.deliverables.length > 0 && (
                            <DrawerSection title="Deliverables" icon={LinkIcon}>
                                {selected.deliverables.map((d) => (
                                    <div key={d.url} className="space-y-1 rounded-control border border-line bg-surface-muted p-3">
                                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 break-all text-sm text-accent-700 hover:underline">
                                            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden /> {d.url}
                                        </a>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                            <Tag>{humanize(d.type)}</Tag>
                                            <span>{formatDateTime(d.submitted_at)}</span>
                                            {d.auto_check &&
                                                (d.auto_check.ok ? (
                                                    <span className="inline-flex items-center gap-1 text-good">
                                                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Link verified{d.auto_check.author ? ` (${d.auto_check.author})` : ""}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-warn">
                                                        <XCircle className="h-3.5 w-3.5" aria-hidden /> {d.auto_check.reason ?? "Unverified"}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </DrawerSection>
                        )}

                        <DrawerSection title="Reviews" icon={Star}>
                            <ReviewCard label="Business → creator" review={selected.ratings?.business_to_creator ?? null} />
                            <ReviewCard label="Creator → business" review={selected.ratings?.creator_to_business ?? null} />
                            <p className="flex items-start gap-1.5 text-xs text-ink-faint">
                                <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                                Reviews are private: the business and the creator never see each other&apos;s review.
                            </p>
                        </DrawerSection>

                        <DrawerSection title="Timeline" icon={History}>
                            <Timeline app={selected} />
                            <p className="text-xs text-ink-faint">Forced transitions are recorded with their reason in the change history.</p>
                        </DrawerSection>
                    </>
                )}
            </Drawer>

            <ConfirmDialog
                open={forceOpen && !!selected}
                tone="danger"
                title="Force transition?"
                description={
                    selected
                        ? `Move this application from “${humanize(selected.status)}” to a new state, bypassing the normal rules. Slots and quota are NOT adjusted.`
                        : ""
                }
                confirmLabel="Force"
                onConfirm={() => force.mutate()}
                onCancel={() => setForceOpen(false)}
                isPending={force.isPending}
                confirmDisabled={!forceStatus || forceStatus === selected?.status || forceReason.trim().length < 3}
            >
                <Field label="New status" required>
                    <SelectInput value={forceStatus} onChange={(e) => setForceStatus(e.target.value)}>
                        <option value="">Select…</option>
                        {APPLICATION_STATUSES.filter((s) => s !== selected?.status).map((s) => (
                            <option key={s} value={s}>
                                {humanize(s)}
                            </option>
                        ))}
                    </SelectInput>
                </Field>
                <Field label="Reason (audited)" required hint="3–500 characters.">
                    <TextArea
                        value={forceReason}
                        maxLength={500}
                        onChange={(e) => setForceReason(e.target.value)}
                        placeholder="e.g. No-show adjudication: business confirmed the creator never visited"
                    />
                </Field>
            </ConfirmDialog>
        </div>
    );
}
