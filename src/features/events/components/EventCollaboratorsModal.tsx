import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Search, Check, Crown, UserPlus, Users } from "lucide-react";
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
    const [selected, setSelected] = useState<Set<string> | null>(null); // user_ids
    const [saving, setSaving] = useState(false);

    // Current event team (owner + collaborator ids/names).
    const { data: detail, isLoading: loadingDetail } = useQuery({
        queryKey: ["admin-event-detail", eventId],
        queryFn: () => eventsService.getEventDetail(eventId),
    });

    // Creator directory for the picker.
    const { data: creatorsData, isLoading: loadingCreators } = useQuery({
        queryKey: ["admin-creators-for-collab", search],
        queryFn: () => creatorsService.listCreators({ search: search || undefined, page_size: 50 }),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[3px] animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-900/5 w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                            <Users className="w-4.5 h-4.5 text-violet-600" /> Collaborators
                        </h3>
                        <p className="text-xs text-neutral-500">{eventTitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Owner + selected summary */}
                <div className="px-6 py-3 border-b border-neutral-100 bg-neutral-50/60">
                    {loadingDetail ? (
                        <p className="text-sm text-neutral-400">Loading team…</p>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                                <Crown className="w-3.5 h-3.5" /> {ownerName} (owner)
                            </span>
                            <span className="text-xs text-neutral-500">
                                {selectedSet.size} collaborator{selectedSet.size === 1 ? "" : "s"} selected
                            </span>
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="px-6 py-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search creators by name…"
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                        />
                    </div>
                </div>

                {/* Creator list */}
                <div className="overflow-y-auto flex-1 px-3 pb-2">
                    {loadingCreators ? (
                        <p className="p-8 text-center text-neutral-400 text-sm">Loading creators…</p>
                    ) : creators.length === 0 ? (
                        <div className="p-10 text-center text-neutral-400">
                            <UserPlus className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">No creators found.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-neutral-100">
                            {creators.map((c) => {
                                const isOwner = ownerId != null && c.user_id === ownerId;
                                const checked = selectedSet.has(c.user_id);
                                return (
                                    <li key={c.user_id}>
                                        <button
                                            disabled={isOwner}
                                            onClick={() => toggle(c.user_id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isOwner ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-50"}`}
                                        >
                                            <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${checked ? "bg-violet-600 border-violet-600" : "border-neutral-300"}`}>
                                                {checked && <Check className="w-3.5 h-3.5 text-white" />}
                                            </span>
                                            {c.avatar_url ? (
                                                <img src={c.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-neutral-200" />
                                            ) : (
                                                <span className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-semibold text-neutral-500">
                                                    {(c.name ?? "?").slice(0, 1).toUpperCase()}
                                                </span>
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium text-neutral-900 truncate">
                                                    {c.name ?? "Unnamed creator"}
                                                    {c.is_verified && <span title="Verified" className="ml-1 text-violet-500">✓</span>}
                                                </span>
                                                <span className="block text-[11px] text-neutral-400 truncate">
                                                    {isOwner ? "Owner" : `${c.total_quests ?? 0} quests`}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-200">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100">Cancel</button>
                    <button
                        onClick={() => void save()}
                        disabled={saving || loadingDetail}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60"
                    >
                        {saving ? "Saving…" : "Save Collaborators"}
                    </button>
                </div>
            </div>
        </div>
    );
}
