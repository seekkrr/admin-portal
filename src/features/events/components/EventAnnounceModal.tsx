import { useState } from "react";
import { X, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { eventsService } from "../services/events.service";

interface EventAnnounceModalProps {
    eventId: string;
    eventTitle: string;
    onClose: () => void;
}

/** Broadcast a push announcement to everyone who RSVP'd (admin). */
export function EventAnnounceModal({ eventId, eventTitle, onClose }: EventAnnounceModalProps) {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (!title.trim() || !body.trim()) return;
        setSending(true);
        try {
            const res = await eventsService.announce(eventId, title.trim(), body.trim());
            toast.success(
                res.sent > 0
                    ? `Sent to ${res.sent} device(s) across ${res.recipients} attendee(s).`
                    : `Queued for ${res.recipients} attendee(s). (Push activates once SNS is configured.)`
            );
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to send announcement");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[3px] animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-900/5 w-full max-w-md animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                    <div className="flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-indigo-600" />
                        <div>
                            <h3 className="text-lg font-bold text-neutral-900">Announce</h3>
                            <p className="text-xs text-neutral-500">{eventTitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
                        <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:bg-white"
                            placeholder="e.g. Schedule update" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Message</label>
                        <textarea value={body} rows={4} maxLength={500} onChange={(e) => setBody(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:bg-white"
                            placeholder="What do attendees need to know?" />
                    </div>
                    <div className="flex gap-2.5">
                        <button onClick={onClose} disabled={sending}
                            className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 flex-1 disabled:opacity-50">Cancel</button>
                        <button onClick={send} disabled={sending || !title.trim() || !body.trim()}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:brightness-105 flex-1 disabled:opacity-40">
                            {sending ? "Sending…" : "Send"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
