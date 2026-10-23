import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Ticket, XCircle } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/StatusPill";
import { SectionState } from "@/components/detail/DetailStates";
import { calendarDate, hhmmLabel, rupees } from "@/components/detail/detailFormat";
import { experienceDetailApi } from "@/services/admin-detail.service";
import { formatDateTime, formatRelative } from "@/utils/date";
import type { ExperienceBooking, ExperienceDetail } from "@/types/admin-detail";

const PAGE_SIZE = 50;
const STATUS_OPTIONS = [
    { value: "", label: "All statuses" },
    { value: "confirmed", label: "Confirmed" },
    { value: "checked_in", label: "Checked in" },
    { value: "cancelled", label: "Cancelled" },
    { value: "no_show", label: "No-show" },
];

function guest(b: ExperienceBooking): string {
    return b.user?.name || b.contact?.name || (b.user_id ? `User …${b.user_id.slice(-6)}` : "Guest");
}

function when(b: ExperienceBooking): string {
    const first = b.items[0];
    if (!first) return "—";
    const more = b.items.length > 1 ? ` +${b.items.length - 1}` : "";
    return `${calendarDate(first.date)} · ${hhmmLabel(first.start_time)}${more}`;
}

/** Bookings for this experience: check guests in or cancel. */
export function ExperienceBookingsTab({ experience, canEdit }: { experience: ExperienceDetail; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const businessId = experience.business_id;
    const [status, setStatus] = useState("");
    const [date, setDate] = useState("");
    const [page, setPage] = useState(1);
    const [cancelling, setCancelling] = useState<ExperienceBooking | null>(null);

    const query = useQuery({
        queryKey: ["experience-bookings", experience.id, status, date, page],
        queryFn: () => experienceDetailApi.bookings(businessId, { experience_id: experience.id, status, date, page, page_size: PAGE_SIZE }),
        placeholderData: (prev) => prev,
        retry: false,
    });
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["experience-bookings", experience.id] });
        queryClient.invalidateQueries({ queryKey: ["experience-slots", experience.id] });
        queryClient.invalidateQueries({ queryKey: ["experience-detail", experience.id] });
    };

    const checkIn = useMutation({
        mutationFn: (b: ExperienceBooking) => experienceDetailApi.checkIn(businessId, b.id),
        onSuccess: (_, b) => {
            toast.success(`${guest(b)} checked in`);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const cancel = useMutation({
        mutationFn: ({ b, reason }: { b: ExperienceBooking; reason?: string }) => experienceDetailApi.cancelBooking(businessId, b.id, reason),
        onSuccess: (_, { b }) => {
            toast.success(`Booking ${b.code ?? ""} cancelled; ${guest(b)} is told`);
            setCancelling(null);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const columns: DataColumn<ExperienceBooking>[] = [
        {
            id: "guest",
            header: "Guest",
            hideable: false,
            sortValue: (b) => guest(b),
            cell: (b) => (
                <div className="min-w-0">
                    {b.user_id ? (
                        <Link to={`/users/${b.user_id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                            {guest(b)}
                        </Link>
                    ) : (
                        <span className="font-medium text-ink">{guest(b)}</span>
                    )}
                    <div className="font-mono text-xs text-ink-faint">{b.code ?? b.id.slice(-8)}</div>
                </div>
            ),
        },
        { id: "when", header: "When", sortValue: (b) => b.starts_at ?? "", cell: (b) => <span className="whitespace-nowrap text-ink-muted">{when(b)}</span> },
        { id: "people", header: "People", align: "right", sortValue: (b) => b.total_people, cell: (b) => <span className="tabular-nums">{b.total_people}</span> },
        { id: "amount", header: "Amount", align: "right", sortValue: (b) => b.total_amount ?? 0, cell: (b) => <span className="tabular-nums">{rupees(b.total_amount)}</span> },
        { id: "status", header: "Status", sortValue: (b) => b.status, cell: (b) => <StatusPill status={b.status} /> },
        {
            id: "booked",
            header: "Booked",
            sortValue: (b) => b.created_at ?? "",
            cell: (b) => (
                <span className="whitespace-nowrap text-ink-muted" title={formatDateTime(b.created_at)}>
                    {formatRelative(b.created_at)}
                </span>
            ),
        },
    ];

    const data = query.data;
    const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || PAGE_SIZE))) : 1;

    return (
        <div className="space-y-4">
            <Panel title={`Bookings${data ? ` (${data.total})` : ""}`} icon={Ticket} bodyClassName="p-0">
                <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-end sm:px-5">
                    <Field label="Status" className="sm:w-48">
                        <SelectInput
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                setPage(1);
                            }}
                            options={STATUS_OPTIONS}
                        />
                    </Field>
                    <Field label="Date" className="sm:w-48">
                        <TextInput
                            type="date"
                            value={date}
                            onChange={(e) => {
                                setDate(e.target.value);
                                setPage(1);
                            }}
                        />
                    </Field>
                    {(status || date) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="sm:mb-1"
                            onClick={() => {
                                setStatus("");
                                setDate("");
                                setPage(1);
                            }}
                        >
                            Clear
                        </Button>
                    )}
                </div>
                <SectionState isLoading={query.isLoading} error={query.error} what="Bookings" onRetry={() => query.refetch()}>
                    <DataTable
                        label="Bookings"
                        rows={data?.bookings ?? []}
                        columns={columns}
                        rowKey={(b) => b.id}
                        isFetching={query.isFetching}
                        toolbar={false}
                        frame="bare"
                        empty={{ icon: Ticket, title: status || date ? "No bookings match" : "No bookings yet" }}
                        card={{ title: guest, subtitle: when, fields: ["people", "amount", "status", "booked"] }}
                        rowActions={
                            canEdit
                                ? (b) =>
                                      b.status === "confirmed" ? (
                                          <>
                                              <Button size="sm" variant="secondary" icon={CheckCircle2} loading={checkIn.isPending && checkIn.variables?.id === b.id} onClick={() => checkIn.mutate(b)}>
                                                  Check in
                                              </Button>
                                              <IconButton icon={XCircle} size="sm" label={`Cancel booking ${b.code ?? ""}`} className="hover:bg-bad-soft hover:text-bad" onClick={() => setCancelling(b)} />
                                          </>
                                      ) : null
                                : undefined
                        }
                        footer={totalPages > 1 ? <Pagination page={page} totalPages={totalPages} total={data?.total ?? 0} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
                    />
                </SectionState>
            </Panel>

            <ConfirmDialog
                open={!!cancelling}
                title="Cancel this booking?"
                description={cancelling ? `${guest(cancelling)} · ${when(cancelling)} · ${cancelling.total_people} ${cancelling.total_people === 1 ? "person" : "people"}. They get a notification.` : undefined}
                confirmLabel="Cancel booking"
                cancelLabel="Keep booking"
                tone="danger"
                level="reason"
                reasonLabel="Reason for the guest"
                reasonMinLength={0}
                reasonMaxLength={300}
                isPending={cancel.isPending}
                onConfirm={(reason) => cancelling && cancel.mutate({ b: cancelling, reason })}
                onCancel={() => setCancelling(null)}
            />
        </div>
    );
}
