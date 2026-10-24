import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Gavel } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import type { StatusTone } from "@/components/ui/status";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDateTime } from "@/utils/date";
import { cx } from "@/utils/cx";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { humanize, totalPagesOf } from "../utils";
import type { CollabReport, ReportAction, ReportStatus, ReportTargetType } from "../types";

const STATUSES: ReportStatus[] = ["open", "actioned", "dismissed"];

const TARGET_OPTIONS: FilterOption[] = [
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

const REASON_TONE: Record<string, StatusTone> = {
    unsafe: "bad",
    harassment: "bad",
    fraud: "bad",
    not_honoured: "warn",
    no_show: "warn",
    inappropriate: "warn",
    spam: "neutral",
    other: "neutral",
};

function TargetCell({ report }: { report: CollabReport }) {
    const label = <Tag tone="info">{humanize(report.target_type)}</Tag>;
    let link = <span className="font-mono text-xs text-ink-muted" title={report.target_id}>{report.target_id.slice(0, 6)}…</span>;
    if (report.target_type === "business") link = <IdLink kind="business" id={report.target_id} label="Open business" />;
    if (report.target_type === "creator") {
        link = (
            <Link to={`/collabs/applications?creator_user_id=${report.target_id}`} className="text-xs font-medium text-accent-700 hover:underline" title={report.target_id}>
                Their collab requests
            </Link>
        );
    }
    return (
        <div className="flex flex-wrap items-center gap-2">
            {label}
            {link}
        </div>
    );
}

export function ReportsPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const { state, set } = useUrlState({ status: "open", target: "", page: 1 });
    const status: ReportStatus = STATUSES.includes(state.status as ReportStatus) ? (state.status as ReportStatus) : "open";
    const targetType = TARGET_OPTIONS.some((o) => o.value === state.target) ? (state.target as ReportTargetType) : "";
    const page = Math.max(1, state.page);
    const [resolving, setResolving] = useState<CollabReport | null>(null);
    const [action, setAction] = useState<ReportAction>("dismiss");
    const [note, setNote] = useState("");

    const params = { status, target_type: targetType || undefined, page };
    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["collabs-reports", params],
        queryFn: () => collabsAdminService.listReports(params),
        enabled: isStaff,
        placeholderData: (prev) => prev,
    });

    const resolve = useMutation({
        mutationFn: () => collabsAdminService.resolveReport(resolving?.id ?? "", action, note.trim() || undefined),
        onSuccess: (res) => {
            toast.success(`Report resolved (${humanize(res.action)}). Other open reports on this target were closed too.`);
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

    const columns: DataColumn<CollabReport>[] = [
        { id: "target", header: "Target", hideable: false, sortValue: (r) => r.target_type, csv: (r) => `${r.target_type} ${r.target_id}`, cell: (r) => <TargetCell report={r} /> },
        {
            id: "reason",
            header: "Reason",
            sortValue: (r) => r.reason,
            cell: (r) => <Tag tone={REASON_TONE[r.reason] ?? "neutral"}>{humanize(r.reason)}</Tag>,
        },
        {
            id: "details",
            header: "Details",
            csv: (r) => r.details ?? "",
            className: "max-w-[360px]",
            cell: (r) => <p className="line-clamp-3 whitespace-pre-wrap text-ink-muted">{r.details || "—"}</p>,
        },
        { id: "reporter", header: "Reporter", csv: (r) => r.reporter_user_id, cell: (r) => <IdLink kind="user" id={r.reporter_user_id} /> },
        {
            id: "reported",
            header: "Reported",
            sortValue: (r) => r.created_at ?? "",
            csv: (r) => formatDateTime(r.created_at),
            cell: (r) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(r.created_at)}</span>,
        },
        {
            id: "resolution",
            header: "Resolution",
            sortValue: (r) => r.resolution?.action ?? r.status,
            csv: (r) => (r.resolution ? `${r.resolution.action}${r.resolution.note ? ` — ${r.resolution.note}` : ""}` : r.status),
            cell: (r) =>
                r.status === "open" ? (
                    <StatusPill status="open" />
                ) : (
                    <div className="flex flex-col items-start gap-1">
                        <StatusPill status={r.status} label={r.resolution ? humanize(r.resolution.action) : undefined} />
                        {r.resolution?.note && <span className="max-w-[220px] text-xs text-ink-muted">{r.resolution.note}</span>}
                        <span className="text-xs text-ink-faint">{formatDateTime(r.resolved_at)}</span>
                    </div>
                ),
        },
    ];

    const chips: FilterChip[] = [];
    if (targetType) chips.push({ key: "target", label: chipLabel("Target", targetType, TARGET_OPTIONS), onRemove: () => set({ target: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Flag}
                title="Reports"
                description="User reports on businesses, creators, collabs and applications (3 open reports auto-hide a target)"
            />

            <Tabs<ReportStatus>
                label="Report status"
                value={status}
                onChange={(v) => set({ status: v })}
                tabs={[
                    { value: "open", label: "Open", count: status === "open" ? data?.total : undefined },
                    { value: "actioned", label: "Actioned" },
                    { value: "dismissed", label: "Dismissed" },
                ]}
            />

            <FilterBar chips={chips} onReset={() => set({ target: "" })}>
                <FilterSelect label="Target" value={targetType} onChange={(v) => set({ target: v })} options={TARGET_OPTIONS} allLabel="All targets" />
            </FilterBar>

            <DataTable
                label="Reports"
                rows={reports}
                columns={columns}
                rowKey={(r) => r.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Flag, title: `No ${status} reports`, description: chips.length ? "Try clearing the filter." : undefined }}
                rowActions={(r) =>
                    r.status === "open" ? (
                        <Button size="sm" variant="secondary" icon={Gavel} onClick={() => openResolve(r)}>
                            Resolve
                        </Button>
                    ) : null
                }
                storageKey="collab-reports"
                exportName="collab-reports"
                summary={data ? `${reports.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (r) => `${humanize(r.reason)} · ${humanize(r.target_type)}`,
                    subtitle: (r) => r.details ?? undefined,
                    fields: ["target", "reporter", "reported", "resolution"],
                }}
                footer={
                    data && (
                        <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} pageSize={data.page_size} onPageChange={(p) => set({ page: p })} />
                    )
                }
            />

            <Modal
                open={!!resolving}
                onClose={() => setResolving(null)}
                dismissible={!resolve.isPending}
                title="Resolve report"
                icon={Gavel}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setResolving(null)} disabled={resolve.isPending}>
                            Cancel
                        </Button>
                        <Button
                            variant={action === "suspend" || action === "hide" ? "danger" : "primary"}
                            icon={Gavel}
                            onClick={() => resolve.mutate()}
                            loading={resolve.isPending}
                            disabled={action === "suspend" && suspendBlocked}
                        >
                            Resolve
                        </Button>
                    </>
                }
            >
                {resolving && (
                    <>
                        <div className="space-y-2 text-sm text-ink-muted">
                            <p>
                                <strong className="text-ink">{humanize(resolving.reason)}</strong> report on a {resolving.target_type}.
                            </p>
                            {resolving.details && (
                                <p className="whitespace-pre-wrap rounded-control border border-line bg-surface-muted p-2.5 text-xs text-ink">{resolving.details}</p>
                            )}
                        </div>
                        <fieldset>
                            <legend className="mb-1.5 text-sm font-medium text-ink">
                                Action <span className="text-bad">*</span>
                            </legend>
                            <div className="space-y-2">
                                {ACTIONS.map((a) => {
                                    const disabled = a.value === "suspend" && suspendBlocked;
                                    return (
                                        <label
                                            key={a.value}
                                            className={cx(
                                                "flex items-start gap-3 rounded-control border p-3 transition-colors",
                                                action === a.value ? "border-accent-300 bg-accent-50" : "border-line",
                                                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-surface-muted"
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="report-action"
                                                value={a.value}
                                                checked={action === a.value}
                                                disabled={disabled}
                                                onChange={() => setAction(a.value)}
                                                className="mt-0.5 accent-accent-600"
                                            />
                                            <span>
                                                <span className="block text-sm font-medium text-ink">{a.label}</span>
                                                <span className="block text-xs text-ink-muted">{disabled ? "Not available for collab/application targets." : a.help}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                        <Field label="Note" hint="Optional, internal.">
                            <TextArea
                                maxLength={1000}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="e.g. Called the business — staff confirmed the offer was honoured"
                            />
                        </Field>
                    </>
                )}
            </Modal>
        </div>
    );
}
