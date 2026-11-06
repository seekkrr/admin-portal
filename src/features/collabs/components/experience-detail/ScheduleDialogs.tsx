import { useMemo, useState } from "react";
import { Copy, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Checkbox, Field, TextInput } from "@/components/ui/Field";
import { addDays, calendarDate, todayIst } from "@/components/detail/detailFormat";
import { experienceDetailApi } from "@/services/admin-detail.service";
import type { ExperienceSlot } from "@/types/admin-detail";
import { copyGroups } from "./schedule";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_CALL = 500;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Mon = 0 … Sun = 6. */
function weekdayOf(iso: string): number {
    const [y, m, d] = iso.split("-").map(Number);
    return (new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay() + 6) % 7;
}

function daysBetween(from: string, to: string): string[] {
    const out: string[] = [];
    for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
    return out;
}

/** New spots for every picked slot (never below what a slot already has booked). */
export function BulkCapacityModal({
    count,
    pending,
    onClose,
    onConfirm,
}: {
    count: number;
    pending: boolean;
    onClose: () => void;
    onConfirm: (capacity: number) => void;
}) {
    const [value, setValue] = useState("");
    const cap = Number.parseInt(value, 10);
    const bad = !Number.isInteger(cap) || cap < 1 || cap > 10000;
    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!pending}
            title={`Change spots for ${plural(count, "slot")}`}
            description="Slots that already have more people booked keep their spots."
            icon={Users}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={pending}>
                        Cancel
                    </Button>
                    <Button variant="primary" disabled={bad} loading={pending} onClick={() => onConfirm(cap)}>
                        Change spots
                    </Button>
                </>
            }
        >
            <Field label="Spots per slot" required>
                <TextInput type="number" min={1} max={10000} inputMode="numeric" value={value} autoFocus onChange={(e) => setValue(e.target.value)} placeholder="8" />
            </Field>
        </Modal>
    );
}

/** Copy one day's open slots (every option, time and spots) to other dates; slots already there are skipped. */
export function CopyDayModal({
    businessId,
    experienceId,
    day,
    slots,
    onClose,
    onCopied,
}: {
    businessId: string;
    experienceId: string;
    day: string;
    slots: ExperienceSlot[];
    onClose: () => void;
    onCopied: (created: number, skipped: number) => void;
}) {
    const today = todayIst();
    const [from, setFrom] = useState(addDays(day, 1) < today ? today : addDays(day, 1));
    const [to, setTo] = useState(addDays(day, 28));
    const [weekdays, setWeekdays] = useState<number[]>([weekdayOf(day)]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const groups = useMemo(() => copyGroups(slots), [slots]);
    const perDay = groups.reduce((n, g) => n + g.times.length, 0);
    const dates = useMemo(
        () => (to < from ? [] : daysBetween(from < today ? today : from, to).filter((d) => d !== day && weekdays.includes(weekdayOf(d)))),
        [from, to, weekdays, day, today]
    );
    const total = dates.length * perDay;
    const tooMany = groups.some((g) => g.times.length * dates.length > MAX_PER_CALL);

    const save = async () => {
        if (!dates.length) {
            setError("No dates match. Pick a range and at least one day of the week.");
            return;
        }
        if (tooMany) {
            setError(`That's too many slots in one go. Copy up to ${MAX_PER_CALL} per option at a time (shorten the range).`);
            return;
        }
        setSaving(true);
        setError(null);
        let created = 0;
        try {
            for (const g of groups) {
                const res = await experienceDetailApi.addSlots(businessId, experienceId, {
                    ...(g.option_id ? { option_id: g.option_id } : {}),
                    dates,
                    times: g.times,
                    capacity: g.capacity,
                });
                created += res.created;
            }
            onCopied(created, Math.max(0, total - created));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't copy the day");
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!saving}
            title={`Copy ${calendarDate(day)} to other dates`}
            description={`${plural(perDay, "slot")} a day, with the same options, times and spots. Times already there are skipped.`}
            icon={Copy}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="primary" loading={saving} disabled={perDay === 0} onClick={() => void save()}>
                        {total ? `Copy ${plural(total, "slot")}` : "Copy"}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="From">
                        <TextInput type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
                    </Field>
                    <Field label="To">
                        <TextInput type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
                    </Field>
                </div>
                <fieldset>
                    <legend className="mb-1.5 text-sm font-medium text-ink">On these days</legend>
                    <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((d, i) => (
                            <Checkbox
                                key={d}
                                checked={weekdays.includes(i)}
                                onChange={(on) => setWeekdays((w) => (on ? [...w, i].sort() : w.filter((x) => x !== i)))}
                                label={d}
                                className="rounded-control border border-line px-2.5 py-1.5"
                            />
                        ))}
                    </div>
                </fieldset>
                <p className="text-sm text-ink-muted" aria-live="polite">
                    {dates.length ? `${plural(dates.length, "date")} · ${plural(total, "slot")} to add` : "No dates picked yet."}
                </p>
                {error && <p className="text-sm text-bad">{error}</p>}
            </div>
        </Modal>
    );
}
