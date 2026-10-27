import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX2, CheckCircle2, Lock, LockOpen, Minus, Pencil, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextInput } from "@/components/ui/Field";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Notice, SectionState } from "@/components/detail/DetailStates";
import { calendarDate, hhmmLabel, rupees, todayIst } from "@/components/detail/detailFormat";
import { PaymentStatusPill } from "@/features/experience-payments/components/PaymentStatusPill";
import { experienceDetailApi } from "@/services/admin-detail.service";
import type { ExperienceBooking, ExperienceDetail, ExperienceSlot } from "@/types/admin-detail";
import { cx } from "@/utils/cx";
import { EditSlotModal } from "./EditSlotModal";
import { SLOT_STATE_META, isActionable, slotState } from "./schedule";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function guest(b: ExperienceBooking): string {
    return b.user?.name || b.contact?.name || (b.source === "offline" ? "Walk-in" : b.user_id ? `User …${b.user_id.slice(-6)}` : "Guest");
}

/** Everything about one slot: who's booked (check in), walk-ins, block, edit, cancel. */
export function SlotDrawer({
    experience,
    slot,
    canEdit,
    onClose,
    onChanged,
}: {
    experience: ExperienceDetail;
    slot: ExperienceSlot;
    canEdit: boolean;
    onClose: () => void;
    onChanged: () => void;
}) {
    const businessId = experience.business_id;
    const [editing, setEditing] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [walkIn, setWalkIn] = useState(false);
    const optionName = (experience.options ?? []).find((o) => o.id === slot.option_id)?.name ?? slot.option_name ?? null;
    const state = slotState(slot);
    const meta = SLOT_STATE_META[state];
    const left = Math.max(0, slot.capacity - slot.booked);
    const actionable = isActionable(slot);
    const ended = slot.ends_at ? Date.parse(slot.ends_at) <= Date.now() : slot.date < todayIst();

    const bookings = useQuery({
        queryKey: ["experience-bookings", experience.id, "slot-day", slot.date],
        queryFn: () => experienceDetailApi.bookings(businessId, { experience_id: experience.id, date: slot.date, page_size: 100 }),
        retry: false,
    });
    const here = (bookings.data?.bookings ?? []).filter((b) => b.items.some((i) => i.slot_id === slot.id));
    const peopleHere = (b: ExperienceBooking) => b.items.filter((i) => i.slot_id === slot.id).reduce((n, i) => n + i.people, 0);

    const checkIn = useMutation({
        mutationFn: (b: ExperienceBooking) => experienceDetailApi.checkIn(businessId, b.id),
        onSuccess: (_, b) => {
            toast.success(`${guest(b)} checked in`);
            onChanged();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const block = useMutation({
        mutationFn: () => experienceDetailApi.updateSlot(businessId, slot.id, { blocked: !slot.blocked }),
        onSuccess: () => {
            toast.success(slot.blocked ? "Slot open to travellers again" : "Slot blocked");
            onChanged();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const cancel = useMutation({
        mutationFn: (reason?: string) => experienceDetailApi.cancelSlot(businessId, slot.id, reason),
        onSuccess: (res) => {
            toast.success(`Slot cancelled${res.cancelled_bookings ? ` · ${plural(res.cancelled_bookings, "booking")} told` : ""}`);
            setCancelling(false);
            onChanged();
            onClose();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <>
            <Drawer
                open
                onClose={onClose}
                width="lg"
                title={`${optionName ? `${optionName} · ` : ""}${hhmmLabel(slot.start_time)} – ${hhmmLabel(slot.end_time)}`}
                subtitle={
                    <span className="inline-flex flex-wrap items-center gap-2">
                        {calendarDate(slot.date)}
                        <Tag>
                            <span className={cx("h-2 w-2 rounded-full", meta.dot)} aria-hidden /> {meta.label}
                        </Tag>
                    </span>
                }
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-card border border-line p-3">
                            <p className="text-xs text-ink-faint">Booked</p>
                            <p className="text-xl font-semibold tabular-nums text-ink">
                                {slot.booked} <span className="text-sm font-normal text-ink-muted">of {slot.capacity}</span>
                            </p>
                            <p className="text-xs text-ink-muted">{plural(left, "spot")} left</p>
                        </div>
                        <div className="rounded-card border border-line p-3">
                            <p className="text-xs text-ink-faint">Price per person</p>
                            <p className="text-xl font-semibold tabular-nums text-ink">{rupees(slot.price)}</p>
                            <p className="text-xs text-ink-muted">Set on the Pricing tab</p>
                        </div>
                    </div>

                    {slot.taken_by && state === "taken" && (
                        <Notice tone="info">
                            {slot.taken_by.option_name ?? "Another session"} holds the space from {hhmmLabel(slot.taken_by.start_time)} to{" "}
                            {hhmmLabel(slot.taken_by.end_time)}, so travellers can't book this time.
                        </Notice>
                    )}
                    {slot.blocked && <Notice tone="warn">Blocked: travellers see it as booked. Bookings already in it stay, and walk-ins can still be added.</Notice>}
                    {state === "no_price" && <Notice tone="warn">This option has no price yet, so travellers can't book it. Set one on the Pricing tab.</Notice>}

                    <section>
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="font-semibold text-ink">Who's coming</h3>
                            {canEdit && !ended && slot.status === "open" && (
                                <Button size="sm" icon={UserPlus} onClick={() => setWalkIn((v) => !v)}>
                                    Add walk-in
                                </Button>
                            )}
                        </div>
                        {walkIn && (
                            <WalkInForm
                                businessId={businessId}
                                slot={slot}
                                maxPeople={Math.max(1, left)}
                                onDone={() => setWalkIn(false)}
                                onSaved={() => {
                                    setWalkIn(false);
                                    onChanged();
                                }}
                            />
                        )}
                        <SectionState isLoading={bookings.isLoading} error={bookings.error} what="Bookings" onRetry={() => bookings.refetch()}>
                            {here.length === 0 ? (
                                <p className="text-sm text-ink-muted">No bookings yet.</p>
                            ) : (
                                <ul className="divide-y divide-line rounded-card border border-line">
                                    {here.map((b) => (
                                        <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-ink">
                                                    {b.user_id ? (
                                                        <Link to={`/users/${b.user_id}`} className="hover:text-accent-700 hover:underline">
                                                            {guest(b)}
                                                        </Link>
                                                    ) : (
                                                        guest(b)
                                                    )}
                                                    <span className="font-normal text-ink-muted"> · {plural(peopleHere(b), "person", "people")}</span>
                                                </p>
                                                <p className="font-mono text-xs text-ink-faint">
                                                    {b.code ?? b.id.slice(-8)}
                                                    {b.contact?.phone ? <span className="font-sans"> · {b.contact.phone}</span> : null}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {b.source === "offline" ? <Tag>Walk-in</Tag> : <PaymentStatusPill status={b.payment?.status} />}
                                                <StatusPill status={b.status} />
                                                {canEdit && b.status === "confirmed" && slot.date === todayIst() && (
                                                    <Button
                                                        size="sm"
                                                        icon={CheckCircle2}
                                                        loading={checkIn.isPending && checkIn.variables?.id === b.id}
                                                        onClick={() => checkIn.mutate(b)}
                                                    >
                                                        Check in
                                                    </Button>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </SectionState>
                    </section>

                    {canEdit && actionable && (
                        <section>
                            <h3 className="mb-2 font-semibold text-ink">Manage this slot</h3>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <Button icon={slot.blocked ? LockOpen : Lock} loading={block.isPending} onClick={() => block.mutate()}>
                                    {slot.blocked ? "Unblock" : "Block (sold offline)"}
                                </Button>
                                <Button icon={Pencil} onClick={() => setEditing(true)}>
                                    Change spots or time
                                </Button>
                                <Button variant="ghost" icon={CalendarX2} className="text-bad hover:bg-bad-soft hover:text-bad sm:col-span-2" onClick={() => setCancelling(true)}>
                                    Cancel slot
                                </Button>
                            </div>
                        </section>
                    )}
                </div>
            </Drawer>

            {editing && (
                <EditSlotModal
                    experience={experience}
                    slot={slot}
                    onClose={() => setEditing(false)}
                    onSaved={() => {
                        setEditing(false);
                        onChanged();
                    }}
                />
            )}

            <ConfirmDialog
                open={cancelling}
                title="Cancel this slot?"
                description={`${calendarDate(slot.date)} at ${hhmmLabel(slot.start_time)}.${
                    slot.booked
                        ? ` ${plural(slot.booked, "booked spot is", "booked spots are")} cancelled and the guests are told. Paid bookings are refunded in full.`
                        : " Nobody has booked it."
                }`}
                confirmLabel="Cancel slot"
                cancelLabel="Keep slot"
                tone="danger"
                level="reason"
                reasonLabel="Reason for guests"
                reasonPlaceholder="The track is closed for repairs"
                reasonMinLength={0}
                reasonMaxLength={300}
                isPending={cancel.isPending}
                onConfirm={(reason) => cancel.mutate(reason || undefined)}
                onCancel={() => setCancelling(false)}
            />
        </>
    );
}

/** Record a walk-in or phone booking: confirmed at once, nobody is notified. */
function WalkInForm({
    businessId,
    slot,
    maxPeople,
    onDone,
    onSaved,
}: {
    businessId: string;
    slot: ExperienceSlot;
    maxPeople: number;
    onDone: () => void;
    onSaved: () => void;
}) {
    const [people, setPeople] = useState(1);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const phoneBad = !!phone.trim() && !/^\+?[0-9][0-9 -]{5,18}$/.test(phone.trim());
    const save = useMutation({
        mutationFn: () => experienceDetailApi.addOfflineBooking(businessId, slot.id, { people, name: name.trim() || undefined, phone: phone.trim() || undefined }),
        onSuccess: () => {
            toast.success(`Walk-in added · ${plural(people, "person", "people")}`);
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    return (
        <div className="mb-3 space-y-3 rounded-card border border-accent-200 bg-accent-50/50 p-3">
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink">People</span>
                <div className="inline-flex items-center rounded-control border border-line-strong bg-surface">
                    <button type="button" aria-label="Fewer people" className="p-2 disabled:opacity-30" disabled={people <= 1} onClick={() => setPeople((n) => n - 1)}>
                        <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                        {people}
                    </span>
                    <button type="button" aria-label="More people" className="p-2 disabled:opacity-30" disabled={people >= maxPeople} onClick={() => setPeople((n) => n + 1)}>
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                </div>
                <span className="text-xs text-ink-muted">{plural(maxPeople, "spot")} left</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name (optional)">
                    <TextInput maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Riya Sharma" />
                </Field>
                <Field label="Phone (optional)" error={phoneBad ? "Digits only, like +91 98765 43210." : undefined}>
                    <TextInput inputMode="tel" maxLength={20} value={phone} invalid={phoneBad} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </Field>
            </div>
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onDone} disabled={save.isPending}>
                    Cancel
                </Button>
                <Button size="sm" variant="primary" disabled={phoneBad} loading={save.isPending} onClick={() => save.mutate()}>
                    Add walk-in
                </Button>
            </div>
        </div>
    );
}
