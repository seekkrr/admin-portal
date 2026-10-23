import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ImageIcon, MapPin, PartyPopper, Save, Users } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Panel } from "@/components/ui/Panel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox, Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/StatusPill";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ChangeHistoryPanel } from "@/components/detail/ChangeHistoryPanel";
import { ChipsInput } from "@/components/detail/ChipsInput";
import { Notice } from "@/components/detail/DetailStates";
import { PhotoListEditor } from "@/components/detail/PhotoListEditor";
import { SaveBar } from "@/components/detail/SaveBar";
import { SingleImageField } from "@/components/detail/SingleImageField";
import { useAdminAccess } from "@/components/detail/useAdminAccess";
import { useDetailTab } from "@/components/detail/useDetailTab";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { usePageTitle } from "@/hooks/usePageTitle";
import { RegionPicker } from "@/features/regions/components/RegionPicker";
import { eventEditorApi } from "@/services/admin-detail.service";
import type { EventStatus } from "@/types";
import { eventsService } from "../services/events.service";
import { EventVenuesEditor } from "../components/event-editor/EventVenuesEditor";
import { EventAnnouncePanel } from "../components/event-editor/EventAnnouncePanel";
import { EVENT_STATUSES, blankEvent, changedPayload, createPayload, eventErrors, eventFormOf, type EventForm } from "../components/event-editor/eventForm";

const TABS = ["details", "venues", "media", "announcements", "history"] as const;
type Tab = (typeof TABS)[number];

