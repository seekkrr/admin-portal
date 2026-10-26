import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, CalendarX2, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Button, IconButton } from "@/components/ui/Button";
import { Drawer, Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox, Field, SelectInput, TextInput } from "@/components/ui/Field";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Tabs } from "@/components/ui/Tabs";
import { Notice, SectionState } from "@/components/detail/DetailStates";
import { addDays, calendarDate, hhmmLabel, rupees, todayIst } from "@/components/detail/detailFormat";
import { experienceDetailApi } from "@/services/admin-detail.service";
import type { BulkSlotsPayload, ExperienceDetail, ExperienceSlot, SlotPatch } from "@/types/admin-detail";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_SLOTS = 500;

/** Days in [from, to] whose weekday (0 = Monday) is picked. */
function repeatDates(from: string, to: string, weekdays: number[]): string[] {
    if (!from || !to || to < from) return [];
    const out: string[] = [];
    let d = from;
    let guard = 0;
    while (d <= to && guard < 400) {
        const [y, m, day] = d.split("-").map(Number);
        const wd = (new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1)).getUTCDay() + 6) % 7;
        if (weekdays.length === 0 || weekdays.includes(wd)) out.push(d);
        d = addDays(d, 1);
        guard++;
    }
    return out;
}

interface BulkForm {
    option_id: string;
    mode: "dates" | "repeat";
    dates: string[];
    pickDate: string;
    from: string;
    to: string;
    weekdays: number[];
    times: { start: string; end: string }[];
    capacity: string;
}

function blankBulk(firstOption: string): BulkForm {
    const today = todayIst();
    return {
        option_id: firstOption,
        mode: "repeat",
        dates: [],
        pickDate: today,
        from: today,
        to: addDays(today, 27),
        weekdays: [5, 6],
        times: [{ start: "09:00", end: "11:00" }],
        capacity: "10",
    };
}

/** A price shown read-only: prices are set on the Pricing tab (slot = option price ?? price per person ?? free). */
function PriceReadOnly({ label = "Price per person", price }: { label?: string; price: number | null | undefined }) {
    return (
        <div>
            <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
            <p className="flex h-10 items-center rounded-control border border-line bg-surface-muted px-3 text-sm tabular-nums text-ink">
                {price === null || price === undefined ? "Free (no price set)" : rupees(price)}
            </p>
            <p className="mt-1 text-xs text-ink-faint">Set on the Pricing tab.</p>
        </div>
    );
}

