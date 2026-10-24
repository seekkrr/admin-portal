import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Field, SelectInput } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/StatusPill";
import { StatTiles } from "@/components/detail/StatTiles";
import { SectionState } from "@/components/detail/DetailStates";
import { count } from "@/components/detail/detailFormat";
import { questDetailApi } from "@/services/admin-detail.service";
import { formatDateTime, formatRelative } from "@/utils/date";
import type { QuestBookingRow } from "@/types/admin-detail";

const PAGE_SIZE = 20;
const STATUSES = ["active", "completed", "cancelled", "expired"] as const;

/** Who booked this quest: totals by status and the latest bookings. */
export function QuestBookingsTab({ questId }: { questId: string }) {
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);

    const list = useQuery({
        queryKey: ["quest-bookings", questId, status, page],
        queryFn: () => questDetailApi.bookings(questId, { status: status || undefined, page, page_size: PAGE_SIZE }),
        placeholderData: (prev) => prev,
        retry: false,
    });
    // One small request per status for the summary tiles.
    const totals = useQuery({
        queryKey: ["quest-bookings-totals", questId],
        queryFn: async () => {
            const counts = await Promise.all(STATUSES.map((s) => questDetailApi.bookings(questId, { status: s, page: 1, page_size: 1 }).then((r) => r.total)));
            return Object.fromEntries(STATUSES.map((s, i) => [s, counts[i] ?? 0])) as Record<(typeof STATUSES)[number], number>;
        },
        staleTime: 60_000,
        retry: false,
    });

    const columns: DataColumn<QuestBookingRow>[] = [
        {
            id: "user",
            header: "Traveller",
            hideable: false,
            cell: (b) => (
                <Link to={`/users/${b.user_id}`} className="font-mono text-xs text-accent-700 hover:underline">
                    {b.user_id}
                </Link>
            ),
        },
        { id: "status", header: "Status", sortValue: (b) => b.status, cell: (b) => <StatusPill status={b.status === "active" ? "confirmed" : b.status} label={b.status === "active" ? "Active" : undefined} /> },
        {
            id: "booked",
            header: "Booked",
            sortValue: (b) => b.booked_at ?? b.created_at ?? "",
            cell: (b) => (
                <span className="text-ink-muted" title={formatDateTime(b.booked_at ?? b.created_at)}>
                    {formatRelative(b.booked_at ?? b.created_at)}
                </span>
            ),
        },
        { id: "completed", header: "Completed", sortValue: (b) => b.completed_at ?? "", cell: (b) => <span className="text-ink-muted">{b.completed_at ? formatDateTime(b.completed_at) : "—"}</span> },
    ];

    return (
        <div className="space-y-5">
            {totals.data && (
                <StatTiles
                    className="xl:grid-cols-4"
                    items={[
                        { label: "Active", value: count(totals.data.active) },
                        { label: "Completed", value: count(totals.data.completed) },
                        { label: "Cancelled", value: count(totals.data.cancelled) },
                        { label: "Expired", value: count(totals.data.expired) },
                    ]}
                />
            )}
            <Panel title={`Bookings${list.data ? ` (${count(list.data.total)})` : ""}`} icon={Ticket} bodyClassName="p-0">
                <div className="border-b border-line px-4 py-3 sm:px-5">
                    <Field label="Status" className="sm:w-48">
                        <SelectInput
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                setPage(1);
                            }}
                            options={[{ value: "", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]}
                        />
                    </Field>
                </div>
                <SectionState isLoading={list.isLoading} error={list.error} what="Quest bookings" onRetry={() => list.refetch()}>
                    <DataTable
                        label="Quest bookings"
                        rows={list.data?.bookings ?? []}
                        columns={columns}
                        rowKey={(b) => b._id}
                        isFetching={list.isFetching}
                        toolbar={false}
                        frame="bare"
                        empty={{ icon: Ticket, title: "No bookings yet" }}
                        card={{ title: (b) => `Traveller …${b.user_id.slice(-6)}`, fields: ["status", "booked", "completed"] }}
                        footer={
                            (list.data?.total_pages ?? 1) > 1 ? (
                                <Pagination page={page} totalPages={list.data?.total_pages ?? 1} total={list.data?.total ?? 0} pageSize={PAGE_SIZE} onPageChange={setPage} />
                            ) : undefined
                        }
                    />
                </SectionState>
            </Panel>
        </div>
    );
}