/** Create (/events/new) or edit (/events/:eventId/edit) an event, and send its announcements. */
export function EventEditorPage() {
    const { eventId = "" } = useParams<{ eventId: string }>();
    const isNew = !eventId;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isStaff, isAdmin } = useAdminAccess();
    const [tab, setTab] = useDetailTab<Tab>(TABS, "details");

    const detail = useQuery({
        queryKey: ["event-detail", eventId],
        queryFn: () => eventsService.getEventDetail(eventId),
        enabled: !isNew && isStaff,
        retry: false,
    });
    const base = useMemo(() => (detail.data ? eventFormOf(detail.data) : blankEvent()), [detail.data]);
    const [form, setForm, reset] = useSyncedDraft<EventForm>(base);
    const [creatingStatus, setCreatingStatus] = useState<EventStatus>("draft");
    const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setForm((f) => ({ ...f, [k]: v }));
    usePageTitle(isNew ? "New event" : detail.data?.title);

    const errors = eventErrors(form);
    const changes = isNew ? createPayload(form) : changedPayload(form, base);
    const statusChanged = !isNew && form.status !== base.status;
    const dirty = isNew ? JSON.stringify(form) !== JSON.stringify(base) || creatingStatus !== "draft" : Object.keys(changes).length > 0 || statusChanged;

    const refresh = (id: string) => {
        queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
        queryClient.invalidateQueries({ queryKey: ["admin-events"] });
        queryClient.invalidateQueries({ queryKey: ["admin-audit", "event", id] });
    };

    const save = useMutation({
        mutationFn: async () => {
            if (isNew) {
                const created = await eventEditorApi.create(changes);
                if (creatingStatus !== "draft") await eventEditorApi.setStatus(created.id, creatingStatus);
                return created.id;
            }
            if (Object.keys(changes).length > 0) await eventEditorApi.update(eventId, changes);
            if (statusChanged) await eventEditorApi.setStatus(eventId, form.status);
            return eventId;
        },
        onSuccess: (id) => {
            toast.success(isNew ? "Event created" : "Event saved");
            refresh(id);
            if (isNew) navigate(`/events/${id}/edit`, { replace: true });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to manage events." />;
    if (!isNew && detail.isLoading) return <LoadingState label="Loading event…" />;
    if (!isNew && (detail.error || !detail.data)) {
        return <ErrorState title="Couldn't load this event" error={detail.error ?? new Error("Event not found.")} onRetry={() => detail.refetch()} />;
    }

    const disabled = !isAdmin;
    const ev = detail.data;

    const detailsSection = (
        <div className="space-y-5">
            <Panel title="Event" icon={PartyPopper}>
                <div className="space-y-4">
                    <Field label="Title" required error={!form.title.trim() && dirty ? "Add a title." : undefined}>
                        <TextInput value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={300} disabled={disabled} autoFocus={isNew} />
                    </Field>
                    <Field label="Subtitle">
                        <TextInput value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} maxLength={300} disabled={disabled} />
                    </Field>
                    <Field label="Description">
                        <TextArea value={form.description} onChange={(e) => set("description", e.target.value)} rows={6} maxLength={10000} disabled={disabled} />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Categories" hint="Press Enter after each.">
                            <ChipsInput value={form.categories} onChange={(v) => set("categories", v)} maxLength={60} disabled={disabled} />
                        </Field>
                        <Field label="Website">
                            <TextInput value={form.website} onChange={(e) => set("website", e.target.value)} maxLength={500} placeholder="https://…" disabled={disabled} />
                        </Field>
                    </div>
                </div>
            </Panel>
            <Panel title="When and where" icon={CalendarDays}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Starts">
                        <TextInput type="datetime-local" value={form.start} onChange={(e) => set("start", e.target.value)} disabled={disabled} />
                    </Field>
                    <Field label="Ends">
                        <TextInput type="datetime-local" value={form.end} min={form.start || undefined} onChange={(e) => set("end", e.target.value)} disabled={disabled} />
                    </Field>
                    <Field label="Time zone">
                        <TextInput value={form.timezone} onChange={(e) => set("timezone", e.target.value)} maxLength={64} placeholder="Asia/Kolkata" disabled={disabled} />
                    </Field>
                    <Field label="Region">
                        <RegionPicker value={form.region_id} onChange={(id) => set("region_id", id)} ringClass="focus:ring-accent-500" />
                    </Field>
                </div>
            </Panel>
            <Panel title="Status and reach" icon={Users}>
                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                    <Field label="Status" hint={isNew ? "Set after the event is created." : undefined}>
                        <SelectInput
                            value={isNew ? creatingStatus : form.status}
                            onChange={(e) => (isNew ? setCreatingStatus(e.target.value as EventStatus) : set("status", e.target.value as EventStatus))}
                            options={EVENT_STATUSES}
                            disabled={disabled}
                        />
                    </Field>
                    <Field label="Capacity" hint="Empty = no limit.">
                        <TextInput type="number" min={0} inputMode="numeric" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} disabled={disabled} />
                    </Field>
                    <Checkbox
                        checked={form.is_featured}
                        onChange={(v) => set("is_featured", v)}
                        disabled={disabled}
                        label="Featured"
                        hint="Shown first in the app's events."
                        className="sm:col-span-2"
                    />
                </div>
            </Panel>
        </div>
    );

    const venuesSection = (
        <Panel title={`Venues (${form.venues.length})`} icon={MapPin} description="The main venue is used for directions.">
            <EventVenuesEditor
                venues={form.venues}
                mainId={form.main_venue_marker_id}
                onChange={(v) => set("venues", v)}
                onMainChange={(id) => set("main_venue_marker_id", id)}
                disabled={disabled}
            />
        </Panel>
    );

    const mediaSection = (
        <Panel title="Cover and photos" icon={ImageIcon}>
            <div className="space-y-5">
                <Field label="Cover image">
                    <SingleImageField value={form.cover} onChange={(url) => set("cover", url)} category="website" entityId={eventId || undefined} disabled={disabled} label="Cover image" />
                </Field>
                <Field label="Photos">
                    <PhotoListEditor
                        value={form.gallery}
                        onChange={(v) => set("gallery", v)}
                        upload={{ category: "website", entityId: eventId || undefined }}
                        max={30}
                        coverLabel={null}
                        disabled={disabled}
                        label="Event photos"
                    />
                </Field>
            </div>
        </Panel>
    );

    return (
        <div className="space-y-5">
            <PageHeader
                icon={PartyPopper}
                title={isNew ? "New event" : ev?.title || "Event"}
                badge={!isNew && ev ? <StatusPill status={ev.status} /> : undefined}
                description={isNew ? "Fill in the details, venues and photos, then create it." : ev?.region_name ?? undefined}
                actions={
                    <ButtonLink to="/events" variant="ghost" size="sm">
                        All events
                    </ButtonLink>
                }
                primaryAction={
                    isNew ? (
                        <Button variant="primary" icon={Save} disabled={errors.length > 0 || !isAdmin} loading={save.isPending} onClick={() => save.mutate()}>
                            Create event
                        </Button>
                    ) : undefined
                }
            />

            {isNew ? (
                <div className="space-y-5">
                    {detailsSection}
                    {venuesSection}
                    {mediaSection}
                    <p className="text-sm text-ink-muted">Announcements and the change history open once the event is created.</p>
                </div>
            ) : (
                <>
                    <Tabs<Tab>
                        label="Event sections"
                        idPrefix="event"
                        value={tab}
                        onChange={setTab}
                        tabs={[
                            { value: "details", label: "Details" },
                            { value: "venues", label: "Venues", count: form.venues.length },
                            { value: "media", label: "Media" },
                            { value: "announcements", label: "Announcements" },
                            { value: "history", label: "Change history" },
                        ]}
                    />
                    <div role="tabpanel" id={`event-panel-${tab}`} aria-labelledby={`event-tab-${tab}`}>
                        {tab === "details" && detailsSection}
                        {tab === "venues" && venuesSection}
                        {tab === "media" && mediaSection}
                        {tab === "announcements" && <EventAnnouncePanel eventId={eventId} eventTitle={ev?.title ?? "this event"} />}
                        {tab === "history" && <ChangeHistoryPanel entityType="event" entityId={eventId} />}
                    </div>
                </>
            )}

            {dirty && errors.length > 0 && (
                <Notice tone="warn" title="Fix these first">
                    <ul className="list-disc pl-4">
                        {errors.map((e) => (
                            <li key={e}>{e}</li>
                        ))}
                    </ul>
                </Notice>
            )}
            <SaveBar
                dirty={dirty && isAdmin}
                saving={save.isPending}
                invalid={errors.length > 0}
                onSave={() => save.mutate()}
                onDiscard={() => {
                    reset();
                    setCreatingStatus("draft");
                }}
                saveLabel={isNew ? "Create event" : "Save event"}
            />
        </div>
    );
}

export default EventEditorPage;
