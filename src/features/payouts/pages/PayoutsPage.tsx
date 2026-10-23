import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Banknote, Eye, Plus } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { payoutsService } from "../services/payouts.service";
import { PayoutStatusBadge } from "../components/PayoutAccountStatusBadge";
import { InitiatePayoutModal } from "../components/InitiatePayoutModal";
import { CreatorPicker } from "../components/CreatorPicker";
import { FINANCE_ROLES, MANAGE_ROLES, hasRole, methodLabel } from "../components/accountDisplay";
import { formatCurrency, shortId } from "@/utils/format";
import { formatDateTime } from "@/utils/date";
import type { Payout, PayoutStatus } from "@/types";

const PER_PAGE = 20;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
];

export function PayoutsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const navigate = useNavigate();
    const canView = hasRole(roles, FINANCE_ROLES);
    const canManage = hasRole(roles, MANAGE_ROLES);

    // Filters and page live in the address.
    const { state, set, reset } = useUrlState({ creator: "", status: "", page: 1 });
    const status = (STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "") as "" | PayoutStatus;
    const creatorId = state.creator.trim();
    const page = Math.max(1, state.page);

    const [showInitiate, setShowInitiate] = useState(false);
    const [prefill, setPrefill] = useState<{ creator?: string; amount?: string }>({});

    // Deep link from the Creators "Pending payout" card:
    // /payouts?createForCreator=<id>&amount=<n> opens Initiate payout prefilled.
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const forCreator = searchParams.get("createForCreator");
        if (!forCreator) return;
        setPrefill({ creator: forCreator, amount: searchParams.get("amount") ?? undefined });
        setShowInitiate(true);
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.delete("createForCreator");
                next.delete("amount");
                next.set("creator", forCreator);
                return next;
            },
            { replace: true }
        );
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-payouts", { creator_id: creatorId, status, page }],
        queryFn: () =>
            payoutsService.list({
                creator_id: creatorId || undefined,
                status: status || undefined,
                page,
                page_size: PER_PAGE,
            }),
        enabled: canView,
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view payouts." />;

    const payouts = data?.payouts ?? [];

    const columns: DataColumn<Payout>[] = [
        {
            id: "reference",
            header: "Reference",
            hideable: false,
            sortValue: (p) => p.payout_reference || p._id,
            cell: (p) => (
                <Link to={`/payouts/${p._id}`} className="font-mono text-xs font-medium text-ink hover:text-accent-700 hover:underline" title={p.payout_reference || p._id}>
                    {shortId(p.payout_reference || p._id)}
                </Link>
            ),
        },
        { id: "creator", header: "Creator", csv: (p) => p.creator_id, cell: (p) => <IdLink kind="creator" id={p.creator_id} /> },
        {
            id: "amount",
            header: "Amount",
            align: "right",
            sortValue: (p) => p.amount,
            csv: (p) => p.amount,
            cell: (p) => <span className="whitespace-nowrap font-medium tabular-nums">{formatCurrency(p.amount, p.currency)}</span>,
        },
        { id: "status", header: "Status", sortValue: (p) => p.status, cell: (p) => <PayoutStatusBadge status={p.status} /> },
        {
            id: "method",
            header: "Method",
            sortValue: (p) => p.payout_method ?? "",
            csv: (p) => methodLabel(p.payout_method),
            cell: (p) => <span className="text-ink-muted">{methodLabel(p.payout_method)}</span>,
        },
        {
            id: "created",
            header: "Created",
            sortValue: (p) => p.created_at,
            csv: (p) => formatDateTime(p.created_at),
            cell: (p) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(p.created_at)}</span>,
        },
        {
            id: "processed",
            header: "Processed",
            sortValue: (p) => p.processed_at ?? "",
            csv: (p) => (p.processed_at ? formatDateTime(p.processed_at) : ""),
            cell: (p) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(p.processed_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (creatorId) chips.push({ key: "creator", label: "Creator selected", onRemove: () => set({ creator: "" }) });
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Banknote}
                title="Payouts"
                description={
                    <>
                        Admin-initiated creator disbursements
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                primaryAction={
                    canManage && (
                        <Button
                            variant="primary"
                            icon={Plus}
                            onClick={() => {
                                setPrefill({ creator: creatorId || undefined });
                                setShowInitiate(true);
                            }}
                        >
                            Initiate payout
                        </Button>
                    )
                }
            />

            <FilterBar chips={chips} onReset={reset}>
                <CreatorPicker variant="filter" label="Creator" placeholder="Filter by creator…" value={creatorId} onChange={(id) => set({ creator: id })} />
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
            </FilterBar>

            <DataTable
                label="Payouts"
                rows={payouts}
                columns={columns}
                rowKey={(p) => p._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Banknote, title: "No payouts match these filters.", description: chips.length ? "Try clearing a filter." : undefined }}
                onRowClick={(p) => navigate(`/payouts/${p._id}`)}
                rowActions={(p) => <IconButton icon={Eye} size="sm" label="View details" onClick={() => navigate(`/payouts/${p._id}`)} />}
                storageKey="payouts"
                exportName="payouts"
                summary={data ? `${payouts.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (p) => formatCurrency(p.amount, p.currency),
                    subtitle: (p) => `${shortId(p.payout_reference || p._id)} · ${formatDateTime(p.created_at)}`,
                    fields: ["status", "method", "creator", "processed"],
                }}
                footer={
                    data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                }
            />

            <InitiatePayoutModal open={showInitiate} onClose={() => setShowInitiate(false)} defaultCreatorId={prefill.creator} defaultAmount={prefill.amount} />
        </div>
    );
}
