import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    X, ExternalLink, RefreshCw,
    Clock, MapPin, Eye, Tag,
    Star, Layers, ChevronRight,
    DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { questsService } from "../services/quests.service";
import { formatDuration } from "../utils/formatters";
import type { QuestStatus } from "@/types";

// ---- Status styles ----
const questStatusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    Draft: { label: "Draft", dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" },
    'Under Review': { label: "Under Review", dot: "bg-blue-500", bg: "bg-blue-50 text-blue-700 border-blue-200" },
    'Changes Requested': { label: "Changes Requested", dot: "bg-orange-500", bg: "bg-orange-50 text-orange-700 border-orange-200" },
    Approved: { label: "Approved", dot: "bg-indigo-500", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    Published: { label: "Published", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    Paused: { label: "Paused", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    Rejected: { label: "Rejected", dot: "bg-rose-500", bg: "bg-rose-50 text-rose-700 border-rose-200" },
    Archived: { label: "Archived", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
};

// formatDuration imported from ../utils/formatters

// ---- Stat card styles ----
const statCardStyles = [
    { bg: "from-violet-50 to-violet-100/50", iconBg: "bg-violet-100", border: "border-violet-200/60", text: "text-violet-700" },
    { bg: "from-amber-50 to-amber-100/50", iconBg: "bg-amber-100", border: "border-amber-200/60", text: "text-amber-700" },
    { bg: "from-sky-50 to-sky-100/50", iconBg: "bg-sky-100", border: "border-sky-200/60", text: "text-sky-700" },
    { bg: "from-emerald-50 to-emerald-100/50", iconBg: "bg-emerald-100", border: "border-emerald-200/60", text: "text-emerald-700" },
    { bg: "from-indigo-50 to-indigo-100/50", iconBg: "bg-indigo-100", border: "border-indigo-200/60", text: "text-indigo-700" },
    { bg: "from-teal-50 to-teal-100/50", iconBg: "bg-teal-100", border: "border-teal-200/60", text: "text-teal-700" },
] as const;

// ---- Props ----
interface QuestDetailModalProps {
    open: boolean;
    questId: string | null;
    questTitle: string;
    questStatus: QuestStatus;
    onClose: () => void;
    onStatusChange?: (questId: string, status: QuestStatus) => void;
    canDelete?: boolean;
    onDelete?: (questId: string) => void;
}

/** Read-only quick-view modal for quest details. */
export function QuestDetailModal({
    open, questId, questTitle, questStatus,
    onClose,
}: QuestDetailModalProps) {
    const navigate = useNavigate();

    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onClose]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["quest-detail", questId],
        queryFn: () => questsService.getQuestDetail(questId ?? ""),
        enabled: open && !!questId,
        staleTime: 30_000,
    });

    if (!open || !questId) return null;

    // V2: data IS the flat quest detail (no sub-document wrappers)
    const quest = data;
    const defaultSc = { label: "Draft", dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" };
    const sc = questStatusConfig[questStatus] ?? defaultSc;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-slide-up overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-gradient-to-r from-violet-50/60 via-white to-white">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-neutral-900 truncate">{questTitle || "Untitled Quest"}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                {sc.label}
                            </span>
                            {quest && quest.view_count > 0 && (
                                <Badge label={`${quest.view_count} views`} styles="bg-violet-50 text-violet-700 border-violet-200" />
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-6 h-6 text-violet-600 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500 text-sm">Failed to load quest details</div>
                    ) : (
                        <>
                            {/* Overview Stats — Glassmorphic Interactive Cards */}
                            <div>
                                <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Layers className="w-4 h-4" /> Overview
                                </h4>
                                <div className="grid grid-cols-3 gap-2.5">
                                    <GlassStatCard
                                        icon={<Tag className="w-4 h-4" />}
                                        label="Theme"
                                        value={(quest?.theme?.[0] ?? "—")}
                                        style={statCardStyles[0]}
                                    />
                                    <GlassStatCard
                                        icon={<Star className="w-4 h-4" />}
                                        label="Difficulty"
                                        value={(quest?.difficulty ?? "—")}
                                        style={statCardStyles[1]}
                                    />
                                    <GlassStatCard
                                        icon={<Clock className="w-4 h-4" />}
                                        label="Duration"
                                        value={formatDuration(quest?.duration_minutes)}
                                        style={statCardStyles[2]}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2.5 mt-2.5">
                                    <GlassStatCard
                                        icon={<DollarSign className="w-4 h-4" />}
                                        label="Price"
                                        value={quest && quest.price > 0 ? `₹${quest.price.toLocaleString("en-IN")}` : "Free"}
                                        style={statCardStyles[3]}
                                    />
                                    <GlassStatCard
                                        icon={<Eye className="w-4 h-4" />}
                                        label="Views"
                                        value={(quest?.view_count ?? 0).toLocaleString()}
                                        style={statCardStyles[4]}
                                    />
                                    <GlassStatCard
                                        icon={<Layers className="w-4 h-4" />}
                                        label="Markers"
                                        value={(quest?.total_markers ?? 0)}
                                        style={statCardStyles[5]}
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            {quest?.description && (
                                <div>
                                    <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">Description</h4>
                                    <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 text-sm text-neutral-700 leading-relaxed">
                                        <p>{quest.description}</p>
                                    </div>
                                </div>
                            )}

                            {/* Creator */}
                            {quest?.creator_summary?.name && (
                                <div>
                                    <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">Creator</h4>
                                    <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-3 text-sm flex justify-between items-center">
                                        <span className="text-neutral-800 font-medium">{quest.creator_summary.name}</span>
                                        <span className="text-xs text-neutral-400">ID: …{quest.creator_summary.id.slice(-8)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Region */}
                            {quest?.region_summary?.name && (
                                <div>
                                    <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <MapPin className="w-4 h-4" /> Region
                                    </h4>
                                    <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-neutral-500">Region</span>
                                            <span className="font-medium text-neutral-800">{quest.region_summary.name}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Markers preview */}
                            {quest && quest.total_markers > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                                        Markers ({quest.total_markers})
                                    </h4>
                                    <div className="bg-neutral-50 rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                                        {quest.marker_summaries.slice(0, 4).map((m) => (
                                            <div key={m.marker_id} className="px-3 py-2.5 flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                                    {m.order ?? "·"}
                                                </span>
                                                <span className="text-sm text-neutral-700 truncate">{m.name ?? "Unnamed marker"}</span>
                                            </div>
                                        ))}
                                        {quest.total_markers > 4 && (
                                            <div className="px-3 py-2 text-xs text-neutral-400 text-center">
                                                +{quest.total_markers - 4} more markers
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Media preview */}
                            {quest && quest.cloudinary_assets.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">Media ({quest.cloudinary_assets.length})</h4>
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        {quest.cloudinary_assets.slice(0, 5).map((asset) => (
                                            <img
                                                key={asset.public_id}
                                                src={asset.secure_url}
                                                alt={asset.alt_text || ""}
                                                className="w-16 h-16 rounded-lg object-cover border border-neutral-200 flex-shrink-0"
                                            />
                                        ))}
                                        {quest.cloudinary_assets.length > 5 && (
                                            <div className="w-16 h-16 rounded-lg border border-neutral-200 flex items-center justify-center text-xs text-neutral-400">
                                                +{quest.cloudinary_assets.length - 5}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => {
                            onClose();
                            navigate(`/quests/${questId}`);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors inline-flex items-center justify-center gap-2"
                    >
                        <ExternalLink className="w-4 h-4" /> View Quest
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---- Glassmorphic Stat Card ----
function GlassStatCard({ icon, label, value, style }: {
    icon: ReactNode;
    label: string;
    value: string | number;
    style: { bg: string; iconBg: string; border: string; text: string };
}) {
    return (
        <div className={`
            relative rounded-xl border p-3 text-center
            bg-gradient-to-br ${style.bg} ${style.border}
            hover:shadow-md hover:-translate-y-0.5
            transition-all duration-200 cursor-default group
        `}>
            <div className={`
                w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center
                ${style.iconBg} ${style.text}
                group-hover:scale-110 transition-transform duration-200
            `}>
                {icon}
            </div>
            <div className={`text-base font-bold ${style.text}`}>{value}</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">{label}</div>
        </div>
    );
}
