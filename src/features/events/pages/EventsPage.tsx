import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Megaphone, Pencil, Plus, Star, Trash2, UserCog, Users } from "lucide-react";
import { AccessDenied } from "@/components/AccessDenied";
import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import type { StatusTone } from "@/components/ui/status";
import { useUrlState } from "@/hooks/useUrlState";
import { useAuthStore } from "@/store/auth.store";
import { formatDate } from "@/utils/date";
import { eventsService } from "../services/events.service";
import { EventAttendeesModal } from "../components/EventAttendeesModal";
import { EventAnnounceModal } from "../components/EventAnnounceModal";
import { EventCollaboratorsModal } from "../components/EventCollaboratorsModal";
import type { EventListEntry, EventStatus } from "@/types";

const ALLOWED_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];
const PER_PAGE = 10;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "draft", label: "Draft" },
    { value: "pending", label: "In review" },
    { value: "published", label: "Published" },
    { value: "live", label: "Live" },
    { value: "ended", label: "Ended" },
    { value: "cancelled", label: "Cancelled" },
];

const STATUS_PILL: Record<EventStatus, { label: string; tone: StatusTone }> = {
    draft: { label: "Draft", tone: "neutral" },
    pending: { label: "In review", tone: "warn" },
    published: { label: "Published", tone: "good" },
    live: { label: "Live", tone: "info" },
    ended: { label: "Ended", tone: "neutral" },
    cancelled: { label: "Cancelled", tone: "bad" },
};

function transitionsFor(status: EventStatus): { label: string; to: EventStatus }[] {
    switch (status) {
        case "draft":
            return [{ label: "Publish", to: "published" }];
        case "pending":
            return [
                { label: "Approve and publish", to: "published" },
                { label: "Send back to draft", to: "draft" },
                { label: "Reject (cancel)", to: "cancelled" },
            ];
        case "published":
            return [
                { label: "Mark live", to: "live" },
                { label: "Move to draft", to: "draft" },
                { label: "Cancel event", to: "cancelled" },
            ];
        case "live":
            return [
                { label: "Mark ended", to: "ended" },
                { label: "Cancel event", to: "cancelled" },
            ];
        case "cancelled":
            return [{ label: "Move to draft", to: "draft" }];
        default:
            return [];
    }
}

function EventStatusPill({ status }: { status: EventStatus }) {
    const s = STATUS_PILL[status];
    return <StatusPill status={status} label={s?.label} tone={s?.tone} />;
}

function dateRange(ev: EventListEntry): string {
    if (!ev.start_date && !ev.end_date) return "—";
    return `${formatDate(ev.start_date)} – ${formatDate(ev.end_date)}`;
}

export function EventsPage() {
    const { user } = useAuthStore();
    const hasAccess = !!user?.role?.some((r) => ALLOWED_ROLES.includes(r));
    if (!hasAccess) {
        return <AccessDenied message="You need an admin or moderator role to manage events." />;
    }
    return <EventsList canDelete={!!user?.role?.some((r) => CAN_DELETE_ROLES.includes(r))} />;
}

