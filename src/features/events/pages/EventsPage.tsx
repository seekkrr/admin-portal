import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, MoreVertical, Users, Filter } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FilterDropdown } from "@/components/FilterDropdown";
import { AccessDenied } from "@/components/AccessDenied";
import { useAuthStore } from "@/store/auth.store";
import { eventsService } from "../services/events.service";
import { EventAttendeesModal } from "../components/EventAttendeesModal";
import type { EventListEntry, EventStatus } from "@/types";

const ALLOWED_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];
const PER_PAGE = 10;

const STATUS_OPTIONS = [
    { value: "", label: "All Statuses" },
    { value: "draft", label: "Draft", dot: "bg-neutral-400" },
    { value: "published", label: "Published", dot: "bg-green-500" },
    { value: "live", label: "Live", dot: "bg-red-500" },
    { value: "ended", label: "Ended", dot: "bg-neutral-400" },
    { value: "cancelled", label: "Cancelled", dot: "bg-amber-500" },
];

const STATUS_STYLES: Record<EventStatus, string> = {
    draft: "bg-neutral-100 text-neutral-600 border-neutral-200",
    published: "bg-green-50 text-green-700 border-green-200",
    live: "bg-red-50 text-red-700 border-red-200",
    ended: "bg-neutral-100 text-neutral-500 border-neutral-200",
    cancelled: "bg-amber-50 text-amber-700 border-amber-200",
};

function transitionsFor(status: EventStatus): { label: string; to: EventStatus }[] {
    switch (status) {
        case "draft": return [{ label: "Publish", to: "published" }];
        case "published": return [{ label: "Mark Live", to: "live" }, { label: "Move to Draft", to: "draft" }, { label: "Cancel", to: "cancelled" }];
        case "live": return [{ label: "Mark Ended", to: "ended" }, { label: "Cancel", to: "cancelled" }];
        case "cancelled": return [{ label: "Move to Draft", to: "draft" }];
        default: return [];
    }
}

function fmtDate(v?: string | null): string {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function EventsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    const hasAccess = !!user?.role?.some((r) => ALLOWED_ROLES.includes(r));
    const canDelete = !!user?.role?.some((r) => CAN_DELETE_ROLES.includes(r));

    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<EventListEntry | null>(null);
    const [attendeesFor, setAttendeesFor] = useState<EventListEntry | null>(null);

    useEffect(() => { setPage(1); }, [statusFilter]);

    useEffect(() => {
        const close = () => setOpenDropdownId(null);
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, []);

    const queryParams = useMemo(
        () => ({ status: statusFilter || undefined, page, per_page: PER_PAGE }),
        [statusFilter, page]
    );

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["admin-events", queryParams],
        queryFn: () => eventsService.listEvents(queryParams),
        enabled: hasAccess,
        staleTime: 30_000,
    });

    if (!hasAccess) {
        return <AccessDenied message="You need an admin or moderator role to manage events." />;
    }

    const events = data?.events ?? [];
    const pagination = data?.pagination;

    const changeStatus = async (id: string, to: EventStatus) => {
        try {
            await eventsService.setStatus(id, to);
            toast.success(`Status changed to ${to}`);
            queryClient.invalidateQueries({ queryKey: ["admin-events"] });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to change status");
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await eventsService.deleteEvent(deleteTarget.id);
            toast.success("Event deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-events"] });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to delete event");
        } finally {
            setDeleteTarget(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Events</h1>
                    <p className="text-neutral-500 text-sm mt-0.5">Moderate festivals & events across the platform</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <FilterDropdown
                    options={STATUS_OPTIONS}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    icon={<Filter className="w-3.5 h-3.5" />}
                    placeholder="All Statuses"
                    theme="indigo"
                />
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-neutral-50">
                            <tr className="border-b border-neutral-200">
                                <th className="py-3.5 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Title</th>
                                <th className="py-3.5 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Dates</th>
                                <th className="py-3.5 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Region</th>
                                <th className="py-3.5 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Status</th>
                                <th className="py-3.5 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {isLoading ? (
                                <tr><td colSpan={5} className="py-16 text-center text-neutral-400 text-sm">Loading events…</td></tr>
                            ) : isError ? (
                                <tr><td colSpan={5} className="py-16 text-center">
                                    <p className="text-red-500 text-sm mb-2">Couldn't load events.</p>
                                    <button onClick={() => refetch()} className="text-violet-600 text-sm font-medium hover:underline">Retry</button>
                                </td></tr>
                            ) : events.length === 0 ? (
                                <tr><td colSpan={5} className="py-16 text-center text-neutral-400">
                                    <CalendarDays className="w-8 h-8 mx-auto mb-2" />
                                    <p className="text-sm">No events found.</p>
                                </td></tr>
                            ) : (
                                events.map((ev) => (
                                    <tr key={ev.id} className="hover:bg-neutral-50/60 transition-colors">
                                        <td className="py-3.5 px-4 font-medium text-neutral-900">
                                            {ev.title}
                                            {ev.is_featured && <span className="ml-2 text-[11px] font-semibold text-amber-600">★</span>}
                                        </td>
                                        <td className="py-3.5 px-4 text-sm text-neutral-500 whitespace-nowrap">{fmtDate(ev.start_date)} – {fmtDate(ev.end_date)}</td>
                                        <td className="py-3.5 px-4 text-sm text-neutral-500">{ev.region_name ?? "—"}</td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[ev.status]}`}>{ev.status}</span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right relative">
                                            <div className="flex items-center justify-end gap-1">
                                                <button title="Attendees" onClick={(e) => { e.stopPropagation(); setAttendeesFor(ev); }}
                                                    className="p-2 h-9 w-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                                                    <Users className="w-4 h-4" />
                                                </button>
                                                <div className="relative">
                                                    <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === ev.id ? null : ev.id); }}
                                                        className={`p-2 h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${openDropdownId === ev.id ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"}`}>
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                    {openDropdownId === ev.id && (
                                                        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl z-30 py-1.5" onClick={(e) => e.stopPropagation()}>
                                                            <button onClick={() => { setAttendeesFor(ev); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 font-medium">View Attendees</button>
                                                            {transitionsFor(ev.status).map((t) => (
                                                                <button key={t.to} onClick={() => { void changeStatus(ev.id, t.to); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 font-medium">{t.label}</button>
                                                            ))}
                                                            {canDelete && (
                                                                <button onClick={() => { setDeleteTarget(ev); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium">Delete Event</button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {pagination && pagination.total_pages > 1 && (
                    <Pagination page={pagination.page} totalPages={pagination.total_pages} total={pagination.total} onPageChange={setPage} theme="violet" />
                )}
            </div>

            <ConfirmModal
                open={!!deleteTarget}
                title="Delete Event?"
                message={<>This will remove <span className="font-semibold text-neutral-900">{deleteTarget?.title}</span>. This cannot be undone.</>}
                confirmLabel="Delete Forever"
                confirmStyle="bg-red-600"
                theme="danger"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            {attendeesFor && (
                <EventAttendeesModal eventId={attendeesFor.id} eventTitle={attendeesFor.title} onClose={() => setAttendeesFor(null)} />
            )}
        </div>
    );
}
