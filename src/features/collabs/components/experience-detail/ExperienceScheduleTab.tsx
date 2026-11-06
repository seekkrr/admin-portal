import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, CalendarX2, CheckSquare, Copy, Lock, LockOpen, Users, X } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tag } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/States";
import { SectionState } from "@/components/detail/DetailStates";
import { addDays, calendarDate, todayIst } from "@/components/detail/detailFormat";
import { experienceDetailApi } from "@/services/admin-detail.service";
import type { BulkSlotChange, ExperienceDetail, ExperienceSlot } from "@/types/admin-detail";
import { AddSlotsDrawer } from "./AddSlotsDrawer";
import { BulkCapacityModal, CopyDayModal } from "./ScheduleDialogs";
import { DayStrip, DayTimeline, SlotLegend } from "./ScheduleTimeline";
import { SlotDrawer } from "./SlotDrawer";
import { dayStats, isActionable } from "./schedule";

const WINDOW_DAYS = 14;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Slots and who's in them, one day at a time: a date strip with how full each
 * day is, every option's slots on one timeline, a slot drawer (bookings,
 * check-in, walk-ins, block, edit, cancel) and bulk changes for picked slots.
 * Uses the business's routes, which admins pass.
 */
export function ExperienceScheduleTab({ experience, canEdit }: { experience: ExperienceDetail; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const businessId = experience.business_id;
    const options = experience.options ?? [];
    const today = todayIst();
    const [windowStart, setWindowStart] = useState(today);
    const [day, setDay] = useState(today);
    const [option, setOption] = useState("all");
    const [activeId, setActiveId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [copying, setCopying] = useState(false);
    const [selecting, setSelecting] = useState(false);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [resizing, setResizing] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const windowEnd = addDays(windowStart, WINDOW_DAYS - 1);
    const query = useQuery({
        queryKey: ["experience-slots", experience.id, windowStart, windowEnd],
        queryFn: () => experienceDetailApi.slots(businessId, experience.id, { from: windowStart, to: windowEnd }),
        retry: false,
    });
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["experience-slots", experience.id] });
        queryClient.invalidateQueries({ queryKey: ["experience-bookings", experience.id] });
        queryClient.invalidateQueries({ queryKey: ["experience-detail", experience.id] });
        queryClient.invalidateQueries({ queryKey: ["admin-audit", "experience", experience.id] });
    };

    const all = useMemo(() => query.data ?? [], [query.data]);
    const byDay = useMemo(() => {
        const map = new Map<string, ExperienceSlot[]>();
        for (const s of all) {
            if (option !== "all" && s.option_id !== option) continue;
            map.set(s.date, [...(map.get(s.date) ?? []), s]);
        }
        return map;
    }, [all, option]);
    const daySlots = byDay.get(day) ?? [];
    const stats = dayStats(daySlots);
    const active = all.find((s) => s.id === activeId) ?? null;
    const selectable = daySlots.filter((s) => isActionable(s));
    const pickedSlots = daySlots.filter((s) => picked.has(s.id));
    const pickedBooked = pickedSlots.reduce((n, s) => n + s.booked, 0);
    const scheduling = experience.scheduling;

    const stopSelecting = () => {
        setSelecting(false);
        setPicked(new Set());
    };
    const pickDay = (next: string) => {
        setDay(next);
        setPicked(new Set());
        if (next < windowStart || next > windowEnd) setWindowStart(next);
    };
    const moveWindow = (delta: number) => {
        const start = addDays(windowStart, delta) < today ? today : addDays(windowStart, delta);
        setWindowStart(start);
        setDay(start);
        setPicked(new Set());
    };

    const bulk = useMutation({
        mutationFn: (change: Omit<BulkSlotChange, "slot_ids">) =>
            experienceDetailApi.bulkUpdateSlots(businessId, experience.id, { ...change, slot_ids: pickedSlots.map((s) => s.id) }),
        onSuccess: (res, change) => {
            const verb = { block: "Blocked", unblock: "Unblocked", capacity: "Changed spots on", cancel: "Cancelled" }[change.action];
            if (res.changed) {
                toast.success(`${verb} ${plural(res.changed, "slot")}${res.cancelled_bookings ? ` · ${plural(res.cancelled_bookings, "booking")} cancelled and told` : ""}`);
            }
            if (res.skipped.length) toast.warning(`${plural(res.skipped.length, "slot")} skipped: ${[...new Set(res.skipped.map((s) => s.reason))].join("; ")}`);
            setResizing(false);
            setCancelling(false);
            stopSelecting();
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-muted">How bookings work:</span>
                {scheduling?.shared_space && <Tag tone="brand">One shared space</Tag>}
                {scheduling?.private_slots && <Tag tone="brand">One group per slot</Tag>}
                {!scheduling?.shared_space && !scheduling?.private_slots && <Tag>Each slot has its own spots</Tag>}
                <span className="text-xs text-ink-faint">Change it on the Content tab.</span>
                {canEdit && (
                    <Button size="sm" variant="primary" icon={CalendarPlus} className="ml-auto" disabled={experience.status === "archived"} onClick={() => setAdding(true)}>
                        Add slots
                    </Button>
                )}
            </div>

            <DayStrip start={windowStart} days={WINDOW_DAYS} selected={day} slotsByDay={byDay} onSelect={pickDay} onMove={moveWindow} onJump={pickDay} />

            {options.length > 1 && (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Option">
                    {[{ id: "all", name: "All options" }, ...options].map((o) => (
                        <button
                            key={o.id}
                            type="button"
                            role="radio"
                            aria-checked={option === o.id}
                            onClick={() => {
                                setOption(o.id);
                                setPicked(new Set());
                            }}
                            className={
                                option === o.id
                                    ? "rounded-full border border-brand-900 bg-brand-900 px-3 py-1.5 text-sm font-medium text-white"
                                    : "rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-brand-200"
                            }
                        >
                            {o.name}
                        </button>
                    ))}
                </div>
            )}

            <Panel
                title={calendarDate(day)}
                icon={CalendarClock}
                description={stats.slots ? `${plural(stats.slots, "slot")} · ${stats.booked} of ${stats.capacity} places booked · times are India time` : "No slots"}
                bodyClassName="p-0"
                actions={
                    canEdit && daySlots.length > 0 && !selecting ? (
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="ghost" icon={CalendarPlus} onClick={() => setAdding(true)}>
                                Add to this day
                            </Button>
                            <Button size="sm" variant="ghost" icon={Copy} onClick={() => setCopying(true)}>
                                Copy day to…
                            </Button>
                            <Button
                                size="sm"
                                icon={CheckSquare}
                                disabled={!selectable.length}
                                onClick={() => {
                                    setSelecting(true);
                                    setActiveId(null);
                                }}
                            >
                                Select slots
                            </Button>
                        </div>
                    ) : undefined
                }
            >
                {selecting && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-accent-200 bg-accent-50 px-4 py-2.5 sm:px-5" aria-live="polite">
                        <span className="text-sm font-semibold text-brand-900">{plural(picked.size, "slot")} selected</span>
                        <button
                            type="button"
                            className="text-sm font-medium text-accent-700 hover:underline"
                            onClick={() => setPicked(picked.size === selectable.length ? new Set() : new Set(selectable.map((s) => s.id)))}
                        >
                            {picked.size === selectable.length ? "Clear" : "Select whole day"}
                        </button>
                        <div className="ml-auto flex flex-wrap gap-2">
                            <Button size="sm" icon={Lock} disabled={!picked.size || bulk.isPending} loading={bulk.isPending && bulk.variables?.action === "block"} onClick={() => bulk.mutate({ action: "block" })}>
                                Block
                            </Button>
                            <Button size="sm" icon={LockOpen} disabled={!picked.size || bulk.isPending} loading={bulk.isPending && bulk.variables?.action === "unblock"} onClick={() => bulk.mutate({ action: "unblock" })}>
                                Unblock
                            </Button>
                            <Button size="sm" icon={Users} disabled={!picked.size || bulk.isPending} onClick={() => setResizing(true)}>
                                Change spots
                            </Button>
                            <Button size="sm" variant="danger" icon={CalendarX2} disabled={!picked.size || bulk.isPending} onClick={() => setCancelling(true)}>
                                Cancel
                            </Button>
                            <Button size="sm" variant="ghost" icon={X} onClick={stopSelecting}>
                                Done
                            </Button>
                        </div>
                    </div>
                )}
                <div className="px-3 py-4 sm:px-5">
                    <SectionState isLoading={query.isLoading} error={query.error} what="Slots" onRetry={() => query.refetch()}>
                        {daySlots.length === 0 ? (
                            <EmptyState
                                icon={CalendarX2}
                                title={day < today ? "This day has passed" : "No slots on this day"}
                                description={day < today ? "Pick today or a later day." : canEdit ? "Add slots, or copy a day that's already set up." : undefined}
                            />
                        ) : (
                            <div className="space-y-3">
                                <DayTimeline
                                    slots={daySlots}
                                    options={options}
                                    activeId={activeId}
                                    selecting={selecting}
                                    picked={picked}
                                    onOpen={(s) => setActiveId(s.id)}
                                    onToggle={(s) => {
                                        if (!isActionable(s)) return;
                                        setPicked((p) => {
                                            const next = new Set(p);
                                            if (next.has(s.id)) next.delete(s.id);
                                            else next.add(s.id);
                                            return next;
                                        });
                                    }}
                                />
                                <SlotLegend />
                            </div>
                        )}
                    </SectionState>
                </div>
            </Panel>

            {active && <SlotDrawer key={active.id} experience={experience} slot={active} canEdit={canEdit} onClose={() => setActiveId(null)} onChanged={refresh} />}

            {adding && (
                <AddSlotsDrawer
                    experience={experience}
                    initialDate={day >= today ? day : undefined}
                    onClose={() => setAdding(false)}
                    onAdded={() => {
                        setAdding(false);
                        refresh();
                    }}
                />
            )}

            {copying && (
                <CopyDayModal
                    businessId={businessId}
                    experienceId={experience.id}
                    day={day}
                    slots={daySlots}
                    onClose={() => setCopying(false)}
                    onCopied={(created, skipped) => {
                        setCopying(false);
                        refresh();
                        toast.success(`Copied ${plural(created, "slot")}${skipped ? ` · ${skipped} already there` : ""}`);
                    }}
                />
            )}

            {resizing && <BulkCapacityModal count={picked.size} pending={bulk.isPending} onClose={() => setResizing(false)} onConfirm={(capacity) => bulk.mutate({ action: "capacity", capacity })} />}

            <ConfirmDialog
                open={cancelling}
                title={`Cancel ${plural(picked.size, "slot")}?`}
                description={
                    pickedBooked
                        ? `${plural(pickedBooked, "booked spot is", "booked spots are")} in them. Those bookings are cancelled, paid ones are refunded in full, and the guests are told.`
                        : "Nobody has booked them."
                }
                confirmLabel="Cancel slots"
                cancelLabel="Keep slots"
                tone="danger"
                level="reason"
                reasonLabel="Reason for guests"
                reasonPlaceholder="Closed for rain"
                reasonMinLength={0}
                reasonMaxLength={300}
                isPending={bulk.isPending}
                onConfirm={(reason) => bulk.mutate({ action: "cancel", reason: reason || undefined })}
                onCancel={() => setCancelling(false)}
            />
        </div>
    );
}
