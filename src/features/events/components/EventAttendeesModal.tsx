import { useQuery } from "@tanstack/react-query";
import { X, Users } from "lucide-react";
import { eventsService } from "../services/events.service";

interface EventAttendeesModalProps {
    eventId: string;
    eventTitle: string;
    onClose: () => void;
}

/** Read-only RSVP list for an event (admin view). */
export function EventAttendeesModal({ eventId, eventTitle, onClose }: EventAttendeesModalProps) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["admin-event-attendees", eventId],
        queryFn: () => eventsService.listAttendees(eventId, { page_size: 100 }),
    });

    const attendees = data?.attendees ?? [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[3px] animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-900/5 w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900">Attendees</h3>
                        <p className="text-xs text-neutral-500">{eventTitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="overflow-y-auto flex-1">
                    {isLoading ? (
                        <p className="p-8 text-center text-neutral-400 text-sm">Loading…</p>
                    ) : isError ? (
                        <p className="p-8 text-center text-red-500 text-sm">Couldn't load attendees.</p>
                    ) : attendees.length === 0 ? (
                        <div className="p-10 text-center text-neutral-400">
                            <Users className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">No RSVPs yet.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-neutral-50">
                                <tr className="border-b border-neutral-200">
                                    <th className="py-3 px-5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Name</th>
                                    <th className="py-3 px-5 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {attendees.map((a) => (
                                    <tr key={a.user_id} className="hover:bg-neutral-50/50">
                                        <td className="py-3 px-5 text-sm font-medium text-neutral-900">{a.name}</td>
                                        <td className="py-3 px-5 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${a.status === "going" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                                {a.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
