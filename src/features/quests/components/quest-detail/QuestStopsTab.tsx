import { useMemo, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Flag, GripVertical, ListOrdered, MapPin, Plus, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Switch } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { SaveBar } from "@/components/detail/SaveBar";
import { Notice } from "@/components/detail/DetailStates";
import { PlaceSearchPicker } from "@/components/detail/PlaceSearchPicker";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { DetailApiError, questDetailApi } from "@/services/admin-detail.service";
import { cx } from "@/utils/cx";
import type { Marker, V2QuestDetail } from "@/types";
import type { QuestStopPayload } from "@/types/admin-detail";

interface Stop {
    marker_id: string;
    name: string;
    image: string | null;
    detail: string;
    is_required: boolean;
    things_to_do_text: string | null;
    things_to_do_image_url: string | null;
}

function stopsOf(q: V2QuestDetail): Stop[] {
    return [...(q.marker_summaries ?? [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((m) => ({
            marker_id: m.marker_id,
            name: m.name ?? "Unnamed place",
            image: m.images?.[0]?.secure_url ?? null,
            detail: (m.categories ?? []).join(", "),
            is_required: m.is_required !== false,
            things_to_do_text: m.things_to_do_text ?? null,
            things_to_do_image_url: m.things_to_do_image_url ?? null,
        }));
}

/** Refusals the server lets an admin override with `force`. */
function needsForce(e: unknown): boolean {
    if (!(e instanceof DetailApiError)) return false;
    const d = e.details as { force?: boolean; force_required?: boolean } | null;
    return e.status === 409 || !!d?.force || !!d?.force_required || /force/i.test(e.message);
}

/** Ordered stops: add approved places, reorder (drag or arrows), required/optional, remove. */
export function QuestStopsTab({ quest, canEdit, onSaved }: { quest: V2QuestDetail; canEdit: boolean; onSaved: () => void }) {
    const base = useMemo(() => stopsOf(quest), [quest]);
    const [stops, setStops, reset] = useSyncedDraft<Stop[]>(base);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);
    const [forceMessage, setForceMessage] = useState<string | null>(null);
    const dirty = JSON.stringify(stops) !== JSON.stringify(base);
    const startId = quest.start_point?.marker_id ?? null;

    const payload = (): QuestStopPayload[] =>
        stops.map((s, i) => ({
            marker_id: s.marker_id,
            suggested_order: i + 1,
            is_required: s.is_required,
            things_to_do_text: s.things_to_do_text,
            things_to_do_image_url: s.things_to_do_image_url,
        }));

    const save = useMutation({
        mutationFn: (force: boolean) => questDetailApi.saveStops(quest.id, payload(), force),
        onSuccess: (_, force) => {
            toast.success(force ? "Stops saved (override)" : "Stops saved");
            setForceMessage(null);
            onSaved();
        },
        onError: (e: Error, force) => {
            if (!force && needsForce(e)) setForceMessage(e.message);
            else toast.error(e.message);
        },
    });

    const move = (from: number, to: number) => {
        if (to < 0 || to >= stops.length || from === to) return;
        const next = [...stops];
        const [item] = next.splice(from, 1);
        if (!item) return;
        next.splice(to, 0, item);
        setStops(next);
    };
    const add = (m: Marker) => {
        if (stops.some((s) => s.marker_id === m.id)) return;
        setStops([
            ...stops,
            { marker_id: m.id, name: m.title, image: m.media?.[0] ?? null, detail: (m.categories ?? []).join(", "), is_required: true, things_to_do_text: null, things_to_do_image_url: null },
        ]);
        toast.success(`${m.title} added as stop ${stops.length + 1}. Save to keep it.`);
    };

    const dragProps = (i: number) =>
        canEdit
            ? {
                  draggable: true,
                  onDragStart: (e: DragEvent) => {
                      setDragIndex(i);
                      e.dataTransfer.effectAllowed = "move";
                  },
                  onDragOver: (e: DragEvent) => {
                      e.preventDefault();
                      setOverIndex(i);
                  },
                  onDrop: (e: DragEvent) => {
                      e.preventDefault();
                      if (dragIndex !== null) move(dragIndex, i);
                      setDragIndex(null);
                      setOverIndex(null);
                  },
                  onDragEnd: () => {
                      setDragIndex(null);
                      setOverIndex(null);
                  },
              }
            : {};

    return (
        <div className="space-y-5">
            {quest.status === "Published" && canEdit && (
                <Notice tone="warn" title="This quest is live">
                    People who booked it see the new stops straight away. If anyone has an active booking, the server asks before changing the stops.
                </Notice>
            )}
            <Panel title={`Stops (${stops.length})`} icon={ListOrdered} description={canEdit ? "Drag or use the arrows to change the order." : undefined} bodyClassName="p-0">
                {stops.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-ink-faint">No stops yet.</p>
                ) : (
                    <ol className="divide-y divide-line">
                        {stops.map((s, i) => (
                            <li
                                key={s.marker_id}
                                {...dragProps(i)}
                                className={cx(
                                    "flex items-center gap-3 px-3 py-3 sm:px-4",
                                    overIndex === i && dragIndex !== i && "bg-accent-50",
                                    dragIndex === i && "opacity-50"
                                )}
                            >
                                {canEdit && <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-ink-faint md:block" aria-hidden />}
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">{i + 1}</span>
                                {s.image ? (
                                    <img src={s.image} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                                ) : (
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-500">
                                        <MapPin className="h-4 w-4" aria-hidden />
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <Link to={`/markers/${s.marker_id}`} className="truncate text-sm font-medium text-ink hover:text-accent-700 hover:underline">
                                            {s.name}
                                        </Link>
                                        {s.marker_id === startId && (
                                            <Tag tone="good" title="Start point">
                                                <Flag className="h-3 w-3" aria-hidden /> Start
                                            </Tag>
                                        )}
                                    </div>
                                    <p className="truncate text-xs text-ink-muted">
                                        {s.is_required ? "Required" : "Optional"}
                                        {s.detail ? ` · ${s.detail}` : ""}
                                    </p>
                                </div>
                                <Switch
                                    size="sm"
                                    hideLabel
                                    checked={s.is_required}
                                    label={`${s.name} is required`}
                                    disabled={!canEdit}
                                    onChange={(on) => setStops(stops.map((x, j) => (j === i ? { ...x, is_required: on } : x)))}
                                />
                                {canEdit && (
                                    <div className="flex shrink-0 gap-0.5">
                                        <IconButton icon={ArrowUp} size="sm" label={`Move ${s.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)} />
                                        <IconButton icon={ArrowDown} size="sm" label={`Move ${s.name} down`} disabled={i === stops.length - 1} onClick={() => move(i, i + 1)} />
                                        <IconButton
                                            icon={Trash2}
                                            size="sm"
                                            label={`Remove ${s.name}`}
                                            className="hover:bg-bad-soft hover:text-bad"
                                            onClick={() => setStops(stops.filter((_, j) => j !== i))}
                                        />
                                    </div>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </Panel>

            {canEdit && (
                <Panel title="Add a stop" icon={Plus} description="Only approved places can be stops.">
                    <PlaceSearchPicker onPick={add} excludeIds={stops.map((s) => s.marker_id)} status="approved" />
                </Panel>
            )}

            <SaveBar dirty={dirty && canEdit} saving={save.isPending} invalid={stops.length === 0} onSave={() => save.mutate(false)} onDiscard={reset} saveLabel="Save stops" />

            <ConfirmDialog
                open={!!forceMessage}
                title="Save the stops anyway?"
                description={
                    <>
                        <p>{forceMessage}</p>
                        <p className="mt-2">Saving anyway changes the route for people already on this quest.</p>
                    </>
                }
                confirmLabel="Save anyway"
                tone="warning"
                isPending={save.isPending}
                onConfirm={() => save.mutate(true)}
                onCancel={() => setForceMessage(null)}
            />
        </div>
    );
}
