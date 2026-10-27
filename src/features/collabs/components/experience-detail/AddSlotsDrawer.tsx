import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Modal";
import { Checkbox, Field, SelectInput, TextInput } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { Tabs } from "@/components/ui/Tabs";
import { Notice } from "@/components/detail/DetailStates";
import { addDays, calendarDate, rupees, todayIst } from "@/components/detail/detailFormat";
import { experienceDetailApi } from "@/services/admin-detail.service";
import type { BulkSlotsPayload, ExperienceDetail } from "@/types/admin-detail";

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

function blankBulk(firstOption: string, initialDate?: string): BulkForm {
    const today = todayIst();
    return {
        option_id: firstOption,
        mode: initialDate ? "dates" : "repeat",
        dates: initialDate ? [initialDate] : [],
        pickDate: initialDate ? addDays(initialDate, 1) : today,
        from: today,
        to: addDays(today, 27),
        weekdays: [5, 6],
        times: [{ start: "09:00", end: "11:00" }],
        capacity: "10",
    };
}

/** A price shown read-only: prices are set on the Pricing tab (slot = option price ?? price per person ?? free). */
export function PriceReadOnly({ label = "Price per person", price }: { label?: string; price: number | null | undefined }) {
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

/** Add slots in bulk: one option, picked dates or a weekly repeat, one or more times. */
export function AddSlotsDrawer({
    experience,
    initialDate,
    onClose,
    onAdded,
}: {
    experience: ExperienceDetail;
    /** Start with this date picked (the day open on the Schedule). */
    initialDate?: string;
    onClose: () => void;
    onAdded: () => void;
}) {
    const options = experience.options ?? [];
    const [bulk, setBulk] = useState<BulkForm>(() => blankBulk(options[0]?.id ?? "", initialDate));
    const priceFor = (optionId: string | null | undefined): number | null =>
        options.find((o) => o.id === optionId)?.price ?? experience.price_per_person ?? null;

    const bulkDates = useMemo(() => (bulk.mode === "dates" ? bulk.dates : repeatDates(bulk.from, bulk.to, bulk.weekdays)), [bulk]);
    const validTimes = bulk.times.filter((t) => t.start && t.end && t.end > t.start);
    const slotCount = bulkDates.length * validTimes.length;
    const capacityNum = Number.parseInt(bulk.capacity, 10);
    const problems: string[] = [];
    if (options.length && !bulk.option_id) problems.push("Pick an option.");
    if (!bulkDates.length) problems.push("Pick at least one date.");
    if (!validTimes.length) problems.push("Add a time that ends after it starts.");
    if (validTimes.length !== bulk.times.length) problems.push("Every time must end after it starts.");
    if (!Number.isFinite(capacityNum) || capacityNum < 1 || capacityNum > 10000) problems.push("Capacity is 1 to 10,000.");
    if (slotCount > MAX_SLOTS) problems.push(`That's ${slotCount} slots; add at most ${MAX_SLOTS} at a time.`);

    const addSlots = useMutation({
        mutationFn: () => {
            const payload: BulkSlotsPayload = {
                times: validTimes,
                capacity: capacityNum,
                ...(bulk.option_id ? { option_id: bulk.option_id } : {}),
                ...(bulk.mode === "dates" ? { dates: bulk.dates } : { from: bulk.from, to: bulk.to, weekdays: bulk.weekdays }),
            };
            return experienceDetailApi.addSlots(experience.business_id, experience.id, payload);
        },
        onSuccess: (res) => {
            const skipped = res.skipped + res.skipped_past;
            toast.success(`${res.created} slot${res.created === 1 ? "" : "s"} added${skipped ? ` · ${skipped} skipped (already there or already past)` : ""}`);
            onAdded();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const setB = (patch: Partial<BulkForm>) => setBulk((b) => ({ ...b, ...patch }));

    return (
        <Drawer
            open
            onClose={onClose}
            dismissible={!addSlots.isPending}
            title="Add slots"
            subtitle={experience.title}
            footer={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-ink-muted" aria-live="polite">
                        {slotCount ? `Adds up to ${slotCount} slot${slotCount === 1 ? "" : "s"}` : "Nothing to add yet"}
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <Button variant="secondary" onClick={onClose} disabled={addSlots.isPending}>
                            Cancel
                        </Button>
                        <Button variant="primary" icon={Plus} disabled={problems.length > 0} loading={addSlots.isPending} onClick={() => addSlots.mutate()}>
                            Add slots
                        </Button>
                    </div>
                </div>
            }
        >
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
                {problems.length > 0 && (bulk.dates.length > 0 || bulk.mode === "repeat") && (
                    <Notice tone="warn">
                        <ul className="list-disc pl-4">
                            {problems.map((p) => (
                                <li key={p}>{p}</li>
                            ))}
                        </ul>
                    </Notice>
                )}
            </div>
        </Drawer>
    );
}
