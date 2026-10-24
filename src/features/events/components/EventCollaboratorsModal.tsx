import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Crown, UserPlus, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/FilterBar";
import { Checkbox } from "@/components/ui/Field";
import { PanelState } from "@/components/ui/States";
import { Tag } from "@/components/ui/StatusPill";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cx } from "@/utils/cx";
import { eventsService } from "../services/events.service";
import { creatorsService } from "@/features/creators/services/creators.service";

interface EventCollaboratorsModalProps {
    eventId: string;
    eventTitle: string;
    onClose: () => void;
    onSaved?: () => void;
}

/**
 * Admin assigns co-organiser creators to an event. The event owner (`created_by`)
 * is shown but not editable. Selected creators pool their markers as venues and
 * can co-manage the event.
 */
export function EventCollaboratorsModal({ eventId, eventTitle, onClose, onSaved }: EventCollaboratorsModalProps) {
    const [search, setSearch] = useState("");
    const q = useDebouncedValue(search.trim(), 300);
    const [selected, setSelected] = useState<Set<string> | null>(null); // user_ids
    const [saving, setSaving] = useState(false);

    // Current event team (owner + collaborator ids/names).
    const {
        data: detail,
        isLoading: loadingDetail,
        error: detailError,
    } = useQuery({
        queryKey: ["admin-event-detail", eventId],
        queryFn: () => eventsService.getEventDetail(eventId),
    });

    // Creator directory for the picker.
    const {
        data: creatorsData,
        isLoading: loadingCreators,
        error: creatorsError,
        refetch,
    } = useQuery({
        queryKey: ["admin-creators-for-collab", q],
        queryFn: () => creatorsService.listCreators({ search: q || undefined, page_size: 50 }),
        placeholderData: (prev) => prev,
    });

    // Initialise the selection from the event once its detail loads.
    const selectedSet = useMemo(() => {
        if (selected) return selected;
        return new Set(detail?.collaborator_ids ?? []);
    }, [selected, detail?.collaborator_ids]);

    const ownerId = detail?.created_by ?? null;
    const creators = creatorsData?.creators ?? [];

    const toggle = (userId: string) => {
        const next = new Set(selectedSet);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        setSelected(next);
    };

    const save = async () => {
        setSaving(true);
        try {
            await eventsService.setCollaborators(eventId, Array.from(selectedSet));
            toast.success("Collaborators updated");
            onSaved?.();
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update collaborators");
        } finally {
            setSaving(false);
        }
    };

    const ownerName = detail?.created_by_name || "Event owner";

    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!saving}
            title="Collaborators"
            description={eventTitle}
            icon={Users}
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => void save()} loading={saving} disabled={loadingDetail || !!detailError}>
                        Save collaborators
                    </Button>
                </>
            }
        >
            {/* Owner + selected summary */}
            <div className="flex flex-wrap items-center gap-2">
                {loadingDetail ? (
                    <span className="text-sm text-ink-muted">Loading team…</span>
                ) : detailError ? (
                    <span className="text-sm text-bad">Couldn't load the event team.</span>
                ) : (
                    <>
                        <Tag tone="warn">
                            <Crown className="h-3 w-3" aria-hidden /> {ownerName} (owner)
                        </Tag>
                        <span className="text-xs text-ink-muted">
                            {selectedSet.size} collaborator{selectedSet.size === 1 ? "" : "s"} selected
                        </span>
                    </>
                )}
            </div>

            <SearchInput value={search} onChange={setSearch} placeholder="Search creators by name…" />

            <div className="-mx-2">
                <PanelState
                    isLoading={loadingCreators && !creatorsData}
                    error={creatorsError}
                    onRetry={() => refetch()}
                    isEmpty={creators.length === 0}
                    emptyIcon={UserPlus}
                    emptyText="No creators found."
                >
                    <ul className="divide-y divide-line">
                        {creators.map((c) => {
                            const isOwner = ownerId !== null && c.user_id === ownerId;
                            const checked = selectedSet.has(c.user_id);
                            return (
                                <li key={c.user_id}>
                                    <label
                                        className={cx(
                                            "flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors",
                                            isOwner ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-surface-muted"
                                        )}
                                    >
                                        <Checkbox
                                            checked={checked}
                                            disabled={isOwner}
                                            onChange={() => toggle(c.user_id)}
                                            aria-label={`${checked ? "Remove" : "Add"} ${c.name ?? "creator"}`}
                                        />
                                        {c.avatar_url ? (
                                            <img src={c.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-line object-cover" />
                                        ) : (
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700" aria-hidden>
                                                {(c.name ?? "?").slice(0, 1).toUpperCase()}
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-1 truncate text-sm font-medium text-ink">
                                                <span className="truncate">{c.name ?? "Unnamed creator"}</span>
                                                {c.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent-600" aria-label="Verified" />}
                                            </span>
                                            <span className="block truncate text-xs text-ink-muted">{isOwner ? "Owner" : `${c.total_quests ?? 0} quests`}</span>
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </PanelState>
            </div>
        </Modal>
    );
}
