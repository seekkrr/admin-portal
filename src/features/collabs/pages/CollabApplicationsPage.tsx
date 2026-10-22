import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GitPullRequestArrow, Filter, Zap, ExternalLink, CheckCircle2, XCircle, Star, History, Link as LinkIcon, Lock } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { FilterDropdown, type DropdownOption } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { useDebouncedValue } from "../hooks";
import {
    Chip, DetailRow, Drawer, Field, MonoId, PageHeader, PanelState, StatusPill, Toolbar, btnDanger, inputClass, thClass,
} from "../components/CollabsUi";
import { MarkerLink } from "../components/CollabPickers";
import { fmtDate, fmtDateTime, humanize, totalPagesOf } from "../utils";
import { APPLICATION_STATUSES, type AdminCollabApplication, type ApplicationRating } from "../types";

const STATUS_OPTIONS: DropdownOption[] = [{ value: "", label: "All statuses" }, ...APPLICATION_STATUSES.map((s) => ({ value: s, label: humanize(s) }))];

const idInputClass =
    "w-56 px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";

function Timeline({ app }: { app: AdminCollabApplication }) {
    const items = [...(app.timeline ?? [])];
    if (items.length === 0) return <p className="text-sm text-neutral-400">No timeline entries.</p>;
    return (
        <ol className="relative border-l-2 border-neutral-100 ml-2 space-y-4">
            {items.map((t, i) => (
                <li key={`${t.status}-${t.at}-${i}`} className="ml-4">
                    <span
                        className={`absolute -left-[7px] mt-1 w-3 h-3 rounded-full ring-4 ring-white ${
                            i === items.length - 1 ? "bg-teal-500" : "bg-neutral-300"
                        }`}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusPill status={t.status} />
                        <span className="text-xs text-neutral-500">{fmtDateTime(t.at)}</span>
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
                <Star key={n} className={`w-4 h-4 ${n <= score ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`} />
            ))}
            <span className="ml-1.5 text-xs font-medium text-neutral-600">{score}/5</span>
        </span>
    );
}

function ReviewCard({ label, review }: { label: string; review: ApplicationRating | null }) {
    return (
        <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-1.5">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{label}</div>
            {review ? (
                <>
                    <Stars score={review.score} />
                    {review.comment ? (
                        <p className="text-sm text-neutral-800 whitespace-pre-line break-words">{review.comment}</p>
                    ) : (
                        <p className="text-sm text-neutral-400 italic">No comment</p>
                    )}
                    <p className="text-xs text-neutral-500">
                        {review.by_name ?? "Unknown"}
                        {review.by && (
                            <>
                                {" "}
                                <MonoId id={review.by} />
                            </>
                        )}
                        {" · "}
                        {fmtDateTime(review.at)}
                    </p>
                </>
            ) : (
                <p className="text-sm text-neutral-400">Not reviewed yet</p>
            )}
        </div>
    );
}

