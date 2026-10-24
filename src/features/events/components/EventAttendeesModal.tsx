import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PanelState } from "@/components/ui/States";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatRelative, formatDateTime } from "@/utils/date";
import { eventsService } from "../services/events.service";

interface EventAttendeesModalProps {
    eventId: string;
    eventTitle: string;
    onClose: () => void;
}

/** Read-only RSVP list for an event (admin view). */
export function EventAttendeesModal({ eventId, eventTitle, onClose }: EventAttendeesModalProps) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["admin-event-attendees", eventId],
        queryFn: () => eventsService.listAttendees(eventId, { page_size: 100 }),
    });

    const attendees = data?.attendees ?? [];
    const total = data?.total ?? attendees.length;

    return (
        <Modal
            open
            onClose={onClose}
            title="Attendees"
            description={
                <>
                    {eventTitle}
                    {data && <span className="text-ink-faint"> · {total.toLocaleString("en-IN")} RSVP{total === 1 ? "" : "s"}</span>}
                </>
            }
            icon={Users}
            size="lg"
            footer={
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            }
        >
            <PanelState isLoading={isLoading} error={error} onRetry={() => refetch()} isEmpty={attendees.length === 0} emptyIcon={Users} emptyText="No RSVPs yet.">
                <div className="-mx-5 -my-5">
                    <ul className="divide-y divide-line">
                        {attendees.map((a) => (
                            <li key={a.user_id} className="flex items-center gap-3 px-5 py-3">
                                {a.avatar_url ? (
                                    <img src={a.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-line object-cover" />
                                ) : (
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700" aria-hidden>
                                        {(a.name || "?").slice(0, 1).toUpperCase()}
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <Link to={`/users/${a.user_id}`} className="block truncate text-sm font-medium text-ink hover:text-accent-700 hover:underline">
                                        {a.name || "Unnamed"}
                                    </Link>
                                    {a.rsvp_at && (
                                        <span className="text-xs text-ink-muted" title={formatDateTime(a.rsvp_at)}>
                                            RSVP'd {formatRelative(a.rsvp_at)}
                                        </span>
                                    )}
                                </div>
                                <StatusPill status={a.status} tone={a.status === "going" ? "good" : "warn"} />
                            </li>
                        ))}
                    </ul>
                    {total > attendees.length && <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">Showing the first {attendees.length} of {total.toLocaleString("en-IN")}.</p>}
                </div>
            </PanelState>
        </Modal>
    );
}
