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
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { PanelState } from "@/components/ui/States";
import { Tag } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Field";
import { cx } from "@/utils/cx";
import { EXPLORE_REGIONS_QUERY_KEY, exploreMapService, patchRegionInCache, replaceRegionInCache } from "../services/explore-map.service";
import { RegionSettingsDrawer } from "../components/RegionSettingsDrawer";
import type { ExploreRegion } from "../types";

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** The app's default is the first region it actually shows. */
const isShown = (r: ExploreRegion) => r.visible && r.is_active;

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
            className="rounded-lg border border-line p-1.5 text-ink-muted transition-colors hover:bg-brand-50 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent @2xl:rounded @2xl:border-0 @2xl:p-0.5 @2xl:text-ink-faint"
        >
            <Icon className="h-4 w-4" aria-hidden />
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
            className={cx(
                "group flex flex-wrap items-center gap-3 rounded-card border px-3 py-3 transition-colors @lg:px-4 @2xl:flex-nowrap",
                isDragging
                    ? "border-dashed border-accent-400 bg-accent-50/60 opacity-50"
                    : muted
                      ? "border-line bg-surface-muted"
                      : "border-line bg-surface hover:border-line-strong"
            )}
        >
            <span
                className={cx("hidden text-ink-faint group-hover:text-ink-muted @lg:flex", locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing")}
                title="Drag to reorder"
                aria-hidden="true"
            >
                <GripVertical className="h-4 w-4" />
            </span>
            <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-ink-faint">{position + 1}</span>

            <div className={cx("flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-700 @lg:h-11 @lg:w-16", muted && "opacity-60")}>
                {region.cover_image && !thumbFailed ? (
                    <img src={region.cover_image} alt="" draggable={false} className="w-full h-full object-cover" onError={() => setThumbFailed(true)} />
                ) : (
                    <Globe className="h-5 w-5 text-white/80" aria-hidden />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    <Link to={`/regions/${region.id}`} className={cx("truncate font-semibold hover:text-accent-700 hover:underline", muted ? "text-ink-muted" : "text-ink")}>
                        {region.name}
                    </Link>
                    {isDefault && (
                        <Tag tone="brand" title="New users and guests open the explore map on this region">
                            <Star className="h-3 w-3" aria-hidden /> Default
                        </Tag>
                    )}
                    {region.badge && <Tag tone="info">{region.badge}</Tag>}
                    {!region.is_active && (
                        <Tag tone="warn" title="Turned off on the Regions page. Hidden in the app regardless of the explore switch.">
                            <AlertTriangle className="h-3 w-3" aria-hidden /> Inactive region
                        </Tag>
                    )}
                </div>
                {!region.is_active ? (
                    <p className="mt-0.5 text-xs text-warn">
                        Inactive on the Regions page, so it&apos;s hidden in the app whatever this switch says.{" "}
                        <Link to={`/regions/${region.id}`} className="font-medium underline">
                            Open region
                        </Link>
                    </p>
                ) : (
                    region.tagline && <p className="mt-0.5 truncate text-xs text-ink-muted">{region.tagline}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1" title="Approved places">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {plural(region.counts.places, "place")}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Linked quests">
                        <MapIcon className="h-3 w-3" aria-hidden />
                        {plural(region.counts.quests, "quest")}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Open collabs">
                        <Handshake className="h-3 w-3" aria-hidden />
                        {plural(region.counts.open_collabs, "open collab")}
                    </span>
                </div>
            </div>

            <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 @2xl:ml-auto @2xl:w-auto @2xl:justify-end">
                <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                    <Switch
                        size="sm"
                        hideLabel
                        checked={region.visible}
                        label={region.visible ? `Hide ${region.name} from the explore map` : `Show ${region.name} on the explore map`}
                        disabled={setVisible.isPending}
                        onChange={(v) => setVisible.mutate(v)}
                    />
                    <span className="@2xl:w-12">{region.visible ? "Visible" : "Hidden"}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" icon={Pencil} onClick={onEdit} aria-label={`Edit ${region.name}`} title="Edit">
                        <span className="hidden @md:inline">Edit</span>
                    </Button>
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
            <Panel
                title="Region order"
                icon={Globe}
                actions={
                    <span className="text-xs text-ink-muted">
                        {shownCount} of {rows.length} shown in the app
                    </span>
                }
                bodyClassName="space-y-3 p-3 sm:p-4"
            >
                <p className="px-1 text-sm text-ink-muted">
                    Drag rows or use the arrows to set the order the app lists regions in. The first visible, active region is the default for new users and
                    guests. The app picks up changes within about a minute.
                </p>
                {!defaultRegion && (
                    <div role="alert" className="flex items-start gap-2 rounded-control border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
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
            </Panel>

            {/* Pinned to the viewport: the dashboard scrolls the window, so `sticky` inside <main> never engages. */}
            {dirty && (
                <>
                    <div className="h-20" aria-hidden="true" />
                    <div
                        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 animate-slide-up md:bottom-4 md:left-auto md:right-8 md:max-w-xl"
                        role="region"
                        aria-label="Unsaved order"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent-200 bg-surface px-4 py-3 shadow-pop">
                            <p className="text-sm text-ink">
                                <span className="font-semibold">Unsaved order.</span>{" "}
                                {defaultRegion ? `${defaultRegion.name} will be the default region.` : "No region is shown, so there will be no default."}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="secondary" icon={Undo2} onClick={() => setDraft(null)} disabled={locked}>
                                    Discard
                                </Button>
                                <Button variant="primary" icon={Save} onClick={() => saveOrder.mutate(order)} loading={locked}>
                                    Save order
                                </Button>
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
        <div className="max-w-5xl space-y-5">
            <PageHeader
                icon={Compass}
                title="Explore map"
                description="Choose which regions the app's explore map shows, and in what order"
                actions={
                    <ButtonLink to="/regions" variant="secondary" icon={Globe}>
                        Manage regions
                    </ButtonLink>
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
