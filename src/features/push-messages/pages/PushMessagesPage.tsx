import { useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CalendarClock, ImagePlus, Megaphone, Send, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, SelectInput, Switch, TextArea, TextInput } from "@/components/ui/Field";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { IdLink } from "@/components/ui/IdLink";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { regionsService } from "@/features/regions/services/regions.service";
import { eventsService } from "@/features/events/services/events.service";
import { mediaService } from "@/services/media.service";
import { formatDateTime, formatRelative } from "@/utils/date";
import { errorMessage } from "@/utils/errors";
import { pushService, type ScheduledPush } from "../services/push.service";

type Audience = "all" | "region" | "event";

const TITLE_MAX = 200;
const BODY_MAX = 2000;

/** "2026-10-23T18:30" in the admin's own time, for <input type="datetime-local">. */
function localInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function RegionLabel({ id }: { id: string }) {
    const q = useQuery({
        queryKey: ["region-by-id", id],
        queryFn: () => regionsService.getById(id),
        staleTime: 5 * 60_000,
        retry: false,
    });
    return <IdLink kind="region" id={id} label={q.data?.name} />;
}

/** "Everyone", a region link or an event link, from a group key. */
function AudienceLabel({ groupKey, eventTitles }: { groupKey: string; eventTitles: Map<string, string> }) {
    if (groupKey === "all") return <Tag tone="brand">Everyone</Tag>;
    const [kind, id] = groupKey.split(":", 2);
    if (kind === "region" && id) {
        return (
            <span className="inline-flex flex-wrap items-center gap-1.5">
                <Tag>Region</Tag>
                <RegionLabel id={id} />
            </span>
        );
    }
    if (kind === "event" && id) {
        return (
            <span className="inline-flex flex-wrap items-center gap-1.5">
                <Tag>Event</Tag>
                <IdLink kind="event" id={id} label={eventTitles.get(id)} />
            </span>
        );
    }
    return <span className="font-mono text-xs text-ink-muted">{groupKey}</span>;
}

/** What the phone shows (roughly). */
function PhonePreview({ title, body, image }: { title: string; body: string; image: string }) {
    return (
        <div className="rounded-card border border-line bg-surface-muted p-3" aria-label="Preview">
            <div className="rounded-control bg-surface p-3 shadow-card">
                <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-900 text-white">
                        <Bell className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-ink-faint">
                            <span className="font-semibold uppercase tracking-wide">SeekKrr</span>
                            <span>now</span>
                        </div>
                        <p className="truncate text-sm font-semibold text-ink">{title || "Title"}</p>
                        <p className="line-clamp-3 text-sm text-ink-muted">{body || "Message"}</p>
                    </div>
                </div>
                {image && <img src={image} alt="" className="mt-2.5 max-h-40 w-full rounded-lg object-cover" />}
            </div>
        </div>
    );
}

/**
 * Push messages (Settings): send a push to everyone, one region or an event's
 * attendees, now or at a set time; see and cancel scheduled pushes.
 */