function EventsList({ canDelete }: { canDelete: boolean }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { state, set, reset } = useUrlState({ status: "", page: 1 });
    const statusFilter = STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "";
    const page = Math.max(1, state.page);

    const [deleteTarget, setDeleteTarget] = useState<EventListEntry | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [attendeesFor, setAttendeesFor] = useState<EventListEntry | null>(null);
    const [announceFor, setAnnounceFor] = useState<EventListEntry | null>(null);
    const [collaboratorsFor, setCollaboratorsFor] = useState<EventListEntry | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-events", { status: statusFilter || undefined, page, per_page: PER_PAGE }],
        queryFn: () => eventsService.listEvents({ status: statusFilter || undefined, page, per_page: PER_PAGE }),
        staleTime: 30_000,
        placeholderData: (prev) => prev,
    });

    const events = data?.events ?? [];
    const pagination = data?.pagination;

    const changeStatus = async (id: string, to: EventStatus) => {
        try {
            await eventsService.setStatus(id, to);
            toast.success(`Status changed to ${STATUS_PILL[to]?.label.toLowerCase() ?? to}`);
            queryClient.invalidateQueries({ queryKey: ["admin-events"] });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to change status");
        }
    };

    const toggleFeatured = async (ev: EventListEntry) => {
        try {
            await eventsService.updateEvent(ev.id, { is_featured: !ev.is_featured });
            toast.success(ev.is_featured ? "Removed from featured" : "Marked as featured");
            queryClient.invalidateQueries({ queryKey: ["admin-events"] });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update event");
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await eventsService.deleteEvent(deleteTarget.id);
            toast.success("Event deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-events"] });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to delete event");
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    const editPath = (ev: EventListEntry) => `/events/${ev.id}/edit`;

    const columns: DataColumn<EventListEntry>[] = [
        {
            id: "title",
            header: "Event",
            hideable: false,
            sortValue: (ev) => ev.title,
            csv: (ev) => ev.title,
            cell: (ev) => (
                <div className="flex min-w-0 items-center gap-3">
                    {ev.image ? (
                        <img src={ev.image} alt="" className="h-10 w-10 shrink-0 rounded-control border border-line object-cover" />
                    ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-500">
                            <CalendarDays className="h-4 w-4" aria-hidden />
                        </span>
                    )}
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <Link to={editPath(ev)} className="truncate font-medium text-ink hover:text-accent-700 hover:underline">
                                {ev.title}
                            </Link>
                            {ev.is_featured && <Star className="h-3.5 w-3.5 shrink-0 fill-highlight text-highlight-ink" aria-label="Featured" />}
                        </div>
                        {ev.subtitle && <div className="max-w-[260px] truncate text-xs text-ink-muted">{ev.subtitle}</div>}
                    </div>
                </div>
            ),
        },
        {
            id: "categories",
            header: "Categories",
            csv: (ev) => (ev.categories ?? []).join(", "),
            cell: (ev) =>
                ev.categories && ev.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {ev.categories.slice(0, 3).map((c) => (
                            <Tag key={c}>{c}</Tag>
                        ))}
                        {ev.categories.length > 3 && <Tag>+{ev.categories.length - 3}</Tag>}
                    </div>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        {
            id: "dates",
            header: "Dates",
            sortValue: (ev) => ev.start_date ?? "",
            csv: (ev) => dateRange(ev),
            cell: (ev) => <span className="whitespace-nowrap text-ink-muted">{dateRange(ev)}</span>,
        },
        {
            id: "region",
            header: "Region",
            sortValue: (ev) => ev.region_name ?? "",
            csv: (ev) => ev.region_name ?? "",
            cell: (ev) =>
                ev.region_id ? (
                    <Link to={`/regions/${ev.region_id}`} className="text-accent-700 hover:underline">
                        {ev.region_name || "Region"}
                    </Link>
                ) : (
                    <span className="text-ink-muted">{ev.region_name ?? "—"}</span>
                ),
        },
        {
            id: "owner",
            header: "Owner",
            defaultHidden: true,
            sortValue: (ev) => ev.created_by_name ?? "",
            csv: (ev) => ev.created_by_name ?? ev.created_by ?? "",
            cell: (ev) =>
                ev.created_by ? (
                    <Link to={`/users/${ev.created_by}`} className="text-accent-700 hover:underline">
                        {ev.created_by_name || "Owner"}
                    </Link>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        {
            id: "status",
            header: "Status",
            sortValue: (ev) => ev.status,
            csv: (ev) => STATUS_PILL[ev.status]?.label ?? ev.status,
            cell: (ev) => <EventStatusPill status={ev.status} />,
        },
    ];

    const menuItems = (ev: EventListEntry): MenuItem[] => {
        const items: MenuItem[] = [
            { label: "Edit event", icon: Pencil, to: editPath(ev) },
            { label: "View attendees", icon: Users, onSelect: () => setAttendeesFor(ev) },
            { label: "Send notification", icon: Megaphone, onSelect: () => setAnnounceFor(ev) },
            { label: "Manage collaborators", icon: UserCog, onSelect: () => setCollaboratorsFor(ev) },
            { label: ev.is_featured ? "Unfeature" : "Feature", icon: Star, onSelect: () => void toggleFeatured(ev) },
            ...transitionsFor(ev.status).map((t): MenuItem => ({ label: t.label, onSelect: () => void changeStatus(ev.id, t.to) })),
        ];
        if (canDelete) items.push({ label: "Delete event", icon: Trash2, danger: true, onSelect: () => setDeleteTarget(ev) });
        return items;
    };

    const chips: FilterChip[] = [];
    if (statusFilter) chips.push({ key: "status", label: chipLabel("Status", statusFilter, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={CalendarDays}
                title="Events"
                description={
                    <>
                        Festivals and events across the platform
                        {pagination && <span className="text-ink-faint"> · {pagination.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                primaryAction={
                    <Button variant="primary" icon={Plus} onClick={() => navigate("/events/new")}>
                        New event
                    </Button>
                }
            />

            <FilterBar chips={chips} onReset={reset}>
                <FilterSelect label="Status" value={statusFilter} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
            </FilterBar>

            <DataTable
                label="Events"
                rows={events}
                columns={columns}
                rowKey={(ev) => ev.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{
                    icon: CalendarDays,
                    title: statusFilter ? "No events with this status." : "No events yet.",
                    description: statusFilter ? "Try clearing the filter." : undefined,
                    action: !statusFilter ? (
                        <Button size="sm" variant="primary" icon={Plus} onClick={() => navigate("/events/new")}>
                            New event
                        </Button>
                    ) : undefined,
                }}
                onRowClick={(ev) => navigate(editPath(ev))}
                rowActions={(ev) => (
                    <>
                        <span className="hidden items-center gap-1 md:flex">
                            <IconButton icon={Users} size="sm" label={`Attendees of ${ev.title}`} onClick={() => setAttendeesFor(ev)} />
                            <IconButton icon={Pencil} size="sm" label={`Edit ${ev.title}`} onClick={() => navigate(editPath(ev))} />
                        </span>
                        <Menu label={`Actions for ${ev.title}`} triggerVariant="ghost" size="sm" items={menuItems(ev)} />
                    </>
                )}
                storageKey="events"
                exportName="events"
                summary={pagination ? `${events.length} of ${pagination.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (ev) => (
                        <span className="inline-flex items-center gap-1.5">
                            {ev.title}
                            {ev.is_featured && <Star className="h-3.5 w-3.5 fill-highlight text-highlight-ink" aria-label="Featured" />}
                        </span>
                    ),
                    subtitle: (ev) => ev.subtitle ?? undefined,
                    fields: ["status", "dates", "region", "categories"],
                }}
                footer={
                    pagination && (
                        <Pagination
                            page={pagination.page}
                            totalPages={pagination.total_pages}
                            total={pagination.total}
                            pageSize={PER_PAGE}
                            onPageChange={(p) => set({ page: p })}
                        />
                    )
                }
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="Delete event?"
                description={
                    <>
                        <span className="font-medium text-ink">{deleteTarget?.title}</span> disappears from the app and the admin lists.
                    </>
                }
                confirmLabel="Delete event"
                tone="danger"
                isPending={deleting}
                onConfirm={() => void confirmDelete()}
                onCancel={() => setDeleteTarget(null)}
            />

            {attendeesFor && <EventAttendeesModal eventId={attendeesFor.id} eventTitle={attendeesFor.title} onClose={() => setAttendeesFor(null)} />}

            {announceFor && <EventAnnounceModal eventId={announceFor.id} eventTitle={announceFor.title} onClose={() => setAnnounceFor(null)} />}

            {collaboratorsFor && (
                <EventCollaboratorsModal
                    eventId={collaboratorsFor.id}
                    eventTitle={collaboratorsFor.title}
                    onClose={() => setCollaboratorsFor(null)}
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-events"] })}
                />
            )}
        </div>
    );
}
