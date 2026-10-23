import { useQuery } from "@tanstack/react-query";
import { TicketCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { IdLink } from "@/components/ui/IdLink";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDate, formatDateTime } from "@/utils/date";
import { shortIdOf } from "@/utils/entity";
import { questBookingsService, type BookingStatus, type QuestBooking } from "../services/quest-bookings.service";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "expired", label: "Expired" },
];

const bookedAt = (b: QuestBooking) => b.booked_at ?? b.created_at ?? null;

/** Quest bookings (Money): who booked which quest, paid or free, and where it stands. */
export function QuestBookingsPage() {
    const { state, set, reset } = useUrlState({ quest: "", user: "", status: "", page: 1 });
    const status = (STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "") as "" | BookingStatus;
    const page = Math.max(1, state.page);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-quest-bookings", { quest: state.quest, user: state.user, status, page }],
        queryFn: () =>
            questBookingsService.list({
                quest_id: state.quest || undefined,
                user_id: state.user || undefined,
                status: status || undefined,
                page,
                page_size: PAGE_SIZE,
            }),
        placeholderData: (prev) => prev,
        retry: false,
    });

    const rows = data?.bookings ?? [];

    const columns: DataColumn<QuestBooking>[] = [
        {
            id: "quest",
            header: "Quest",
            hideable: false,
            sortValue: (b) => b.quest_id,
            csv: (b) => b.quest_id,
            cell: (b) => <IdLink kind="quest" id={b.quest_id} />,
        },
        { id: "user", header: "Person", sortValue: (b) => b.user_id, csv: (b) => b.user_id, cell: (b) => <IdLink kind="user" id={b.user_id} /> },
        { id: "status", header: "Status", sortValue: (b) => b.status, cell: (b) => <StatusPill status={b.status} /> },
        {
            id: "payment",
            header: "Payment",
            sortValue: (b) => (b.transaction_id ? 1 : 0),
            csv: (b) => b.transaction_id ?? "free",
            cell: (b) => (b.transaction_id ? <IdLink kind="transaction" id={b.transaction_id} /> : <Tag>Free</Tag>),
        },
        {
            id: "booked",
            header: "Booked",
            sortValue: (b) => bookedAt(b) ?? "",
            csv: (b) => formatDateTime(bookedAt(b)),
            cell: (b) => (
                <span className="whitespace-nowrap text-ink-muted" title={formatDateTime(bookedAt(b))}>
                    {formatDate(bookedAt(b))}
                </span>
            ),
        },
        {
            id: "completed",
            header: "Completed",
            sortValue: (b) => b.completed_at ?? "",
            csv: (b) => formatDateTime(b.completed_at),
            cell: (b) => <span className="whitespace-nowrap text-ink-muted">{formatDate(b.completed_at)}</span>,
        },
        {
            id: "refund",
            header: "Refund",
            defaultHidden: true,
            csv: (b) => b.refund_id ?? "",
            cell: (b) => (b.refund_id ? <IdLink kind="refund" id={b.refund_id} /> : <span className="text-ink-faint">—</span>),
        },
        { id: "id", header: "Booking ID", defaultHidden: true, csv: (b) => b._id, cell: (b) => <span className="font-mono text-xs text-ink-muted" title={b._id}>{shortIdOf(b._id)}</span> },
    ];

    const chips: FilterChip[] = [];
    if (state.quest) chips.push({ key: "quest", label: "One quest", onRemove: () => set({ quest: "" }) });
    if (state.user) chips.push({ key: "user", label: "One person", onRemove: () => set({ user: "" }) });
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={TicketCheck}
                title="Quest bookings"
                description={
                    <>
                        Who booked which quest, paid or free
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} bookings</span>}
                    </>
                }
            />

            <FilterBar chips={chips} onReset={reset}>
                <EntityPicker type="quest" variant="filter" label="Quest" placeholder="Quest…" value={state.quest} onChange={(id) => set({ quest: id })} />
                <EntityPicker type="user" variant="filter" label="Person" placeholder="Person…" value={state.user} onChange={(id) => set({ user: id })} />
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
            </FilterBar>

            <DataTable
                label="Quest bookings"
                rows={rows}
                columns={columns}
                rowKey={(b) => b._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: TicketCheck, title: chips.length ? "No bookings match these filters." : "No quest bookings yet.", description: chips.length ? "Try clearing a filter." : undefined }}
                storageKey="quest-bookings"
                exportName="quest-bookings"
                summary={data ? `${rows.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (b) => <IdLink kind="quest" id={b.quest_id} />,
                    subtitle: (b) => `Booked ${formatDate(bookedAt(b))}`,
                    fields: ["user", "status", "payment", "completed"],
                }}
                footer={data && <Pagination page={page} totalPages={data.total_pages} total={data.total} pageSize={PAGE_SIZE} onPageChange={(p) => set({ page: p })} />}
            />
        </div>
    );
}
