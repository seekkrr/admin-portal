import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Megaphone, Send, X } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { SectionState } from "@/components/detail/DetailStates";
import { SingleImageField } from "@/components/detail/SingleImageField";
import { fromLocalInput, toLocalInput } from "@/components/detail/detailFormat";
import { eventEditorApi } from "@/services/admin-detail.service";
import { formatDateTime, formatRelative } from "@/utils/date";
import type { ScheduledAnnouncement } from "@/types/admin-detail";

interface Draft {
    title: string;
    body: string;
    long_body: string;
    image: string;
    when: "now" | "later";
    send_at: string;
}

const blank = (): Draft => ({ title: "", body: "", long_body: "", image: "", when: "now", send_at: toLocalInput(new Date(Date.now() + 60 * 60_000).toISOString()) });

/** Push to everyone who RSVP'd: now or scheduled, with an optional image and a longer body. */
export function EventAnnouncePanel({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<Draft>(blank);
    const [confirming, setConfirming] = useState(false);
    const [cancelling, setCancelling] = useState<ScheduledAnnouncement | null>(null);
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

    const scheduled = useQuery({
        queryKey: ["event-scheduled", eventId],
        queryFn: () => eventEditorApi.scheduled(eventId),
        retry: false,
    });

    const sendAtIso = draft.when === "later" ? fromLocalInput(draft.send_at) : null;
    const problems: string[] = [];
    if (!draft.title.trim()) problems.push("Add a title.");
    if (!draft.body.trim()) problems.push("Add a message.");
    if (draft.when === "later" && (!sendAtIso || new Date(sendAtIso).getTime() < Date.now() + 60_000)) problems.push("Pick a time in the future.");

    const send = useMutation({
        mutationFn: () =>
            eventEditorApi.announce(eventId, {
                title: draft.title.trim(),
                body: draft.body.trim(),
                ...(draft.long_body.trim() ? { long_body: draft.long_body.trim() } : {}),
                ...(draft.image ? { image: draft.image } : {}),
                ...(sendAtIso ? { send_at: sendAtIso } : {}),
            }),
        onSuccess: (res) => {
            toast.success(
                sendAtIso
                    ? `Scheduled for ${formatDateTime(sendAtIso)} · ${res.recipients} attendee${res.recipients === 1 ? "" : "s"} so far`
                    : `Sent to ${res.recipients} attendee${res.recipients === 1 ? "" : "s"}`
            );
            setDraft(blank());
            setConfirming(false);
            queryClient.invalidateQueries({ queryKey: ["event-scheduled", eventId] });
        },
        onError: (e: Error) => {
            setConfirming(false);
            toast.error(e.message);
        },
    });
    const cancel = useMutation({
        mutationFn: (s: ScheduledAnnouncement) => eventEditorApi.cancelScheduled(eventId, s.id),
        onSuccess: () => {
            toast.success("Scheduled announcement cancelled");
            setCancelling(null);
            queryClient.invalidateQueries({ queryKey: ["event-scheduled", eventId] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const items = scheduled.data ?? [];

    return (
        <div className="space-y-5">
            <Panel title="New announcement" icon={Megaphone} description="Goes to everyone who marked Going or Interested.">
                <div className="space-y-4">
                    <Field label="Title" required hint={`${draft.title.length}/120`}>
                        <TextInput value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="e.g. Schedule update" />
                    </Field>
                    <Field label="Message" required hint={`${draft.body.length}/500 · shown in the notification`}>
                        <TextArea value={draft.body} onChange={(e) => set("body", e.target.value)} rows={3} maxLength={500} />
                    </Field>
                    <Field label="More details (optional)" hint={`${draft.long_body.length}/2000 · shown when they open it`}>
                        <TextArea value={draft.long_body} onChange={(e) => set("long_body", e.target.value)} rows={4} maxLength={2000} />
                    </Field>
                    <Field label="Image (optional)" hint="Without one, the event cover is used.">
                        <SingleImageField value={draft.image} onChange={(url) => set("image", url)} category="website" entityId={eventId} label="Announcement image" />
                    </Field>
                    <div className="space-y-3">
                        <Tabs
                            label="When to send"
                            variant="pill"
                            value={draft.when}
                            onChange={(when) => set("when", when)}
                            tabs={[
                                { value: "now", label: "Send now" },
                                { value: "later", label: "Schedule" },
                            ]}
                        />
                        {draft.when === "later" && (
                            <Field label="Send at" hint="Your local time." className="sm:w-72">
                                <TextInput type="datetime-local" value={draft.send_at} onChange={(e) => set("send_at", e.target.value)} />
                            </Field>
                        )}
                    </div>
                    <Button variant="primary" icon={draft.when === "later" ? CalendarClock : Send} disabled={problems.length > 0} onClick={() => setConfirming(true)}>
                        {draft.when === "later" ? "Schedule announcement" : "Send now"}
                    </Button>
                </div>
            </Panel>

            <Panel title="Scheduled" icon={CalendarClock} bodyClassName="p-0">
                <SectionState
                    isLoading={scheduled.isLoading}
                    error={scheduled.error}
                    isEmpty={items.length === 0}
                    emptyText="Nothing scheduled"
                    emptyIcon={CalendarClock}
                    what="Scheduled announcements"
                    onRetry={() => scheduled.refetch()}
                >
                    <ul className="divide-y divide-line">
                        {items.map((s) => (
                            <li key={s.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                                {s.image && <img src={s.image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-ink">{s.title}</p>
                                    <p className="line-clamp-2 text-sm text-ink-muted">{s.body}</p>
                                    <p className="mt-1 text-xs text-ink-faint" title={formatDateTime(s.send_at)}>
                                        Sends {formatRelative(s.send_at)} · {formatDateTime(s.send_at)}
                                    </p>
                                </div>
                                <IconButton icon={X} size="sm" label={`Cancel "${s.title ?? "announcement"}"`} className="hover:bg-bad-soft hover:text-bad" onClick={() => setCancelling(s)} />
                            </li>
                        ))}
                    </ul>
                </SectionState>
            </Panel>

            <ConfirmDialog
                open={confirming}
                title={draft.when === "later" ? "Schedule this announcement?" : "Send this announcement now?"}
                description={
                    draft.when === "later" && sendAtIso
                        ? `"${draft.title}" goes to ${eventTitle} attendees on ${formatDateTime(sendAtIso)}.`
                        : `"${draft.title}" goes to every ${eventTitle} attendee straight away.`
                }
                confirmLabel={draft.when === "later" ? "Schedule" : "Send"}
                isPending={send.isPending}
                onConfirm={() => send.mutate()}
                onCancel={() => setConfirming(false)}
            />
            <ConfirmDialog
                open={!!cancelling}
                title="Cancel this scheduled announcement?"
                description={`"${cancelling?.title ?? ""}" won't be sent.`}
                confirmLabel="Cancel it"
                cancelLabel="Keep it"
                tone="warning"
                isPending={cancel.isPending}
                onConfirm={() => cancelling && cancel.mutate(cancelling)}
                onCancel={() => setCancelling(null)}
            />
        </div>
    );
}
