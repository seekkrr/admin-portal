import { forwardRef, useEffect, useMemo, useRef, useState, type DragEvent, type LiHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Compass,
    Globe,
    GripVertical,
    Handshake,
    Map as MapIcon,
    MapPin,
    Pencil,
    Save,
    Star,
    Undo2,
} from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { useCollabAccess } from "@/features/collabs/roles";
import { Chip, LoadingButtonIcon, PageHeader, PanelState, SectionCard, btnPrimary, btnSecondary, btnSmNeutral } from "@/features/collabs/components/CollabsUi";
import { EXPLORE_REGIONS_QUERY_KEY, exploreMapService, patchRegionInCache, replaceRegionInCache } from "../services/explore-map.service";
import { RegionSettingsDrawer } from "../components/RegionSettingsDrawer";
import type { ExploreRegion } from "../types";

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The app's default is the first region it actually shows. */
const isShown = (r: ExploreRegion) => r.visible && r.is_active;

function VisibleSwitch({ on, label, disabled, onToggle }: { on: boolean; label: string; disabled?: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onToggle}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-neutral-300"}`}
        >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
    );
}

/** Keyboard/touch alternative to dragging. Bigger, bordered targets when the list is narrow. */
const MoveButton = forwardRef<HTMLButtonElement, { direction: "up" | "down"; name: string; disabled: boolean; onClick: () => void }>(function MoveButton(
    { direction, name, disabled, onClick },
    ref
) {
    const Icon = direction === "up" ? ChevronUp : ChevronDown;
    return (
        <button
            ref={ref}
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={`Move ${name} ${direction}`}
            title={`Move ${direction}`}
            className="p-1.5 @2xl:p-0.5 rounded-lg @2xl:rounded border border-neutral-200 @2xl:border-0 text-neutral-500 @2xl:text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
            <Icon className="w-4 h-4" />
        </button>
    );
});

