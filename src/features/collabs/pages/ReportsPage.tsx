import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Filter, Gavel } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { FilterDropdown, type DropdownOption } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import {
    Chip, Field, LoadingButtonIcon, Modal, MonoId, PageHeader, PanelState, SegmentedTabs, StatusPill, Toolbar,
    btnPrimary, btnSecondary, btnSmNeutral, inputClass, thClass,
} from "../components/CollabsUi";
import { fmtDateTime, humanize, totalPagesOf } from "../utils";
import type { CollabReport, ReportAction, ReportStatus, ReportTargetType } from "../types";

const TARGET_OPTIONS: DropdownOption[] = [
    { value: "", label: "All targets" },
    { value: "business", label: "Business" },
    { value: "creator", label: "Creator" },
    { value: "collab", label: "Collab" },
    { value: "application", label: "Application" },
];

const ACTIONS: { value: ReportAction; label: string; help: string }[] = [
    { value: "dismiss", label: "Dismiss", help: "No violation. Closes the report(s)." },
    { value: "hide", label: "Hide target", help: "Hides the business/collab/profile from discovery." },
    { value: "restore", label: "Restore target", help: "Un-hides an auto-hidden target and dismisses." },
    { value: "suspend", label: "Suspend", help: "Suspends the business or creator from collabs." },
];

const REASON_TONE: Record<string, "red" | "amber" | "neutral"> = {
    unsafe: "red",
    harassment: "red",
    fraud: "red",
    not_honoured: "amber",
    no_show: "amber",
    inappropriate: "amber",
    spam: "neutral",
    other: "neutral",
};

