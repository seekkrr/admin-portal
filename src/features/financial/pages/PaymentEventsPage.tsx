import { useQuery } from "@tanstack/react-query";
import { Hash, ReceiptText } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, type FilterChip } from "@/components/ui/FilterBar";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { IdLink } from "@/components/ui/IdLink";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { paymentEventsService } from "@/features/financial/services/payment-events.service";
import { EventSourceTag } from "../components/TransactionStatusBadge";
import { eventErrorText, FINANCE_VIEW_ROLES, hasAnyRole } from "../components/paymentEvents";
import { shortId } from "@/utils/format";
import { formatDateTime } from "@/utils/date";
import type { PaymentEvent } from "@/types";

const PER_PAGE = 25;

/** Small id filter that matches the filter-bar controls. */
function IdFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="relative w-44 shrink-0">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={`${label}…`}
                aria-label={label}
                spellCheck={false}
                autoComplete="off"
                className="h-10 w-full rounded-control border border-line-strong bg-surface pl-9 pr-3 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
        </div>
    );
}

export function PaymentEventsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const canView = hasAnyRole(roles, FINANCE_VIEW_ROLES);

    // Filters and page live in the address.
    const { state, set, reset } = useUrlState({ event: "", transaction: "", refund: "", payout: "", page: 1 });
    const page = Math.max(1, state.page);
    const [eventType, setEventType] = useDebouncedUrlInput(state.event, (v) => set({ event: v }, { replace: true }));
    const [transactionId, setTransactionId] = useDebouncedUrlInput(state.transaction, (v) => set({ transaction: v }, { replace: true }));
    const [refundId, setRefundId] = useDebouncedUrlInput(state.refund, (v) => set({ refund: v }, { replace: true }));
    const [payoutId, setPayoutId] = useDebouncedUrlInput(state.payout, (v) => set({ payout: v }, { replace: true }));

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: [
            "admin-payment-events",
            { event_type: state.event, transaction_id: state.transaction, refund_id: state.refund, payout_id: state.payout, page },
        ],
        queryFn: () =>
            paymentEventsService.list({
                event_type: state.event || undefined,
                transaction_id: state.transaction || undefined,
                refund_id: state.refund || undefined,
                payout_id: state.payout || undefined,
                page,
                page_size: PER_PAGE,
            }),
        enabled: canView,
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view payment events." />;

    const events = data?.events ?? [];

    const columns: DataColumn<PaymentEvent>[] = [
        {
            id: "event",
            header: "Event",
            hideable: false,
            sortValue: (ev) => ev.event_type,
            csv: (ev) => ev.event_type,
            className: "max-w-[320px]",
            cell: (ev) => {
                const err = eventErrorText(ev);
                return (
                    <div className="min-w-0">
                        <div className="font-medium text-ink">{ev.event_type || "event"}</div>
                        {err && <div className="mt-1 break-words rounded-lg border border-bad-line bg-bad-soft px-2 py-1 text-xs text-bad">{err}</div>}
                    </div>
                );
            },
        },
        { id: "source", header: "Source", sortValue: (ev) => ev.source, cell: (ev) => <EventSourceTag source={ev.source} /> },
        { id: "transaction", header: "Transaction", csv: (ev) => ev.transaction_id ?? "", cell: (ev) => <IdLink kind="transaction" id={ev.transaction_id} /> },
        { id: "refund", header: "Refund", csv: (ev) => ev.refund_id ?? "", cell: (ev) => <IdLink kind="refund" id={ev.refund_id} /> },
        { id: "payout", header: "Payout", csv: (ev) => ev.payout_id ?? "", cell: (ev) => <IdLink kind="payout" id={ev.payout_id} /> },
        { id: "user", header: "User", defaultHidden: true, csv: (ev) => ev.user_id ?? "", cell: (ev) => <IdLink kind="user" id={ev.user_id} /> },
        {
            id: "razorpay",
            header: "Razorpay",
            sortValue: (ev) => ev.razorpay_event_type ?? "",
            cell: (ev) =>
                ev.razorpay_event_type ? (
                    <div>
                        <div className="text-xs text-ink-muted">{ev.razorpay_event_type}</div>
                        {ev.razorpay_event_id && <div className="font-mono text-[11px] text-ink-faint">{shortId(ev.razorpay_event_id)}</div>}
                    </div>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        {
            id: "created",
            header: "Created",
            sortValue: (ev) => ev.created_at,
            csv: (ev) => formatDateTime(ev.created_at),
            cell: (ev) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(ev.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (state.transaction) chips.push({ key: "transaction", label: `Transaction: ${shortId(state.transaction)}`, onRemove: () => set({ transaction: "" }) });
    if (state.refund) chips.push({ key: "refund", label: `Refund: ${shortId(state.refund)}`, onRemove: () => set({ refund: "" }) });
    if (state.payout) chips.push({ key: "payout", label: `Payout: ${shortId(state.payout)}`, onRemove: () => set({ payout: "" }) });
    const filtered = chips.length > 0 || !!state.event;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={ReceiptText}
                title="Payment events"
                description={
                    <>
                        Audit log of gateway and money-movement events (read-only)
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
            />

            <FilterBar
                search={{ value: eventType, onChange: setEventType, placeholder: "Event type…" }}
                chips={chips}
                onReset={() => {
                    setEventType("");
                    setTransactionId("");
                    setRefundId("");
                    setPayoutId("");
                    reset();
                }}
            >
                <IdFilter label="Transaction ID" value={transactionId} onChange={setTransactionId} />
                <IdFilter label="Refund ID" value={refundId} onChange={setRefundId} />
                <IdFilter label="Payout ID" value={payoutId} onChange={setPayoutId} />
            </FilterBar>

            <DataTable
                label="Payment events"
                rows={events}
                columns={columns}
                rowKey={(ev) => ev._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: ReceiptText, title: "No payment events match these filters.", description: filtered ? "Try clearing a filter." : undefined }}
                storageKey="payment-events"
                exportName="payment-events"
                summary={data ? `${events.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (ev) => ev.event_type || "event",
                    subtitle: (ev) => formatDateTime(ev.created_at),
                    fields: ["source", "transaction", "refund", "payout"],
                }}
                footer={
                    data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                }
            />
        </div>
    );
}