function RegionRow({
    region,
    position,
    total,
    isDefault,
    isDragging,
    locked,
    onMove,
    onEdit,
    dragProps,
}: {
    region: ExploreRegion;
    position: number;
    total: number;
    isDefault: boolean;
    isDragging: boolean;
    locked: boolean;
    onMove: (delta: -1 | 1) => void;
    onEdit: () => void;
    dragProps: LiHTMLAttributes<HTMLLIElement>;
}) {
    const queryClient = useQueryClient();
    const [thumbFailed, setThumbFailed] = useState(false);
    const upRef = useRef<HTMLButtonElement>(null);
    const downRef = useRef<HTMLButtonElement>(null);

    // Reordering can re-insert this row's DOM node, which drops focus. Put it back
    // on the same arrow (or the other one once the row hits the top/bottom).
    const moveKeepingFocus = (delta: -1 | 1) => {
        const own = delta < 0 ? upRef : downRef;
        const other = delta < 0 ? downRef : upRef;
        const hadFocus = document.activeElement === own.current;
        onMove(delta);
        if (!hadFocus) return;
        requestAnimationFrame(() => {
            const target = own.current && !own.current.disabled ? own.current : other.current;
            if (target && document.activeElement !== target) target.focus();
        });
    };

    const setVisible = useMutation({
        mutationFn: (visible: boolean) => exploreMapService.updateRegion(region.id, { visible }),
        onMutate: async (visible) => {
            await queryClient.cancelQueries({ queryKey: EXPLORE_REGIONS_QUERY_KEY });
            patchRegionInCache(queryClient, region.id, { visible });
        },
        onError: (e: Error, visible) => {
            patchRegionInCache(queryClient, region.id, { visible: !visible });
            toast.error(e.message || `Couldn't update ${region.name}`);
        },
        onSuccess: (fresh) => {
            replaceRegionInCache(queryClient, fresh);
            toast.success(fresh.visible ? `${fresh.name} is now on the explore map` : `${fresh.name} is hidden from the explore map`);
        },
    });

    const muted = !isShown(region);

    return (
        <li
            {...dragProps}
            className={`group flex flex-wrap @2xl:flex-nowrap items-center gap-3 px-3 @lg:px-4 py-3 rounded-xl border transition-colors ${
                isDragging
                    ? "opacity-50 border-dashed border-teal-400 bg-teal-50/60"
                    : muted
                      ? "border-neutral-200 bg-neutral-50/80"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
            }`}
        >
            <span
                className={`hidden @lg:flex text-neutral-300 group-hover:text-neutral-500 ${locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                title="Drag to reorder"
                aria-hidden="true"
            >
                <GripVertical className="w-4 h-4" />
            </span>
            <span className="w-6 text-center text-xs font-semibold tabular-nums text-neutral-400 shrink-0">{position + 1}</span>

            <div className={`w-12 h-9 @lg:w-16 @lg:h-11 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center ${muted ? "opacity-60" : ""}`}>
                {region.cover_image && !thumbFailed ? (
                    <img src={region.cover_image} alt="" draggable={false} className="w-full h-full object-cover" onError={() => setThumbFailed(true)} />
                ) : (
                    <Globe className="w-5 h-5 text-white/80" />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-semibold truncate ${muted ? "text-neutral-500" : "text-neutral-900"}`}>{region.name}</span>
                    {isDefault && (
                        <Chip tone="teal" title="New users and guests open the explore map on this region">
                            <Star className="w-3 h-3" /> Default
                        </Chip>
                    )}
                    {region.badge && <Chip tone="violet">{region.badge}</Chip>}
                    {!region.is_active && (
                        <Chip tone="amber" title="Turned off on the Regions page. Hidden in the app regardless of the explore switch.">
                            <AlertTriangle className="w-3 h-3" /> Inactive region
                        </Chip>
                    )}
                </div>
                {!region.is_active ? (
                    <p className="text-xs text-amber-700 mt-0.5">
                        Inactive on the Regions page, so it's hidden in the app whatever this switch says.{" "}
                        <Link to={`/regions/${region.id}`} className="font-medium underline hover:text-amber-900">Open region</Link>
                    </p>
                ) : (
                    region.tagline && <p className="text-xs text-neutral-500 truncate mt-0.5">{region.tagline}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1" title="Approved places"><MapPin className="w-3 h-3" />{plural(region.counts.places, "place")}</span>
                    <span className="inline-flex items-center gap-1" title="Linked quests"><MapIcon className="w-3 h-3" />{plural(region.counts.quests, "quest")}</span>
                    <span className="inline-flex items-center gap-1" title="Open collabs"><Handshake className="w-3 h-3" />{plural(region.counts.open_collabs, "open collab")}</span>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between @2xl:justify-end gap-2 w-full @2xl:w-auto @2xl:ml-auto shrink-0">
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 cursor-pointer select-none">
                    <VisibleSwitch
                        on={region.visible}
                        label={region.visible ? `Hide ${region.name} from the explore map` : `Show ${region.name} on the explore map`}
                        disabled={setVisible.isPending}
                        onToggle={() => setVisible.mutate(!region.visible)}
                    />
                    <span className="@2xl:w-12">{region.visible ? "Visible" : "Hidden"}</span>
                </label>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onEdit} className={btnSmNeutral} aria-label={`Edit ${region.name}`} title="Edit">
                        <Pencil className="w-3.5 h-3.5" /> <span className="hidden @md:inline">Edit</span>
                    </button>
                    <div className="flex @2xl:flex-col gap-1 @2xl:gap-0">
                        <MoveButton ref={upRef} direction="up" name={region.name} disabled={locked || position === 0} onClick={() => moveKeepingFocus(-1)} />
                        <MoveButton ref={downRef} direction="down" name={region.name} disabled={locked || position === total - 1} onClick={() => moveKeepingFocus(1)} />
                    </div>
                </div>
            </div>
        </li>
    );
}

function RegionOrderEditor({ regions }: { regions: ExploreRegion[] }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<string[] | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const dragStartOrder = useRef<string[] | null>(null);
    const dropped = useRef(false);

    const byId = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);
    const serverOrder = useMemo(() => regions.map((r) => r.id), [regions]);
    // Keep the unsaved order across refetches/toggles: drop ids that vanished, append new ones.
    const order = useMemo(() => {
        if (!draft) return serverOrder;
        const kept = draft.filter((id) => byId.has(id));
        return [...kept, ...serverOrder.filter((id) => !kept.includes(id))];
    }, [draft, serverOrder, byId]);
    const dirty = draft !== null && !sameOrder(order, serverOrder);
    const rows = order.map((id) => byId.get(id)).filter((r): r is ExploreRegion => !!r);
    const defaultRegion = rows.find(isShown) ?? null;
    const shownCount = rows.filter(isShown).length;

    const saveOrder = useMutation({
        mutationFn: (ids: string[]) => exploreMapService.setOrder(ids),
        onSuccess: (fresh) => {
            queryClient.setQueryData(EXPLORE_REGIONS_QUERY_KEY, fresh);
            setDraft(null);
            const first = fresh.find(isShown);
            toast.success(first ? `Order saved. ${first.name} is the default region.` : "Order saved");
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't save the order"),
    });
    const locked = saveOrder.isPending;

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const applyOrder = (next: string[]) => setDraft(sameOrder(next, serverOrder) ? null : next);
    const move = (from: number, to: number) => {
        if (from === to || to < 0 || to >= order.length) return;
        const next = [...order];
        const [item] = next.splice(from, 1);
        if (item === undefined) return;
        next.splice(to, 0, item);
        applyOrder(next);
    };

    // Native HTML5 drag and drop: rows reorder live while dragging; a cancelled
    // drag (released outside the list or Esc) restores the order from drag start.
    const dragPropsFor = (id: string, index: number): LiHTMLAttributes<HTMLLIElement> => ({
        draggable: !locked,
        onDragStart: (e: DragEvent<HTMLLIElement>) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", id);
            dragStartOrder.current = order;
            dropped.current = false;
            setDragId(id);
        },
        onDragOver: (e: DragEvent<HTMLLIElement>) => {
            if (!dragId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            const from = order.indexOf(dragId);
            if (from === -1 || from === index) return;
            // Only swap once the pointer crosses the target's midpoint, so rows don't flicker.
            const rect = e.currentTarget.getBoundingClientRect();
            const upperHalf = e.clientY < rect.top + rect.height / 2;
            if ((from < index && upperHalf) || (from > index && !upperHalf)) return;
            move(from, index);
        },
        onDragEnd: () => {
            if (!dropped.current && dragStartOrder.current) applyOrder(dragStartOrder.current);
            dragStartOrder.current = null;
            setDragId(null);
        },
    });

    const editing = editingId ? byId.get(editingId) : undefined;

    return (
        <>
            <SectionCard
                title="Region order"
                icon={Globe}
                actions={<span className="text-xs text-neutral-500">{shownCount} of {rows.length} shown in the app</span>}
                bodyClassName="p-3 sm:p-4 space-y-3"
            >
                <p className="text-sm text-neutral-500 px-1">
                    Drag rows or use the arrows to set the order the app lists regions in. The first visible, active region is the default for new users and
                    guests. The app picks up changes within about a minute.
                </p>
                {!defaultRegion && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        No region is visible and active, so the explore map has nothing to show. Turn at least one region on.
                    </div>
                )}
                <ol
                    className="@container space-y-2"
                    aria-label="Explore map regions in order"
                    onDragOver={(e) => {
                        if (dragId) e.preventDefault();
                    }}
                    onDrop={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        dropped.current = true;
                    }}
                >
                    {rows.map((r, i) => (
                        <RegionRow
                            key={r.id}
                            region={r}
                            position={i}
                            total={rows.length}
                            isDefault={r.id === defaultRegion?.id}
                            isDragging={dragId === r.id}
                            locked={locked}
                            onMove={(delta) => move(i, i + delta)}
                            onEdit={() => setEditingId(r.id)}
                            dragProps={dragPropsFor(r.id, i)}
                        />
                    ))}
                </ol>
            </SectionCard>

            {/* Pinned to the viewport: the dashboard scrolls the window, so `sticky` inside <main> never engages. */}
            {dirty && (
                <>
                    <div className="h-20" aria-hidden="true" />
                    <div className="fixed z-40 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 left-4 right-4 md:left-auto md:right-8 md:max-w-xl animate-slide-up" role="region" aria-label="Unsaved order">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)]">
                            <p className="text-sm text-neutral-700">
                                <span className="font-semibold">Unsaved order.</span>{" "}
                                {defaultRegion ? `${defaultRegion.name} will be the default region.` : "No region is shown, so there will be no default."}
                            </p>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setDraft(null)} disabled={locked} className={btnSecondary}>
                                    <Undo2 className="w-4 h-4" /> Discard
                                </button>
                                <button type="button" onClick={() => saveOrder.mutate(order)} disabled={locked} className={btnPrimary}>
                                    <LoadingButtonIcon loading={locked} icon={Save} /> Save order
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {editing && <RegionSettingsDrawer key={editing.id} region={editing} onClose={() => setEditingId(null)} />}
        </>
    );
}

export function ExploreMapPage() {
    const { isAdmin } = useCollabAccess();
    const regionsQuery = useQuery({
        queryKey: EXPLORE_REGIONS_QUERY_KEY,
        queryFn: exploreMapService.listRegions,
        enabled: isAdmin,
    });

    if (!isAdmin) return <AccessDenied message="Only admins can manage the explore map." />;

    const regions = regionsQuery.data ?? [];

    return (
        <div className="max-w-[1100px] space-y-5 animate-fade-in">
            <PageHeader
                icon={Compass}
                title="Explore map"
                gradient="from-sky-500 to-teal-600"
                subtitle="Choose which regions the app's explore map shows, and in what order"
                actions={
                    <Link to="/regions" className={btnSecondary}>
                        <Globe className="w-4 h-4" /> Manage regions
                    </Link>
                }
            />
            <PanelState
                isLoading={regionsQuery.isLoading}
                error={regionsQuery.error}
                isEmpty={regions.length === 0}
                emptyIcon={Globe}
                emptyText="No cities yet. Create a city on the Regions page and it will show up here."
                onRetry={() => regionsQuery.refetch()}
            >
                <RegionOrderEditor regions={regions} />
            </PanelState>
        </div>
    );
}
