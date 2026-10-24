import { useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
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
    const valid = !!title.trim() && !!body.trim();

    const send = async () => {
        if (!valid) return;
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
        <Modal
            open
            onClose={onClose}
            dismissible={!sending}
            title="Send notification"
            description={`To everyone who RSVP'd to ${eventTitle}`}
            icon={Megaphone}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={sending}>
                        Cancel
                    </Button>
                    <Button variant="primary" icon={Send} onClick={() => void send()} loading={sending} disabled={!valid}>
                        Send
                    </Button>
                </>
            }
        >
            <Field label="Title" required hint={`${title.length}/120`}>
                <TextInput value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Schedule update" disabled={sending} autoFocus />
            </Field>
            <Field label="Message" required hint={`${body.length}/500`}>
                <TextArea value={body} rows={4} maxLength={500} onChange={(e) => setBody(e.target.value)} placeholder="What do attendees need to know?" disabled={sending} />
            </Field>
        </Modal>
    );
}
