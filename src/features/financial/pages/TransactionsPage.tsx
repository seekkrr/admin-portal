import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftRight, Eye, Receipt, RotateCcw } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { ButtonLink, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Tag } from "@/components/ui/StatusPill";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { CopyText } from "@/components/ui/CopyText";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { transactionsService } from "../services/transactions.service";
import { TransactionStatusBadge } from "../components/TransactionStatusBadge";
import { InitiateRefundModal } from "../components/InitiateRefundModal";
import { FINANCE_VIEW_ROLES, hasAnyRole } from "../components/paymentEvents";
import { formatCurrency, shortId } from "@/utils/format";
import { formatDateTime } from "@/utils/date";
import type { Transaction, TransactionStatus } from "@/types";

const PER_PAGE = 20;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "pending", label: "Pending" },
    { value: "authorized", label: "Authorized" },
    { value: "captured", label: "Captured" },
    { value: "failed", label: "Failed" },
    { value: "expired", label: "Expired" },
    { value: "refunded", label: "Refunded" },
];

const PAYMENT_TYPE_OPTIONS: FilterOption[] = [
    { value: "quest_booking", label: "Quest booking" },
    { value: "premium_addon", label: "Premium add-on" },
    { value: "top_up", label: "Top-up" },
    { value: "subscription", label: "Subscription" },
];

const typeLabel = (t: string | null | undefined) => (t ? (PAYMENT_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t.replace(/_/g, " ")) : "");

export function TransactionsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const navigate = useNavigate();
    const canView = hasAnyRole(roles, FINANCE_VIEW_ROLES);
    const canRefund = canView;

    // Filters and page live in the address.
    const { state, set, reset } = useUrlState({ user: "", status: "", type: "", page: 1 });
    const status = (STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "") as "" | TransactionStatus;
    const paymentType = state.type;
    const userId = state.user.trim();
    const page = Math.max(1, state.page);

    const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-transactions", { status, payment_type: paymentType, user_id: userId, page }],
        queryFn: () =>
            transactionsService.list({
                status: status || undefined,
                payment_type: paymentType || undefined,
                user_id: userId || undefined,
                page,
                page_size: PER_PAGE,
            }),
        enabled: canView,
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view transactions." />;

    const transactions = data?.transactions ?? [];

    const columns: DataColumn<Transaction>[] = [
        {
            id: "order",
            header: "Order ID",
            hideable: false,
            sortValue: (t) => t.order_id,
            cell: (t) => (
                <div className="flex items-center gap-1.5">
                    <Link to={`/transactions/${t._id}`} className="font-mono text-xs font-medium text-ink hover:text-accent-700 hover:underline" title={t.order_id}>
                        {shortId(t.order_id, 10, 6)}
                    </Link>
                    {t.order_id && <CopyText value={t.order_id} display="" title="Copy order ID" />}
                </div>
            ),
        },
        {
            id: "amount",
            header: "Amount",
            align: "right",
            sortValue: (t) => t.amount,
            csv: (t) => t.amount,
            cell: (t) => <span className="whitespace-nowrap font-medium tabular-nums">{formatCurrency(t.amount, t.currency)}</span>,
        },
        { id: "status", header: "Status", sortValue: (t) => t.status, cell: (t) => <TransactionStatusBadge status={t.status} /> },
        {
            id: "user",
            header: "User",
            csv: (t) => t.user_id,
            cell: (t) => <IdLink kind="user" id={t.user_id} />,
        },
        {
            id: "gateway",
            header: "Gateway",
            sortValue: (t) => t.payment_gateway ?? "",
            cell: (t) => <span className="capitalize text-ink-muted">{t.payment_gateway || "—"}</span>,
        },
        {
            id: "type",
            header: "Type",
            sortValue: (t) => t.payment_type ?? "",
            csv: (t) => typeLabel(t.payment_type),
            cell: (t) => (t.payment_type ? <Tag>{typeLabel(t.payment_type)}</Tag> : <span className="text-ink-faint">—</span>),
        },
        { id: "quest", header: "Quest", defaultHidden: true, csv: (t) => t.quest_id ?? "", cell: (t) => <IdLink kind="quest" id={t.quest_id} /> },
        {
            id: "created",
            header: "Created",
            sortValue: (t) => t.created_at,
            csv: (t) => formatDateTime(t.created_at),
            cell: (t) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(t.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (userId) chips.push({ key: "user", label: "User selected", onRemove: () => set({ user: "" }) });
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });
    if (paymentType) chips.push({ key: "type", label: chipLabel("Type", paymentType, PAYMENT_TYPE_OPTIONS), onRemove: () => set({ type: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={ArrowLeftRight}
                title="Transactions"
                description={
                    <>
                        Payment records across the platform
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                actions={
                    <ButtonLink to="/refunds" icon={Receipt}>
                        Refunds
                    </ButtonLink>
                }
            />

            <FilterBar chips={chips} onReset={reset}>
                <EntityPicker type="user" variant="filter" label="User" placeholder="Filter by user…" value={userId} onChange={(id) => set({ user: id })} />
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                <FilterSelect label="Type" value={paymentType} onChange={(v) => set({ type: v })} options={PAYMENT_TYPE_OPTIONS} allLabel="All types" />
            </FilterBar>

            <DataTable
                label="Transactions"
                rows={transactions}
                columns={columns}
                rowKey={(t) => t._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: ArrowLeftRight, title: "No transactions match these filters.", description: chips.length ? "Try clearing a filter." : undefined }}
                onRowClick={(t) => navigate(`/transactions/${t._id}`)}
                rowActions={(t) => (
                    <>
                        {canRefund && t.status === "captured" && (
                            <IconButton icon={RotateCcw} size="sm" label={`Initiate refund for ${t.order_id || "transaction"}`} onClick={() => setRefundTarget(t)} />
                        )}
                        <IconButton icon={Eye} size="sm" label="View details" onClick={() => navigate(`/transactions/${t._id}`)} />
                    </>
                )}
                storageKey="transactions"
                exportName="transactions"
                summary={data ? `${transactions.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (t) => formatCurrency(t.amount, t.currency),
                    subtitle: (t) => `${shortId(t.order_id, 10, 6)} · ${formatDateTime(t.created_at)}`,
                    fields: ["status", "type", "gateway", "user"],
                }}
                footer={
                    data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                }
            />

            {/* Quick refund from the list — pre-filled with the captured transaction */}
            <InitiateRefundModal open={!!refundTarget} transaction={refundTarget} onClose={() => setRefundTarget(null)} />
        </div>
    );
}