export function CollabApplicationsPage() {
    const { isStaff, isAdmin } = useCollabAccess();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState("");
    const [businessInput, setBusinessInput] = useState(searchParams.get("business_id") ?? "");
    const [creatorInput, setCreatorInput] = useState(searchParams.get("creator_user_id") ?? "");
    const businessId = useDebouncedValue(businessInput);
    const creatorId = useDebouncedValue(creatorInput);
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<AdminCollabApplication | null>(null);
    const [forceOpen, setForceOpen] = useState(false);
    const [forceStatus, setForceStatus] = useState("");
    const [forceReason, setForceReason] = useState("");

    useEffect(() => setPage(1), [status, businessId, creatorId]);

    const params = {
        status: status || undefined,
        business_id: businessId || undefined,
        creator_user_id: creatorId || undefined,
        page,
    };
    const { data, isLoading, error, refetch } = useQuery({
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
    const hasFilters = !!(status || businessInput || creatorInput);

    const openForce = () => {
        setForceStatus("");
        setForceReason("");
        setForceOpen(true);
    };

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-5 animate-fade-in">
            <PageHeader
                icon={GitPullRequestArrow}
                title="Collab Requests"
                gradient="from-violet-500 to-violet-600"
                subtitle={data ? `${data.total} applications — walk-ins, advance requests and invites` : "Loading..."}
            />

            <Toolbar>
                <FilterDropdown options={STATUS_OPTIONS} value={status} onChange={setStatus} icon={<Filter className="w-3.5 h-3.5" />} placeholder="Status" theme="indigo" />
                <input
                    type="text"
                    value={businessInput}
                    onChange={(e) => setBusinessInput(e.target.value)}
                    placeholder="Business id"
                    className={idInputClass}
                    aria-label="Filter by business id"
                />
                <input
                    type="text"
                    value={creatorInput}
                    onChange={(e) => setCreatorInput(e.target.value)}
                    placeholder="Creator user id"
                    className={idInputClass}
                    aria-label="Filter by creator user id"
                />
                {hasFilters && (
                    <button
                        type="button"
                        onClick={() => {
                            setStatus("");
                            setBusinessInput("");
                            setCreatorInput("");
                        }}
                        className="px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                        Reset
                    </button>
                )}
            </Toolbar>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <PanelState isLoading={isLoading && !data} error={error} isEmpty={apps.length === 0} emptyIcon={GitPullRequestArrow} emptyText="No collab requests match" onRetry={() => refetch()}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className={thClass}>Creator</th>
                                    <th className={thClass}>Business</th>
                                    <th className={thClass}>Source</th>
                                    <th className={thClass}>Status</th>
                                    <th className={thClass}>Visit / due</th>
                                    <th className={thClass}>Updated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {apps.map((a) => (
                                    <tr key={a.id} onClick={() => setSelected(a)} className="hover:bg-neutral-50/80 cursor-pointer transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-neutral-900">{a.creator_name ?? "Creator"}</div>
                                            <MonoId id={a.creator_user_id} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-neutral-700">{a.business_name ?? "Business"}</div>
                                            <MonoId id={a.business_id} />
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600">{humanize(a.source)}</td>
                                        <td className="px-4 py-3">
                                            <StatusPill status={a.status} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                                            {a.visit_window ? `${fmtDate(a.visit_window.from)} → ${fmtDate(a.visit_window.to)}` : a.due_at ? `Due ${fmtDate(a.due_at)}` : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmtDateTime(a.updated_at ?? a.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </PanelState>
                {data && <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} onPageChange={setPage} theme="violet" />}
            </div>

            <Drawer
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected ? `${selected.creator_name ?? "Creator"} × ${selected.business_name ?? "Business"}` : ""}
                subtitle={selected && <span className="font-mono">{selected.id}</span>}
                footer={
                    selected &&
                    (isAdmin ? (
                        <button type="button" onClick={openForce} className={`${btnDanger} w-full`}>
                            <Zap className="w-4 h-4" /> Force transition
                        </button>
                    ) : (
                        <p className="text-xs text-neutral-500 text-center">Forced transitions need an admin.</p>
                    ))
                }
            >
                {selected && (
                    <>
                        <section className="space-y-3">
                            <DetailRow label="Status" value={<StatusPill status={selected.status} />} />
                            <DetailRow label="Source" value={humanize(selected.source)} />
                            <DetailRow
                                label="Business"
                                value={
                                    selected.business_id ? (
                                        <Link to={`/collabs/businesses/${selected.business_id}`} className="text-teal-700 hover:underline">
                                            {selected.business_name ?? selected.business_id}
                                        </Link>
                                    ) : (
                                        "—"
                                    )
                                }
                            />
                            <DetailRow label="Creator" value={<MonoId id={selected.creator_user_id} short={false} />} />
                            <DetailRow label="Collab" value={<MonoId id={selected.collab_id} short={false} />} />
                            <DetailRow label="Place" value={selected.marker_id ? <MarkerLink id={selected.marker_id} /> : "—"} />
                            {selected.visit_window && (
                                <DetailRow label="Visit window" value={`${fmtDate(selected.visit_window.from)} → ${fmtDate(selected.visit_window.to)}`} />
                            )}
                            {selected.redemption && (
                                <DetailRow label="Redeemed" value={`${fmtDateTime(selected.redemption.at)} via ${selected.redemption.method === "staff_qr" ? "staff QR scan" : "redeem code"}`} />
                            )}
                            <DetailRow label="Deliverables due" value={fmtDateTime(selected.due_at)} />
                            {selected.tracking_code && <DetailRow label="Tracking link" value={<span className="font-mono text-xs">seekkrr.com/t/{selected.tracking_code}</span>} />}
                            {selected.note && <DetailRow label="Creator note" value={selected.note} />}
                            {selected.decline_reason && <DetailRow label="Decline reason" value={selected.decline_reason} />}
                        </section>

                        {selected.deliverables.length > 0 && (
                            <section className="space-y-2">
                                <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                                    <LinkIcon className="w-4 h-4" /> Deliverables
                                </h4>
                                {selected.deliverables.map((d) => (
                                    <div key={d.url} className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-1">
                                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-teal-700 hover:underline break-all">
                                            <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {d.url}
                                        </a>
                                        <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-500">
                                            <Chip>{humanize(d.type)}</Chip>
                                            <span>{fmtDateTime(d.submitted_at)}</span>
                                            {d.auto_check &&
                                                (d.auto_check.ok ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-700">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Link verified{d.auto_check.author ? ` (${d.auto_check.author})` : ""}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-amber-700">
                                                        <XCircle className="w-3.5 h-3.5" /> {d.auto_check.reason ?? "Unverified"}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}

                        <section className="space-y-3">
                            <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                                <Star className="w-4 h-4" /> Reviews
                            </h4>
                            <ReviewCard label="Business → creator" review={selected.ratings?.business_to_creator ?? null} />
                            <ReviewCard label="Creator → business" review={selected.ratings?.creator_to_business ?? null} />
                            <p className="flex items-start gap-1.5 text-[11px] text-neutral-400">
                                <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                                Reviews are private: the business and the creator never see each other&apos;s review.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                                <History className="w-4 h-4" /> Timeline
                            </h4>
                            <Timeline app={selected} />
                            <p className="text-[11px] text-neutral-400">Forced transitions are recorded with their reason in the audit log (not shown here).</p>
                        </section>
                    </>
                )}
            </Drawer>

            <ConfirmModal
                open={forceOpen && !!selected}
                theme="danger"
                title="Force transition"
                message={
                    selected
                        ? `Move this application from “${humanize(selected.status)}” to a new state, bypassing the normal rules. Slots and quota are NOT adjusted.`
                        : ""
                }
                confirmLabel="Force"
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => force.mutate()}
                onCancel={() => setForceOpen(false)}
                isPending={force.isPending}
                disabledConfirm={!forceStatus || forceStatus === selected?.status || forceReason.trim().length < 3}
            >
                <div className="space-y-3">
                    <Field label="New status" htmlFor="force-status" required>
                        <select id="force-status" value={forceStatus} onChange={(e) => setForceStatus(e.target.value)} className={inputClass}>
                            <option value="">Select…</option>
                            {APPLICATION_STATUSES.filter((s) => s !== selected?.status).map((s) => (
                                <option key={s} value={s}>
                                    {humanize(s)}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Reason (audited)" htmlFor="force-reason" required hint="3–500 characters.">
                        <textarea
                            id="force-reason"
                            value={forceReason}
                            maxLength={500}
                            onChange={(e) => setForceReason(e.target.value)}
                            className={`${inputClass} resize-none min-h-[80px]`}
                            placeholder="e.g. No-show adjudication: business confirmed the creator never visited"
                        />
                    </Field>
                </div>
            </ConfirmModal>
        </div>
    );
}
