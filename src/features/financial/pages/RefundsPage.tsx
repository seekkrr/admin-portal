import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, Eye, Plus, RotateCcw } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { refundsService } from "../services/refunds.service";
import { RefundStatusBadge } from "../components/TransactionStatusBadge";
import { InitiateRefundModal } from "../components/InitiateRefundModal";
import { RefundApprovalModal } from "../components/RefundApprovalModal";
import { FINANCE_VIEW_ROLES, hasAnyRole } from "../components/paymentEvents";
import { formatCurrency, shortId } from "@/utils/format";
import { formatDateTime } from "@/utils/date";
import type { Refund, RefundStatus } from "@/types";

const PER_PAGE = 20;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "initiated", label: "Waiting for approval" },
    { value: "processing", label: "Processing" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
];

export function RefundsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const navigate = useNavigate();
    const canView = hasAnyRole(roles, FINANCE_VIEW_ROLES);
    const canInitiate = canView;
    const canApprove = canView;

    // ?status=initiated opens the refunds awaiting approval (links from Today).
    const { state, set, reset } = useUrlState({ user: "", status: "", page: 1 });
    const status = (STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "") as "" | RefundStatus;
    const userId = state.user.trim();
    const page = Math.max(1, state.page);

    const [showInitiate, setShowInitiate] = useState(false);
    const [approveTarget, setApproveTarget] = useState<Refund | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-refunds", { status, user_id: userId, page }],
        queryFn: () =>
            refundsService.list({
                status: status || undefined,
                user_id: userId || undefined,
                page,
                page_size: PER_PAGE,
            }),
        enabled: canView,
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view refunds." />;

    const refunds = data?.refunds ?? [];

    const columns: DataColumn<Refund>[] = [
        {
            id: "refund",
            header: "Refund",
            hideable: false,
            sortValue: (r) => r._id,
            cell: (r) => (
                <Link to={`/refunds/${r._id}`} className="font-mono text-xs font-medium text-ink hover:text-accent-700 hover:underline" title={r._id}>
                    {shortId(r._id, 8, 6)}
                </Link>
            ),
        },
        { id: "transaction", header: "Transaction", csv: (r) => r.transaction_id, cell: (r) => <IdLink kind="transaction" id={r.transaction_id} /> },
        {
            id: "amount",
            header: "Amount",
            align: "right",
            sortValue: (r) => r.amount,
            csv: (r) => r.amount,
            cell: (r) => <span className="whitespace-nowrap font-medium tabular-nums">{formatCurrency(r.amount, r.currency)}</span>,
        },
        { id: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <RefundStatusBadge status={r.status} /> },
        { id: "user", header: "User", csv: (r) => r.user_id, cell: (r) => <IdLink kind="user" id={r.user_id} /> },
        {
            id: "type",
            header: "Type",
            sortValue: (r) => r.refund_type ?? "",
            cell: (r) => <span className="capitalize text-ink-muted">{r.refund_type || "—"}</span>,
        },
        {
            id: "reason",
            header: "Reason",
            defaultHidden: true,
            sortValue: (r) => r.reason,
            className: "max-w-[280px]",
            cell: (r) => <span className="line-clamp-2 text-ink-muted">{r.reason || "—"}</span>,
        },
        {
            id: "created",
            header: "Created",
            sortValue: (r) => r.created_at,
            csv: (r) => formatDateTime(r.created_at),
            cell: (r) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(r.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (userId) chips.push({ key: "user", label: "User selected", onRemove: () => set({ user: "" }) });
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={RotateCcw}
                title="Refunds"
                description={
                    <>
                        Refund requests and approvals
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                primaryAction={
                    canInitiate && (
                        <Button variant="primary" icon={Plus} onClick={() => setShowInitiate(true)}>
                            Initiate refund
                        </Button>
                    )
                }
            />

            <FilterBar chips={chips} onReset={reset}>
                <EntityPicker type="user" variant="filter" label="User" placeholder="Filter by user…" value={userId} onChange={(id) => set({ user: id })} />
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
            </FilterBar>

            <DataTable
                label="Refunds"
                rows={refunds}
                columns={columns}
                rowKey={(r) => r._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{
                    icon: RotateCcw,
                    title: status === "initiated" && !userId ? "No refunds waiting for approval." : "No refunds match these filters.",
                    description: chips.length ? "Try clearing a filter." : undefined,
                }}
                onRowClick={(r) => navigate(`/refunds/${r._id}`)}
                rowActions={(r) => (
                    <>
                        {canApprove && r.status === "initiated" && (
                            <IconButton icon={CheckCircle} size="sm" label="Approve refund" onClick={() => setApproveTarget(r)} />
                        )}
                        <IconButton icon={Eye} size="sm" label="View details" onClick={() => navigate(`/refunds/${r._id}`)} />
                    </>
                )}
                storageKey="refunds"
                exportName="refunds"
                summary={data ? `${refunds.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (r) => formatCurrency(r.amount, r.currency),
                    subtitle: (r) => `${shortId(r._id, 8, 6)} · ${formatDateTime(r.created_at)}`,
                    fields: ["status", "type", "transaction", "user"],
                }}
                footer={
                    data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                }
            />

            <InitiateRefundModal open={showInitiate} onClose={() => setShowInitiate(false)} />
            <RefundApprovalModal open={!!approveTarget} refund={approveTarget} onClose={() => setApproveTarget(null)} />
        </div>
    );
}