export function PushMessagesPage() {
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [audience, setAudience] = useState<Audience>("all");
    const [regionId, setRegionId] = useState("");
    const [eventId, setEventId] = useState("");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [longBody, setLongBody] = useState("");
    const [image, setImage] = useState("");
    const [uploading, setUploading] = useState(false);
    const [schedule, setSchedule] = useState(false);
    const [sendAt, setSendAt] = useState(() => localInputValue(new Date(Date.now() + 60 * 60_000)));
    const [confirmSend, setConfirmSend] = useState(false);
    const [cancelling, setCancelling] = useState<ScheduledPush | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const events = useQuery({
        queryKey: ["push-events"],
        queryFn: () => eventsService.listEvents({ per_page: 100 }),
        staleTime: 5 * 60_000,
        retry: false,
    });
    const eventTitles = useMemo(() => new Map((events.data?.events ?? []).map((e) => [e.id, e.title])), [events.data]);

    const scheduled = useQuery({
        queryKey: ["push-scheduled"],
        queryFn: () => pushService.scheduled(),
        retry: false,
    });

    const groupKey = audience === "all" ? "all" : audience === "region" ? (regionId ? `region:${regionId}` : "") : eventId ? `event:${eventId}` : "";
    const sendAtDate = schedule ? new Date(sendAt) : null;
    const errors = {
        audience: !groupKey ? (audience === "region" ? "Choose a region." : "Choose an event.") : undefined,
        title: !title.trim() ? "Add a title." : undefined,
        body: !body.trim() ? "Add the message." : undefined,
        sendAt:
            schedule && (!sendAtDate || Number.isNaN(sendAtDate.getTime()))
                ? "Pick a date and time."
                : schedule && sendAtDate && sendAtDate.getTime() < Date.now() + 60_000
                  ? "Pick a time at least a minute from now."
                  : undefined,
    };
    const valid = !Object.values(errors).some(Boolean);

    const reset = () => {
        setTitle("");
        setBody("");
        setLongBody("");
        setImage("");
        setSubmitted(false);
    };

    const send = useMutation({
        mutationFn: () =>
            pushService.broadcast({
                title: title.trim(),
                body: body.trim(),
                group_key: groupKey,
                image: image.trim() || undefined,
                long_body: longBody.trim() || undefined,
                send_at: sendAtDate ? sendAtDate.toISOString() : undefined,
            }),
        onSuccess: (res) => {
            setConfirmSend(false);
            if (res.scheduled) {
                toast.success(`Scheduled for ${formatDateTime(res.send_at ?? sendAtDate)}`);
                queryClient.invalidateQueries({ queryKey: ["push-scheduled"] });
                reset();
            } else if (res.push_enabled === false) {
                toast.error("Push isn't set up on this server, so nothing was sent.");
            } else if (res.published === false) {
                toast.error("The push couldn't be sent. Nobody may be subscribed to this audience yet.");
            } else {
                toast.success("Push sent");
                reset();
            }
        },
        onError: (e) => {
            setConfirmSend(false);
            toast.error(errorMessage(e));
        },
    });

    const cancel = useMutation({
        mutationFn: (id: string) => pushService.cancel(id),
        onSuccess: (ok) => {
            setCancelling(null);
            queryClient.invalidateQueries({ queryKey: ["push-scheduled"] });
            if (ok) toast.success("Scheduled push cancelled");
            else toast.error("It was already sent or cancelled.");
        },
        onError: (e) => {
            setCancelling(null);
            toast.error(errorMessage(e));
        },
    });

    const upload = async (file: File | undefined) => {
        if (!file) return;
        setUploading(true);
        try {
            const res = await mediaService.uploadImage(file, { category: "website" });
            setImage(res.secure_url);
        } catch (e) {
            toast.error(errorMessage(e, "Upload failed"));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (valid) setConfirmSend(true);
    };

    const audienceText = audience === "all" ? "everyone" : audience === "region" ? "people in this region" : "people going to this event";

    const columns: DataColumn<ScheduledPush>[] = [
        {
            id: "message",
            header: "Message",
            hideable: false,
            sortValue: (p) => p.title,
            className: "min-w-[14rem] max-w-[28rem]",
            cell: (p) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{p.title}</div>
                    <div className="line-clamp-2 text-xs text-ink-muted">{p.body}</div>
                </div>
            ),
        },
        { id: "audience", header: "Audience", sortValue: (p) => p.group_key, csv: (p) => p.group_key, cell: (p) => <AudienceLabel groupKey={p.group_key} eventTitles={eventTitles} /> },
        {
            id: "send_at",
            header: "Sends",
            sortValue: (p) => p.send_at ?? "",
            csv: (p) => formatDateTime(p.send_at),
            cell: (p) => (
                <span className="whitespace-nowrap" title={formatRelative(p.send_at)}>
                    {formatDateTime(p.send_at)}
                </span>
            ),
        },
        { id: "status", header: "Status", sortValue: (p) => p.status, cell: (p) => <StatusPill status={p.status === "pending" ? "scheduled" : p.status} /> },
        {
            id: "created",
            header: "Created",
            defaultHidden: true,
            sortValue: (p) => p.created_at ?? "",
            csv: (p) => formatDateTime(p.created_at),
            cell: (p) => <span className="text-ink-muted">{formatDateTime(p.created_at)}</span>,
        },
    ];

    const show = (msg: string | undefined) => (submitted ? msg : undefined);

    return (
        <div className="space-y-5">
            <PageHeader icon={Megaphone} title="Push messages" description="Send a push to everyone, a region or an event's guests — now or later" />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <Panel title="New push message" icon={Send}>
                    <form onSubmit={onSubmit} className="space-y-4" noValidate>
                        <div className="grid gap-4 xl:grid-cols-2">
                            <Field label="Send to" required>
                                <SelectInput value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                                    <option value="all">Everyone</option>
                                    <option value="region">People in a region</option>
                                    <option value="event">People going to an event</option>
                                </SelectInput>
                            </Field>
                            {audience === "region" && (
                                <Field label="Region" htmlFor="push-region" required error={show(errors.audience)}>
                                    <EntityPicker id="push-region" type="region" label="Region" value={regionId} onChange={(id) => setRegionId(id)} invalid={!!show(errors.audience)} />
                                </Field>
                            )}
                            {audience === "event" && (
                                <Field label="Event" required error={show(errors.audience)} hint={events.isError ? "Couldn't load events." : undefined}>
                                    <SelectInput value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={events.isLoading}>
                                        <option value="">{events.isLoading ? "Loading events…" : "Choose an event"}</option>
                                        {(events.data?.events ?? []).map((ev) => (
                                            <option key={ev.id} value={ev.id}>
                                                {ev.title}
                                                {ev.start_date ? ` · ${formatDateTime(ev.start_date)}` : ""}
                                            </option>
                                        ))}
                                    </SelectInput>
                                </Field>
                            )}
                        </div>

                        <Field label="Title" required error={show(errors.title)} hint={`${title.length}/${TITLE_MAX}`}>
                            <TextInput value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Diwali trails are live" />
                        </Field>
                        <Field label="Message" required error={show(errors.body)} hint={`${body.length}/${BODY_MAX}`}>
                            <TextArea value={body} maxLength={BODY_MAX} rows={3} onChange={(e) => setBody(e.target.value)} placeholder="What people see in the notification" />
                        </Field>
                        <Field label="Longer text (optional)" hint="Shown when the notification is expanded.">
                            <TextArea value={longBody} maxLength={BODY_MAX} rows={3} onChange={(e) => setLongBody(e.target.value)} />
                        </Field>

                        <Field label="Image (optional)" hint="A banner shown with the notification. Upload one or paste an image URL.">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <TextInput value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://img.seekkrr.com/…" />
                                <div className="flex shrink-0 gap-2">
                                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
                                    <Button icon={ImagePlus} loading={uploading} onClick={() => fileRef.current?.click()}>
                                        Upload
                                    </Button>
                                    {image && <IconButton icon={X} label="Remove image" onClick={() => setImage("")} />}
                                </div>
                            </div>
                        </Field>

                        <div className="space-y-3 rounded-control border border-line p-3">
                            <Switch checked={schedule} onChange={setSchedule} label="Send later" description="Pick when it goes out. Otherwise it is sent as soon as you confirm." />
                            {schedule && (
                                <Field label="Send at (your time)" required error={show(errors.sendAt)}>
                                    <TextInput type="datetime-local" value={sendAt} min={localInputValue(new Date())} onChange={(e) => setSendAt(e.target.value)} className="sm:max-w-xs" />
                                </Field>
                            )}
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                            <Button onClick={reset} disabled={send.isPending}>
                                Clear
                            </Button>
                            <Button type="submit" variant="primary" icon={schedule ? CalendarClock : Send} disabled={send.isPending}>
                                {schedule ? "Schedule push" : "Send push"}
                            </Button>
                        </div>
                    </form>
                </Panel>

                <div className="space-y-2 lg:sticky lg:top-[calc(var(--app-header-h)+1.5rem)] lg:self-start">
                    <h2 className="text-sm font-semibold text-ink">Preview</h2>
                    <PhonePreview title={title} body={body} image={image} />
                </div>
            </div>

            <section className="space-y-3" aria-labelledby="push-scheduled">
                <h2 id="push-scheduled" className="text-base font-semibold text-ink">
                    Scheduled
                </h2>
                <DataTable
                    label="Scheduled pushes"
                    rows={scheduled.data ?? []}
                    columns={columns}
                    rowKey={(p) => p.id}
                    isLoading={scheduled.isLoading}
                    isFetching={scheduled.isFetching && !!scheduled.data}
                    error={scheduled.error}
                    onRetry={() => scheduled.refetch()}
                    empty={{ icon: CalendarClock, title: "Nothing scheduled.", description: "Pushes you schedule show here until they go out." }}
                    rowActions={(p) => (
                        <IconButton icon={Trash2} size="sm" label={`Cancel "${p.title}"`} className="hover:bg-bad-soft hover:text-bad" onClick={() => setCancelling(p)} />
                    )}
                    storageKey="push-scheduled"
                    summary={scheduled.data ? `${scheduled.data.length} scheduled` : undefined}
                    card={{ title: (p) => p.title, subtitle: (p) => p.body, fields: ["audience", "send_at"] }}
                />
            </section>

            <ConfirmDialog
                open={confirmSend}
                title={schedule ? "Schedule this push?" : "Send this push now?"}
                description={
                    schedule
                        ? `It goes to ${audienceText} on ${formatDateTime(sendAtDate)}. You can cancel it until then.`
                        : `It goes to ${audienceText} straight away and can't be taken back.`
                }
                confirmLabel={schedule ? "Schedule" : "Send now"}
                tone={schedule ? "primary" : "warning"}
                isPending={send.isPending}
                onConfirm={() => send.mutate()}
                onCancel={() => setConfirmSend(false)}
            >
                <PhonePreview title={title} body={body} image={image} />
            </ConfirmDialog>

            <ConfirmDialog
                open={!!cancelling}
                title="Cancel this scheduled push?"
                description={cancelling ? `"${cancelling.title}" won't be sent on ${formatDateTime(cancelling.send_at)}.` : undefined}
                confirmLabel="Cancel push"
                cancelLabel="Keep it"
                tone="danger"
                isPending={cancel.isPending}
                onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
                onCancel={() => setCancelling(null)}
            />
        </div>
    );
}