function TargetCell({ report }: { report: CollabReport }) {
    const label = <Chip tone="violet">{humanize(report.target_type)}</Chip>;
    if (report.target_type === "business") {
        return (
            <div className="flex items-center gap-2">
                {label}
                <Link to={`/collabs/businesses/${report.target_id}`} className="text-[11px] font-medium text-teal-700 hover:underline" title={report.target_id}>
                    Open business
                </Link>
            </div>
        );
    }
    if (report.target_type === "creator") {
        return (
            <div className="flex items-center gap-2">
                {label}
                <Link to={`/collabs/applications?creator_user_id=${report.target_id}`} className="text-[11px] text-teal-700 hover:underline">
                    <MonoId id={report.target_id} />
                </Link>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2">
            {label}
            <MonoId id={report.target_id} />
        </div>
    );
}

export function ReportsPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<ReportStatus>("open");
    const [targetType, setTargetType] = useState("");
    const [page, setPage] = useState(1);
    const [resolving, setResolving] = useState<CollabReport | null>(null);
    const [action, setAction] = useState<ReportAction>("dismiss");
    const [note, setNote] = useState("");

    const params = { status, target_type: (targetType || undefined) as ReportTargetType | undefined, page };
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["collabs-reports", params],
        queryFn: () => collabsAdminService.listReports(params),
        enabled: isStaff,
        placeholderData: (prev) => prev,
    });

    const resolve = useMutation({
        mutationFn: () => collabsAdminService.resolveReport(resolving?.id ?? "", action, note.trim() || undefined),
        onSuccess: (res) => {
            toast.success(`Report resolved (${humanize(res.action)}) — other open reports on this target were closed too`);
            setResolving(null);
            queryClient.invalidateQueries({ queryKey: ["collabs-reports"] });
            queryClient.invalidateQueries({ queryKey: ["collabs-analytics"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to resolve report"),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to handle reports." />;

    const reports = data?.reports ?? [];
    const suspendBlocked = resolving?.target_type === "collab" || resolving?.target_type === "application";

    const openResolve = (r: CollabReport) => {
        setResolving(r);
        setAction("dismiss");
        setNote("");
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <PageHeader
                icon={Flag}
                title="Reports"
                gradient="from-rose-500 to-rose-600"
                subtitle="User reports on businesses, creators, collabs and applications (3 open reports auto-hide a target)"
            />

            <Toolbar>
                <SegmentedTabs<ReportStatus>
                    value={status}
                    onChange={(v) => {
                        setStatus(v);
                        setPage(1);
                    }}
                    tabs={[
                        { value: "open", label: "Open", count: status === "open" ? data?.total : undefined },
                        { value: "actioned", label: "Actioned" },
                        { value: "dismissed", label: "Dismissed" },
                    ]}
                />
                <FilterDropdown
                    options={TARGET_OPTIONS}
                    value={targetType}
                    onChange={(v) => {
                        setTargetType(v);
                        setPage(1);
                    }}
                    icon={<Filter className="w-3.5 h-3.5" />}
                    placeholder="Target"
                    theme="rose"
                />
            </Toolbar>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <PanelState isLoading={isLoading && !data} error={error} isEmpty={reports.length === 0} emptyIcon={Flag} emptyText={`No ${status} reports`} onRetry={() => refetch()}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className={thClass}>Target</th>
                                    <th className={thClass}>Reason</th>
                                    <th className={thClass}>Details</th>
                                    <th className={thClass}>Reporter</th>
                                    <th className={thClass}>Reported</th>
                                    <th className={`${thClass} text-right`}>{status === "open" ? "Action" : "Resolution"}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {reports.map((r) => (
                                    <tr key={r.id} className="hover:bg-neutral-50/60 align-top">
                                        <td className="px-4 py-3">
                                            <TargetCell report={r} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Chip tone={REASON_TONE[r.reason] ?? "neutral"}>{humanize(r.reason)}</Chip>
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600 max-w-[360px]">
                                            <p className="line-clamp-3 whitespace-pre-wrap">{r.details || "—"}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <MonoId id={r.reporter_user_id} />
                                        </td>
                                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                                        <td className="px-4 py-3 text-right">
                                            {r.status === "open" ? (
                                                <button type="button" onClick={() => openResolve(r)} className={btnSmNeutral}>
                                                    <Gavel className="w-3.5 h-3.5" /> Resolve
                                                </button>
                                            ) : (
                                                <div className="flex flex-col items-end gap-1">
                                                    <StatusPill status={r.status} label={r.resolution ? humanize(r.resolution.action) : undefined} />
                                                    {r.resolution?.note && <span className="text-[11px] text-neutral-500 max-w-[220px]">{r.resolution.note}</span>}
                                                    <span className="text-[11px] text-neutral-400">{fmtDateTime(r.resolved_at)}</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </PanelState>
                {data && <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} onPageChange={setPage} theme="rose" />}
            </div>

            <Modal
                open={!!resolving}
                onClose={() => !resolve.isPending && setResolving(null)}
                title="Resolve report"
                icon={Gavel}
                size="md"
                footer={
                    <>
                        <button type="button" onClick={() => setResolving(null)} disabled={resolve.isPending} className={btnSecondary}>
                            Cancel
                        </button>
                        <button type="button" onClick={() => resolve.mutate()} disabled={resolve.isPending || (action === "suspend" && suspendBlocked)} className={btnPrimary}>
                            <LoadingButtonIcon loading={resolve.isPending} icon={Gavel} /> Resolve
                        </button>
                    </>
                }
            >
                {resolving && (
                    <>
                        <div className="text-sm text-neutral-600 space-y-1">
                            <p>
                                <strong>{humanize(resolving.reason)}</strong> report on a {resolving.target_type}.
                            </p>
                            {resolving.details && <p className="text-xs bg-neutral-50 border border-neutral-100 rounded-lg p-2 whitespace-pre-wrap">{resolving.details}</p>}
                        </div>
                        <Field label="Action" required>
                            <div className="space-y-2">
                                {ACTIONS.map((a) => {
                                    const disabled = a.value === "suspend" && suspendBlocked;
                                    return (
                                        <label
                                            key={a.value}
                                            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                                                action === a.value ? "border-teal-300 bg-teal-50/50" : "border-neutral-200"
                                            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-neutral-50"}`}
                                        >
                                            <input
                                                type="radio"
                                                name="report-action"
                                                value={a.value}
                                                checked={action === a.value}
                                                disabled={disabled}
                                                onChange={() => setAction(a.value)}
                                                className="mt-0.5 accent-teal-600"
                                            />
                                            <span>
                                                <span className="block text-sm font-medium text-neutral-800">{a.label}</span>
                                                <span className="block text-xs text-neutral-500">
                                                    {disabled ? "Not available for collab/application targets." : a.help}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </Field>
                        <Field label="Note" htmlFor="report-note" hint="Optional, internal.">
                            <textarea
                                id="report-note"
                                maxLength={1000}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className={`${inputClass} resize-none min-h-[80px]`}
                                placeholder="e.g. Called the business — staff confirmed the offer was honoured"
                            />
                        </Field>
                    </>
                )}
            </Modal>
        </div>
    );
}
