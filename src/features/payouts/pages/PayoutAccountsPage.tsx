import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, Eye, Plus, Smartphone, Star, Wallet } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { payoutAccountsService } from "../services/payout-accounts.service";
import { PayoutAccountStatusBadge } from "../components/PayoutAccountStatusBadge";
import { PayoutAccountFormModal } from "../components/PayoutAccountFormModal";
import { CreatorPicker } from "../components/CreatorPicker";
import { FINANCE_ROLES, SUPER_ROLES, hasRole, maskedDetail, methodLabel } from "../components/accountDisplay";
import { shortId } from "@/utils/format";
import { formatDateTime } from "@/utils/date";
import type { AdminPayoutAccount, PayoutAccountMethod, PayoutAccountStatus } from "@/types";

const PER_PAGE = 20;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "pending_verification", label: "Needs verification" },
    { value: "verified", label: "Verified" },
    { value: "rejected", label: "Rejected" },
    { value: "disabled", label: "Disabled" },
];

const METHOD_OPTIONS: FilterOption[] = [
    { value: "bank_transfer", label: "Bank transfer" },
    { value: "upi", label: "UPI" },
];

export function PayoutAccountsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const navigate = useNavigate();
    const canView = hasRole(roles, FINANCE_ROLES);
    const canCreate = hasRole(roles, SUPER_ROLES);

    // Filters and page live in the address.
    const { state, set, reset } = useUrlState({ creator: "", status: "", method: "", page: 1 });
    const status = (STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "") as "" | PayoutAccountStatus;
    const method = (METHOD_OPTIONS.some((o) => o.value === state.method) ? state.method : "") as "" | PayoutAccountMethod;
    const creatorId = state.creator.trim();
    const page = Math.max(1, state.page);

    const [showCreate, setShowCreate] = useState(false);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-payout-accounts", { status, method, creator_id: creatorId, page }],
        queryFn: () =>
            payoutAccountsService.list({
                status: status || undefined,
                method: method || undefined,
                creator_id: creatorId || undefined,
                page,
                page_size: PER_PAGE,
            }),
        enabled: canView,
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view payout accounts." />;

    const accounts = data?.accounts ?? [];

    const columns: DataColumn<AdminPayoutAccount>[] = [
        {
            id: "account",
            header: "Account",
            hideable: false,
            sortValue: (a) => a.account_holder_name ?? "",
            csv: (a) => a.account_holder_name ?? "",
            cell: (a) => (
                <Link to={`/payout-accounts/${a.id}`} className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-accent-700 hover:underline">
                    {a.is_primary && <Star className="h-3.5 w-3.5 shrink-0 fill-highlight text-warn" aria-label="Primary account" />}
                    {a.account_holder_name || <span className="font-mono text-xs">{shortId(a.id)}</span>}
                </Link>
            ),
        },
        { id: "creator", header: "Creator", csv: (a) => a.creator_id, cell: (a) => <IdLink kind="creator" id={a.creator_id} /> },
        {
            id: "method",
            header: "Method",
            sortValue: (a) => a.method,
            csv: (a) => methodLabel(a.method),
            cell: (a) => (
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                    {a.method === "bank_transfer" ? <Banknote className="h-4 w-4 text-ink-faint" aria-hidden /> : <Smartphone className="h-4 w-4 text-ink-faint" aria-hidden />}
                    {methodLabel(a.method)}
                </span>
            ),
        },
        { id: "status", header: "Status", sortValue: (a) => a.status, cell: (a) => <PayoutAccountStatusBadge status={a.status} /> },
        { id: "detail", header: "Masked detail", csv: (a) => maskedDetail(a), cell: (a) => <span className="font-mono text-xs text-ink-muted">{maskedDetail(a)}</span> },
        {
            id: "primary",
            header: "Primary",
            defaultHidden: true,
            sortValue: (a) => a.is_primary,
            csv: (a) => (a.is_primary ? "yes" : "no"),
            cell: (a) => (a.is_primary ? <Tag tone="warn">Primary</Tag> : <span className="text-ink-faint">—</span>),
        },
        {
            id: "created",
            header: "Created",
            sortValue: (a) => a.created_at ?? "",
            csv: (a) => formatDateTime(a.created_at),
            cell: (a) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(a.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (creatorId) chips.push({ key: "creator", label: "Creator selected", onRemove: () => set({ creator: "" }) });
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });
    if (method) chips.push({ key: "method", label: chipLabel("Method", method, METHOD_OPTIONS), onRemove: () => set({ method: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Wallet}
                title="Payout accounts"
                description={
                    <>
                        Creator bank and UPI accounts for disbursements
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                primaryAction={
                    canCreate && (
                        <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
                            New account
                        </Button>
                    )
                }
            />

            <FilterBar chips={chips} onReset={reset}>
                <CreatorPicker variant="filter" label="Creator" placeholder="Filter by creator…" value={creatorId} onChange={(id) => set({ creator: id })} />
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                <FilterSelect label="Method" value={method} onChange={(v) => set({ method: v })} options={METHOD_OPTIONS} allLabel="All methods" />
            </FilterBar>

            <DataTable
                label="Payout accounts"
                rows={accounts}
                columns={columns}
                rowKey={(a) => a.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Wallet, title: "No payout accounts match these filters.", description: chips.length ? "Try clearing a filter." : undefined }}
                onRowClick={(a) => navigate(`/payout-accounts/${a.id}`)}
                rowActions={(a) => <IconButton icon={Eye} size="sm" label="View details" onClick={() => navigate(`/payout-accounts/${a.id}`)} />}
                storageKey="payout-accounts"
                exportName="payout-accounts"
                summary={data ? `${accounts.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (a) => a.account_holder_name || methodLabel(a.method),
                    subtitle: (a) => `${methodLabel(a.method)} · ${maskedDetail(a)}`,
                    fields: ["status", "creator", "primary", "created"],
                }}
                footer={
                    data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                }
            />

            <PayoutAccountFormModal open={showCreate} onClose={() => setShowCreate(false)} />
        </div>
    );
}