/** Add slots in bulk, edit capacity / time, cancel. Prices come from the Pricing tab. */
export function ExperienceSlotsTab({ experience, canEdit }: { experience: ExperienceDetail; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const businessId = experience.business_id;
    const options = experience.options ?? [];
    const [from, setFrom] = useState(todayIst());
    const [to, setTo] = useState(addDays(todayIst(), 60));
    const [showCancelled, setShowCancelled] = useState(false);
    const [bulk, setBulk] = useState<BulkForm | null>(null);
    const [editing, setEditing] = useState<ExperienceSlot | null>(null);
    const [edit, setEdit] = useState({ capacity: "", start: "", end: "" });
    /** What a slot of this option costs per person (computed by the server the same way). */
    const priceFor = (optionId: string | null | undefined): number | null =>
        options.find((o) => o.id === optionId)?.price ?? experience.price_per_person ?? null;
    const [cancelling, setCancelling] = useState<ExperienceSlot | null>(null);

    const key = ["experience-slots", experience.id, from, to, showCancelled] as const;
    const query = useQuery({
        queryKey: key,
        queryFn: () => experienceDetailApi.slots(businessId, experience.id, { from, to, include_cancelled: showCancelled }),
        retry: false,
    });
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["experience-slots", experience.id] });
        queryClient.invalidateQueries({ queryKey: ["experience-detail", experience.id] });
        queryClient.invalidateQueries({ queryKey: ["admin-audit", "experience", experience.id] });
    };

    const bulkDates = useMemo(() => {
        if (!bulk) return [];
        return bulk.mode === "dates" ? bulk.dates : repeatDates(bulk.from, bulk.to, bulk.weekdays);
    }, [bulk]);
    const validTimes = (bulk?.times ?? []).filter((t) => t.start && t.end && t.end > t.start);
    const slotCount = bulkDates.length * validTimes.length;
    const capacityNum = Number.parseInt(bulk?.capacity ?? "", 10);
    const bulkProblems: string[] = [];
    if (bulk) {
        if (options.length && !bulk.option_id) bulkProblems.push("Pick an option.");
        if (!bulkDates.length) bulkProblems.push("Pick at least one date.");
        if (!validTimes.length) bulkProblems.push("Add a time that ends after it starts.");
        if (validTimes.length !== bulk.times.length) bulkProblems.push("Every time must end after it starts.");
        if (!Number.isFinite(capacityNum) || capacityNum < 1 || capacityNum > 10000) bulkProblems.push("Capacity is 1 to 10,000.");
        if (slotCount > MAX_SLOTS) bulkProblems.push(`That's ${slotCount} slots; add at most ${MAX_SLOTS} at a time.`);
    }

    const addSlots = useMutation({
        mutationFn: () => {
            if (!bulk) throw new Error("Nothing to add");
            const payload: BulkSlotsPayload = {
                times: validTimes,
                capacity: capacityNum,
                ...(bulk.option_id ? { option_id: bulk.option_id } : {}),
                ...(bulk.mode === "dates" ? { dates: bulk.dates } : { from: bulk.from, to: bulk.to, weekdays: bulk.weekdays }),
            };
            return experienceDetailApi.addSlots(businessId, experience.id, payload);
        },
        onSuccess: (res) => {
            const skipped = res.skipped + res.skipped_past;
            toast.success(`${res.created} slot${res.created === 1 ? "" : "s"} added${skipped ? ` · ${skipped} skipped (already there or already past)` : ""}`);
            setBulk(null);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const editPatch = (): SlotPatch | null => {
        if (!editing) return null;
        const patch: SlotPatch = {};
        const cap = Number.parseInt(edit.capacity, 10);
        if (!Number.isFinite(cap) || cap < 1) return null;
        if (cap !== editing.capacity) patch.capacity = cap;
        if (edit.start !== editing.start_time || edit.end !== editing.end_time) {
            if (!edit.start || !edit.end || edit.end <= edit.start) return null;
            patch.start_time = edit.start;
            patch.end_time = edit.end;
        }
        return patch;
    };
    const patch = editPatch();
    const saveSlot = useMutation({
        mutationFn: () => experienceDetailApi.updateSlot(businessId, editing?.id ?? "", patch ?? {}),
        onSuccess: () => {
            toast.success("Slot saved");
            setEditing(null);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const cancelSlot = useMutation({
        mutationFn: ({ slot, reason }: { slot: ExperienceSlot; reason?: string }) => experienceDetailApi.cancelSlot(businessId, slot.id, reason),
        onSuccess: (res) => {
            toast.success(`Slot cancelled${res.cancelled_bookings ? ` · ${res.cancelled_bookings} booking${res.cancelled_bookings === 1 ? "" : "s"} told` : ""}`);
            setCancelling(null);
            refresh();
            queryClient.invalidateQueries({ queryKey: ["experience-bookings", experience.id] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const columns: DataColumn<ExperienceSlot>[] = [
        { id: "date", header: "Date", hideable: false, sortValue: (s) => s.starts_at ?? s.date, cell: (s) => <span className="whitespace-nowrap font-medium text-ink">{calendarDate(s.date)}</span> },
        {
            id: "time",
            header: "Time",
            cell: (s) => (
                <span className="whitespace-nowrap text-ink-muted">
                    {hhmmLabel(s.start_time)} – {hhmmLabel(s.end_time)}
                </span>
            ),
        },
        ...(options.length ? [{ id: "option", header: "Option", sortValue: (s: ExperienceSlot) => s.option_name ?? "", cell: (s: ExperienceSlot) => s.option_name ?? "—" }] : []),
        {
            id: "booked",
            header: "Booked",
            align: "right",
            sortValue: (s) => s.booked,
            cell: (s) => (
                <span className="tabular-nums">
                    {s.booked}/{s.capacity}
                    {s.status === "open" && s.unavailable_reason === "price_not_set" ? (
                        <Tag tone="warn" className="ml-1.5">No price</Tag>
                    ) : s.status === "open" && s.unavailable_reason === "time_taken" ? (
                        <Tag tone="warn" className="ml-1.5">Time taken</Tag>
                    ) : (
                        s.sold_out && s.status === "open" && <Tag tone="warn" className="ml-1.5">Full</Tag>
                    )}
                </span>
            ),
        },
        { id: "price", header: "Price", align: "right", sortValue: (s) => s.price ?? 0, cell: (s) => <span className="tabular-nums">{rupees(s.price)}</span> },
        { id: "status", header: "Status", sortValue: (s) => s.status, cell: (s) => <StatusPill status={s.status === "open" ? "active" : s.status} label={s.status === "open" ? "Open" : undefined} /> },
    ];

    const setB = (patch: Partial<BulkForm>) => setBulk((b) => (b ? { ...b, ...patch } : b));

    return (
        <div className="space-y-4">
            <Panel
                title="Slots"
                icon={Clock}
                description="Times are India time. Past slots aren't listed. Prices come from the Pricing tab."
                bodyClassName="p-0"
                actions={
                    canEdit ? (
                        <Button size="sm" variant="primary" icon={CalendarPlus} onClick={() => setBulk(blankBulk(options[0]?.id ?? ""))} disabled={experience.status === "archived"}>
                            Add slots
                        </Button>
                    ) : undefined
                }
            >
                <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-end sm:px-5">
                    <Field label="From" className="sm:w-44">
                        <TextInput type="date" value={from} min={todayIst()} onChange={(e) => setFrom(e.target.value || todayIst())} />
                    </Field>
                    <Field label="To" className="sm:w-44">
                        <TextInput type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
                    </Field>
                    <Checkbox checked={showCancelled} onChange={setShowCancelled} label="Show cancelled" className="sm:pb-2.5" />
                </div>
                <SectionState isLoading={query.isLoading} error={query.error} what="Slots" onRetry={() => query.refetch()}>
                    <DataTable
                        label="Slots"
                        rows={query.data ?? []}
                        columns={columns}
                        rowKey={(s) => s.id}
                        isFetching={query.isFetching}
                        toolbar={false}
                        frame="bare"
                        empty={{ icon: Clock, title: "No slots in these dates", description: canEdit ? "Use Add slots to create them." : undefined }}
                        card={{
                            title: (s) => `${calendarDate(s.date)} · ${hhmmLabel(s.start_time)}`,
                            subtitle: (s) => s.option_name ?? null,
                            fields: ["booked", "price", "status"],
                        }}
                        rowActions={
                            canEdit
                                ? (s) =>
                                      s.status === "open" ? (
                                          <>
                                              <IconButton
                                                  icon={Pencil}
                                                  size="sm"
                                                  label={`Edit slot on ${s.date} at ${s.start_time}`}
                                                  onClick={() => {
                                                      setEditing(s);
                                                      setEdit({ capacity: String(s.capacity), start: s.start_time, end: s.end_time });
                                                  }}
                                              />
                                              <IconButton
                                                  icon={CalendarX2}
                                                  size="sm"
                                                  label={`Cancel slot on ${s.date} at ${s.start_time}`}
                                                  className="hover:bg-bad-soft hover:text-bad"
                                                  onClick={() => setCancelling(s)}
                                              />
                                          </>
                                      ) : null
                                : undefined
                        }
                    />
                </SectionState>
            </Panel>

            {/* Bulk add */}
            <Drawer
                open={!!bulk}
                onClose={() => setBulk(null)}
                dismissible={!addSlots.isPending}
                title="Add slots"
                subtitle={experience.title}
                footer={
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-ink-muted" aria-live="polite">
                            {slotCount ? `Adds up to ${slotCount} slot${slotCount === 1 ? "" : "s"}` : "Nothing to add yet"}
                        </p>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button variant="secondary" onClick={() => setBulk(null)} disabled={addSlots.isPending}>
                                Cancel
                            </Button>
                            <Button variant="primary" icon={Plus} disabled={bulkProblems.length > 0} loading={addSlots.isPending} onClick={() => addSlots.mutate()}>
                                Add slots
                            </Button>
                        </div>
                    </div>
                }
            >
                {bulk && (
                    <div className="space-y-5">
                        {options.length > 0 && (
                            <Field label="Option" required>
                                <SelectInput
                                    value={bulk.option_id}
                                    onChange={(e) => setB({ option_id: e.target.value })}
                                    options={options.map((o) => ({ value: o.id, label: `${o.name}${o.price !== null ? ` · ${rupees(o.price)}` : ""}` }))}
                                />
                            </Field>
                        )}
                        <div className="space-y-3">
                            <Tabs
                                label="How to pick dates"
                                variant="pill"
                                value={bulk.mode}
                                onChange={(mode) => setB({ mode })}
                                tabs={[
                                    { value: "repeat", label: "Repeat weekly" },
                                    { value: "dates", label: "Pick dates" },
                                ]}
                            />
                            {bulk.mode === "repeat" ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="From">
                                            <TextInput type="date" value={bulk.from} min={todayIst()} onChange={(e) => setB({ from: e.target.value })} />
                                        </Field>
                                        <Field label="To">
                                            <TextInput type="date" value={bulk.to} min={bulk.from} onChange={(e) => setB({ to: e.target.value })} />
                                        </Field>
                                    </div>
                                    <fieldset>
                                        <legend className="mb-1.5 text-sm font-medium text-ink">On these days</legend>
                                        <div className="flex flex-wrap gap-2">
                                            {WEEKDAYS.map((d, i) => (
                                                <Checkbox
                                                    key={d}
                                                    checked={bulk.weekdays.includes(i)}
                                                    onChange={(on) => setB({ weekdays: on ? [...bulk.weekdays, i].sort() : bulk.weekdays.filter((w) => w !== i) })}
                                                    label={d}
                                                    className="rounded-control border border-line px-2.5 py-1.5"
                                                />
                                            ))}
                                        </div>
                                        <p className="mt-1 text-xs text-ink-faint">None picked = every day.</p>
                                    </fieldset>
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-end gap-2">
                                        <Field label="Date" className="flex-1">
                                            <TextInput type="date" value={bulk.pickDate} min={todayIst()} onChange={(e) => setB({ pickDate: e.target.value })} />
                                        </Field>
                                        <Button
                                            variant="secondary"
                                            icon={Plus}
                                            disabled={!bulk.pickDate || bulk.dates.includes(bulk.pickDate)}
                                            onClick={() => setB({ dates: [...bulk.dates, bulk.pickDate].sort(), pickDate: addDays(bulk.pickDate, 1) })}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                    {bulk.dates.length > 0 ? (
                                        <ul className="flex flex-wrap gap-1.5">
                                            {bulk.dates.map((d) => (
                                                <li key={d}>
                                                    <Tag tone="brand" className="py-1">
                                                        {calendarDate(d)}
                                                        <button type="button" className="-mr-1 rounded p-0.5 hover:bg-accent-100" aria-label={`Remove ${d}`} onClick={() => setB({ dates: bulk.dates.filter((x) => x !== d) })}>
                                                            ×
                                                        </button>
                                                    </Tag>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-ink-faint">No dates picked.</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-ink">Times</legend>
                            {bulk.times.map((t, i) => (
                                <div key={i} className="flex items-end gap-2">
                                    <Field label="Starts" hideLabel={i > 0} className="flex-1">
                                        <TextInput type="time" value={t.start} onChange={(e) => setB({ times: bulk.times.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })} />
                                    </Field>
                                    <Field label="Ends" hideLabel={i > 0} className="flex-1">
                                        <TextInput
                                            type="time"
                                            value={t.end}
                                            invalid={!!t.start && !!t.end && t.end <= t.start}
                                            onChange={(e) => setB({ times: bulk.times.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)) })}
                                        />
                                    </Field>
                                    <IconButton icon={Trash2} label={`Remove time ${i + 1}`} disabled={bulk.times.length === 1} onClick={() => setB({ times: bulk.times.filter((_, j) => j !== i) })} />
                                </div>
                            ))}
                            <Button size="sm" variant="ghost" icon={Plus} disabled={bulk.times.length >= 24} onClick={() => setB({ times: [...bulk.times, { start: "", end: "" }] })}>
                                Add a time
                            </Button>
                        </fieldset>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Spots per slot" required>
                                <TextInput type="number" min={1} max={10000} inputMode="numeric" value={bulk.capacity} onChange={(e) => setB({ capacity: e.target.value })} />
                            </Field>
                            <PriceReadOnly price={priceFor(bulk.option_id || null)} />
                        </div>
                        {bulkProblems.length > 0 && (bulk.dates.length > 0 || bulk.mode === "repeat") && (
                            <Notice tone="warn">
                                <ul className="list-disc pl-4">
                                    {bulkProblems.map((p) => (
                                        <li key={p}>{p}</li>
                                    ))}
                                </ul>
                            </Notice>
                        )}
                    </div>
                )}
            </Drawer>

            {/* Edit one slot */}
            <Modal
                open={!!editing}
                onClose={() => setEditing(null)}
                dismissible={!saveSlot.isPending}
                title="Edit slot"
                description={editing ? `${calendarDate(editing.date)} · ${editing.booked} booked` : undefined}
                icon={Pencil}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setEditing(null)} disabled={saveSlot.isPending}>
                            Cancel
                        </Button>
                        <Button variant="primary" disabled={!patch || Object.keys(patch).length === 0} loading={saveSlot.isPending} onClick={() => saveSlot.mutate()}>
                            Save slot
                        </Button>
                    </>
                }
            >
                {editing && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Spots" hint={editing.booked ? `At least ${editing.booked} (already booked).` : undefined}>
                                <TextInput type="number" min={Math.max(1, editing.booked)} inputMode="numeric" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} />
                            </Field>
                            <PriceReadOnly label="Price" price={editing.price ?? priceFor(editing.option_id)} />
                            <Field label="Starts" hint={editing.booked ? "Booked slots keep their time." : undefined}>
                                <TextInput type="time" value={edit.start} disabled={editing.booked > 0} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />
                            </Field>
                            <Field label="Ends">
                                <TextInput type="time" value={edit.end} disabled={editing.booked > 0} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />
                            </Field>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                open={!!cancelling}
                title="Cancel this slot?"
                description={
                    cancelling
                        ? `${calendarDate(cancelling.date)} at ${hhmmLabel(cancelling.start_time)}.${
                              cancelling.booked ? ` ${cancelling.booked} booked spot${cancelling.booked === 1 ? " is" : "s are"} cancelled and the guests are told. Paid bookings are refunded in full.` : " Nobody has booked it."
                          }`
                        : undefined
                }
                confirmLabel="Cancel slot"
                cancelLabel="Keep slot"
                tone="danger"
                level="reason"
                reasonLabel="Reason for guests"
                reasonPlaceholder="e.g. The guide is unwell"
                reasonMinLength={0}
                reasonMaxLength={300}
                isPending={cancelSlot.isPending}
                onConfirm={(reason) => cancelling && cancelSlot.mutate({ slot: cancelling, reason })}
                onCancel={() => setCancelling(null)}
            />
        </div>
    );
}
